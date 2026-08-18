'use server'

import { obterSessao } from '../sessao-servidor'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { listarApelidos, obterPrograma } from '../dados/programas'
import { listarDatasBloqueadas } from '../dados/datas-bloqueadas'
import { listarDatasEspeciais } from '../dados/datas-especiais'
import { listarRestricoes } from '../dados/restricoes'
import { lerPaginado } from '../dados/paginacao'
import { avaliarDisponibilidadeDoDia, type DisponibilidadeDoDia } from '../dominio/disponibilidade-dia'
import { montarMapa, ocupaSlot } from '../dominio/formatos'
import { encontrarProgramaId, montarIndice } from '../dominio/programas'
import { normalizarNome } from '../dominio/texto'
import { regionalConsomeSlotNacional } from '../dominio/regional'

export type ResultadoDaDisponibilidadeMensal = {
  erro: string | null
  programa: {
    id: string
    nome: string
    slots: number
    aceitaRegional: boolean
  } | null
  ano: number
  mes: number
  limiteMensal: number
  acoesDoAnuncianteNoMes: number
  dias: DisponibilidadeDoDia[]
}

type Parametros = {
  programaId: string
  clienteId: string
  ano: number
  mes: number
}

type AcaoDoTake = {
  numero_da_entrega: string
  programa: string
  data_de_exibicao: string
  formato: string
  anunciante: string
  marca: string
}

type AcaoRegionalDoMes = {
  data_de_exibicao: string
  cliente_id: string | null
  cliente_nome: string
  numero_da_entrega: string | null
}

type ClienteClassificado = {
  id: string
  nome: string
  setor: string | null
  industria: string | null
}

type AliasDoTake = {
  id: string
  nome_normalizado: string
  cliente_id: string | null
}

type MarcaDoTake = {
  id: string
  nome_normalizado: string
}

type RelacaoMarcaAnunciante = {
  anunciante_take_id: string
  marca_id: string
  cliente_id_override: string | null
}

