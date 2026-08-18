'use server'

import { obterSessao } from '../sessao-servidor'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { listarApelidos, obterPrograma } from '../dados/programas'
import { listarDatasBloqueadas } from '../dados/datas-bloqueadas'
import { listarDatasEspeciais } from '../dados/datas-especiais'
import { listarRestricoes } from '../dados/restricoes'
import { lerPaginado } from '../dados/paginacao'
import { avaliarDisponibilidadeDoDia, type DisponibilidadeDoDia } from '../dominio/disponibilidade'
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
          .select('numero_da_entrega, programa, data_de_exibicao, formato, anunciante')
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
      // várias praças. Sem número da entrega, cliente+data é a melhor chave da
      // ação e também cobre compras complementares de praça feitas depois.
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

  // Enriquece os anunciantes das vendas com setor/indústria da carteira. Os
  // aliases foram aprendidos pelo schema-marcas-take.sql; sem vínculo seguro,
  // a venda continua ocupando slot, mas não gera concorrência sem classificação.
  const nomesNormalizados = [
    ...new Set(acoesQueOcupam.map((acao) => normalizarNome(acao.anunciante)).filter(Boolean)),
  ]
  const aliases = nomesNormalizados.length
    ? await supabase
        .from('anunciantes_take')
        .select('nome_normalizado, cliente_id')
        .in('nome_normalizado', nomesNormalizados)
    : { data: [], error: null }

  if (aliases.error) {
    return { ...vazio, erro: 'Não foi possível relacionar as vendas aos anunciantes da carteira.' }
  }

  const aliasParaCliente = new Map<string, string>()
  for (const alias of aliases.data ?? []) {
    if (alias.cliente_id) aliasParaCliente.set(alias.nome_normalizado, alias.cliente_id)
  }

  const idsDeClientesVendidos = new Set<string>(
    [...aliasParaCliente.values(), ...acoesRegionais.map((acao) => acao.cliente_id).filter(Boolean)] as string[],
  )
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

  for (const acao of acoesQueOcupam) {
    const clienteId = aliasParaCliente.get(normalizarNome(acao.anunciante))
    if (!clienteId) continue
    const classificado = clientesPorId.get(clienteId)
    if (classificado) incluirVenda(acao.data_de_exibicao, classificado)
  }
  for (const acao of acoesRegionais) {
    if (!acao.cliente_id) continue
    const classificado = clientesPorId.get(acao.cliente_id)
    if (classificado) incluirVenda(acao.data_de_exibicao, classificado)
  }

  const clienteDaConsulta = {
    nome: cliente.nome,
    setor: cliente.setor,
    industria: cliente.industria,
  }
  const hoje = dataDoBrasil()
  const dias = intervalo.datas.map((data) =>
    avaliarDisponibilidadeDoDia({
      data,
      hoje,
      programa,
      cliente: clienteDaConsulta,
      ocupacao: ocupacaoPorData.get(data) ?? 0,
      vendasNaData: vendasPorData.get(data) ?? [],
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
    dias,
  }
}