function dataDoBrasil(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function intervaloDoMes(ano: number, mes: number): { inicio: string; fim: string; datas: string[] } | null {
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return null
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return null

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const mm = String(mes).padStart(2, '0')
  const datas = Array.from({ length: ultimoDia }, (_, indice) =>
    `${ano}-${mm}-${String(indice + 1).padStart(2, '0')}`,
  )

  return { inicio: datas[0], fim: datas[datas.length - 1], datas }
}

/**
 * Monta o mês real do calendário para uma marca já resolvida para um cliente.
 * O navegador envia apenas IDs; setor/indústria, programa, regras e vendas são
 * relidos no servidor para o cálculo nunca depender de valores manipuláveis na UI.
 */
export async function consultarDisponibilidadeMensal(
  parametros: Parametros,
): Promise<ResultadoDaDisponibilidadeMensal> {
  const vazio: ResultadoDaDisponibilidadeMensal = {
    erro: null,
    programa: null,
    ano: parametros.ano,
    mes: parametros.mes,
    limiteMensal: 0,
    acoesDoAnuncianteNoMes: 0,
    dias: [],
  }

  const sessao = await obterSessao()
  if (!sessao) return { ...vazio, erro: 'Sua sessão expirou. Entre de novo.' }

  const intervalo = intervaloDoMes(parametros.ano, parametros.mes)
  if (!intervalo) return { ...vazio, erro: 'Mês inválido.' }

  const programa = await obterPrograma(parametros.programaId)
  if (!programa || programa.estado !== 'ativo' || !programa.disponivel_para_proposta) {
    return { ...vazio, erro: 'Este programa não está disponível para proposta.' }
  }

  const supabase = await criarClienteServidor()
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .select('id, nome, setor, industria')
    .eq('id', parametros.clienteId)
    .maybeSingle()

  if (erroCliente || !cliente) {
    return { ...vazio, erro: 'Não foi possível identificar o anunciante da marca.' }
  }

  const [apelidos, bloqueios, restricoes, periodosEspeciais, leituraAcoes, leituraFormatos, regionais] =
    await Promise.all([
      listarApelidos(programa.id),
      listarDatasBloqueadas(programa.id),
      listarRestricoes(programa.id),
      listarDatasEspeciais(programa.id),
      lerPaginado<AcaoDoTake>((de, ate) =>
        supabase
          .from('acoes_vendidas')
          .select('numero_da_entrega, programa, data_de_exibicao, formato, anunciante, marca')
          .gte('data_de_exibicao', intervalo.inicio)
          .lte('data_de_exibicao', intervalo.fim)
          .range(de, ate),
      ),
      lerPaginado<{ formato: string; categoria: string }>((de, ate) =>
        supabase.from('formatos').select('formato, categoria').range(de, ate),
      ),
      supabase
        .from('acoes_regionais')
        .select('data_de_exibicao, cliente_id, cliente_nome, numero_da_entrega')
        .eq('programa_id', programa.id)
        .gte('data_de_exibicao', intervalo.inicio)
        .lte('data_de_exibicao', intervalo.fim),
    ])

  if (leituraAcoes.erro) {
    return { ...vazio, erro: 'Não foi possível consultar as vendas do Globo Take.' }
  }
  if (leituraFormatos.erro) {
    return { ...vazio, erro: 'Não foi possível classificar os formatos vendidos.' }
  }
  if (regionais.error) {
    return { ...vazio, erro: 'Não foi possível consultar as ações regionais.' }
  }

  const indice = montarIndice(
    [{ id: programa.id, mnemonico: programa.mnemonico }],
    apelidos.map((apelido) => ({ programa_id: programa.id, texto: apelido.texto })),
  )
  const mapaFormatos = montarMapa(leituraFormatos.linhas)
  const acoesDoPrograma = leituraAcoes.linhas.filter(
    (acao) => encontrarProgramaId(acao.programa, indice) === programa.id,
  )
  const acoesQueOcupam = acoesDoPrograma.filter((acao) => ocupaSlot(acao.formato, mapaFormatos))

  const ocupacaoPorData = new Map<string, number>()
  const entregasNacionaisPorData = new Set<string>()
  for (const acao of acoesQueOcupam) {
    ocupacaoPorData.set(
      acao.data_de_exibicao,
      (ocupacaoPorData.get(acao.data_de_exibicao) ?? 0) + 1,
    )
    entregasNacionaisPorData.add(`${acao.data_de_exibicao}|${acao.numero_da_entrega}`)
  }

  const acoesRegionais = (regionais.data ?? []) as AcaoRegionalDoMes[]
  if (regionalConsomeSlotNacional()) {
    const regionaisJaContados = new Set<string>()
    for (const acao of acoesRegionais) {
      const chaveEntrega = acao.numero_da_entrega
        ? `${acao.data_de_exibicao}|${acao.numero_da_entrega}`
        : null
      if (chaveEntrega && entregasNacionaisPorData.has(chaveEntrega)) continue

      // Uma ação regional possui uma linha por praça. Para o inventário
      // nacional ela consome UM slot, não 2/3 slots quando a mesma ação compra
      // várias praças.
      const chaveRegional = chaveEntrega
        ? `entrega|${chaveEntrega}`
        : `cliente|${acao.data_de_exibicao}|${acao.cliente_id ?? normalizarNome(acao.cliente_nome)}`
      if (regionaisJaContados.has(chaveRegional)) continue
      regionaisJaContados.add(chaveRegional)
      ocupacaoPorData.set(
        acao.data_de_exibicao,
        (ocupacaoPorData.get(acao.data_de_exibicao) ?? 0) + 1,
      )
    }
  }

  // A origem pode trazer uma marca associada a um anunciante que foi corrigido
  // manualmente na governança (ex.: PAGBANK sob PORTO SEGURO). Por isso a venda
  // precisa ser resolvida pelo PAR anunciante + marca, respeitando o override da
  // relação antes do cliente padrão do alias.
  const nomesNormalizados = [
    ...new Set(acoesQueOcupam.map((acao) => normalizarNome(acao.anunciante)).filter(Boolean)),
  ]
  const marcasNormalizadas = [
    ...new Set(acoesQueOcupam.map((acao) => normalizarNome(acao.marca)).filter(Boolean)),
  ]

  const [aliases, marcas] = await Promise.all([
    nomesNormalizados.length
      ? supabase
          .from('anunciantes_take')
          .select('id, nome_normalizado, cliente_id')
          .in('nome_normalizado', nomesNormalizados)
      : Promise.resolve({ data: [], error: null }),
    marcasNormalizadas.length
      ? supabase
          .from('marcas')
          .select('id, nome_normalizado')
          .in('nome_normalizado', marcasNormalizadas)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (aliases.error || marcas.error) {
    return { ...vazio, erro: 'Não foi possível relacionar as vendas aos anunciantes da carteira.' }
  }

  const aliasPorNome = new Map<string, AliasDoTake>(
    ((aliases.data ?? []) as AliasDoTake[]).map((alias) => [alias.nome_normalizado, alias]),
  )
  const marcaPorNome = new Map<string, MarcaDoTake>(
    ((marcas.data ?? []) as MarcaDoTake[]).map((marca) => [marca.nome_normalizado, marca]),
  )
  const aliasIds = [...new Set([...aliasPorNome.values()].map((alias) => alias.id))]
  const marcaIds = [...new Set([...marcaPorNome.values()].map((marca) => marca.id))]

  const relacoes = aliasIds.length > 0 && marcaIds.length > 0
    ? await supabase
        .from('anunciante_take_marcas')
        .select('anunciante_take_id, marca_id, cliente_id_override')
        .in('anunciante_take_id', aliasIds)
        .in('marca_id', marcaIds)
    : { data: [], error: null }

  if (relacoes.error) {
    return { ...vazio, erro: 'Não foi possível aplicar as correções de marca e anunciante.' }
  }

  const overridePorPar = new Map<string, string>()
  for (const relacao of (relacoes.data ?? []) as RelacaoMarcaAnunciante[]) {
    if (relacao.cliente_id_override) {
      overridePorPar.set(
        `${relacao.anunciante_take_id}|${relacao.marca_id}`,
        relacao.cliente_id_override,
      )
    }
  }

  function clienteEfetivoDaAcao(acao: AcaoDoTake): string | null {
    const alias = aliasPorNome.get(normalizarNome(acao.anunciante))
    if (!alias) return null

    const marca = marcaPorNome.get(normalizarNome(acao.marca))
    const override = marca
      ? overridePorPar.get(`${alias.id}|${marca.id}`)
      : undefined

    return override ?? alias.cliente_id ?? null
  }

  const acoesResolvidas = acoesQueOcupam.map((acao) => ({
    acao,
    clienteId: clienteEfetivoDaAcao(acao),
  }))

  const idsDeClientesVendidos = new Set<string>()
  for (const item of acoesResolvidas) {
    if (item.clienteId) idsDeClientesVendidos.add(item.clienteId)
  }
  for (const acao of acoesRegionais) {
    if (acao.cliente_id) idsDeClientesVendidos.add(acao.cliente_id)
  }

  const leituraClientesVendidos = idsDeClientesVendidos.size
    ? await supabase
        .from('clientes')
        .select('id, nome, setor, industria')
        .in('id', [...idsDeClientesVendidos])
    : { data: [], error: null }

  if (leituraClientesVendidos.error) {
    return { ...vazio, erro: 'Não foi possível classificar os anunciantes já vendidos.' }
  }

  const clientesPorId = new Map<string, ClienteClassificado>(
    ((leituraClientesVendidos.data ?? []) as ClienteClassificado[]).map((item) => [item.id, item]),
  )
  const vendasPorData = new Map<string, { anunciante: string; setor: string | null; industria: string | null }[]>()
  const vendasJaIncluidas = new Set<string>()
  const datasDoProprioAnunciante = new Set<string>()
  const entregasDoProprioAnunciante = new Set<string>()

  function incluirVenda(data: string, clienteVenda: ClienteClassificado) {
    const chave = `${data}|${clienteVenda.id}`
    if (vendasJaIncluidas.has(chave)) return
    vendasJaIncluidas.add(chave)
    const vendas = vendasPorData.get(data) ?? []
    vendas.push({
      anunciante: clienteVenda.nome,
      setor: clienteVenda.setor,
      industria: clienteVenda.industria,
    })
    vendasPorData.set(data, vendas)
  }

  for (const item of acoesResolvidas) {
    if (!item.clienteId) continue
    const classificado = clientesPorId.get(item.clienteId)
    if (classificado) incluirVenda(item.acao.data_de_exibicao, classificado)

    if (item.clienteId === cliente.id) {
      datasDoProprioAnunciante.add(item.acao.data_de_exibicao)
      entregasDoProprioAnunciante.add(item.acao.numero_da_entrega)
    }
  }

  for (const acao of acoesRegionais) {
    if (!acao.cliente_id) continue
    const classificado = clientesPorId.get(acao.cliente_id)
    if (classificado) incluirVenda(acao.data_de_exibicao, classificado)
    if (acao.cliente_id === cliente.id) datasDoProprioAnunciante.add(acao.data_de_exibicao)
  }

  const clienteDaConsulta = {
    nome: cliente.nome,
    setor: cliente.setor,
    industria: cliente.industria,
  }
  const hoje = dataDoBrasil()
  const limiteMensal = Math.max(0, Math.floor(programa.bloqueio_mensal ?? 0))
  const acoesDoAnuncianteNoMes = entregasDoProprioAnunciante.size
  const dias = intervalo.datas.map((data) =>
    avaliarDisponibilidadeDoDia({
      data,
      hoje,
      programa,
      cliente: clienteDaConsulta,
      ocupacao: ocupacaoPorData.get(data) ?? 0,
      vendasNaData: vendasPorData.get(data) ?? [],
      proprioAnuncianteNaData: datasDoProprioAnunciante.has(data),
      acoesDoAnuncianteNoMes,
      limiteMensalDoAnunciante: limiteMensal,
      bloqueios,
      restricoes,
      periodosEspeciais,
    }),
  )

  return {
    erro: null,
    programa: {
      id: programa.id,
      nome: programa.nome,
      slots: programa.slots,
      aceitaRegional: programa.aceita_regional,
    },
    ano: parametros.ano,
    mes: parametros.mes,
    limiteMensal,
    acoesDoAnuncianteNoMes,
    dias,
  }
}
