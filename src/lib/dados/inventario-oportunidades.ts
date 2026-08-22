import { criarClienteServidor } from '../supabase/cliente-servidor'
import { montarMapa, ocupaSlot } from '../dominio/formatos'
import { encontrarProgramaId, montarIndice } from '../dominio/programas'
import { normalizarNome } from '../dominio/texto'
import { obterPrograma, listarApelidos } from './programas'

export type InventarioDaOportunidade = {
  slotsTotal: number
  slotsOcupados: number
  slotsLivres: number
  setoresCompradores: string[]
  erro: string | null
}

type Acao = {
  programa: string
  formato: string | null
  anunciante: string | null
  marca: string | null
}
type Alias = { id: string; nome_normalizado: string; cliente_id: string | null }
type Marca = { id: string; nome_normalizado: string }
type Relacao = { anunciante_take_id: string; marca_id: string; cliente_id_override: string | null }

const vazio = (erro: string): InventarioDaOportunidade => ({
  slotsTotal: 0,
  slotsOcupados: 0,
  slotsLivres: 0,
  setoresCompradores: [],
  erro,
})

/** Inventário nacional real da data, independente de um cliente específico. */
export async function carregarInventarioDaOportunidade(
  programaId: string,
  dataISO: string,
): Promise<InventarioDaOportunidade> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return vazio('Escolha uma data válida.')

  const programa = await obterPrograma(programaId)
  if (!programa) return vazio('Programa não encontrado.')

  const supabase = await criarClienteServidor()
  const [apelidos, formatos, respostaAcoes] = await Promise.all([
    listarApelidos(programaId),
    supabase.from('formatos').select('formato, categoria'),
    supabase
      .from('acoes_vendidas')
      .select('programa, formato, anunciante, marca')
      .eq('data_de_exibicao', dataISO),
  ])

  if (formatos.error || respostaAcoes.error) {
    console.error('Falha ao calcular inventário da oportunidade:', formatos.error?.message ?? respostaAcoes.error?.message)
    return vazio('Não foi possível consultar o inventário desta data.')
  }

  const indice = montarIndice(
    [{ id: programa.id, mnemonico: programa.mnemonico }],
    apelidos.map((apelido) => ({ programa_id: programa.id, texto: apelido.texto })),
  )
  const mapaFormatos = montarMapa((formatos.data ?? []) as { formato: string; categoria: string }[])
  const acoes = ((respostaAcoes.data ?? []) as Acao[]).filter(
    (acao) => encontrarProgramaId(acao.programa, indice) === programa.id && ocupaSlot(acao.formato ?? '', mapaFormatos),
  )

  const slotsTotal = Math.max(0, Math.floor(programa.slots ?? 0))
  const slotsOcupados = acoes.length
  const slotsLivres = Math.max(0, slotsTotal - slotsOcupados)

  if (acoes.length === 0) {
    return { slotsTotal, slotsOcupados, slotsLivres, setoresCompradores: [], erro: null }
  }

  const nomes = [...new Set(acoes.map((acao) => normalizarNome(acao.anunciante)).filter(Boolean))]
  const marcasNorm = [...new Set(acoes.map((acao) => normalizarNome(acao.marca)).filter(Boolean))]

  const [aliasesResp, marcasResp] = await Promise.all([
    nomes.length
      ? supabase.from('anunciantes_take').select('id, nome_normalizado, cliente_id').in('nome_normalizado', nomes)
      : Promise.resolve({ data: [], error: null }),
    marcasNorm.length
      ? supabase.from('marcas').select('id, nome_normalizado').in('nome_normalizado', marcasNorm)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (aliasesResp.error || marcasResp.error) {
    return { slotsTotal, slotsOcupados, slotsLivres, setoresCompradores: [], erro: null }
  }

  const aliases = (aliasesResp.data ?? []) as Alias[]
  const marcas = (marcasResp.data ?? []) as Marca[]
  const aliasPorNome = new Map(aliases.map((item) => [item.nome_normalizado, item]))
  const marcaPorNome = new Map(marcas.map((item) => [item.nome_normalizado, item]))
  const aliasIds = aliases.map((item) => item.id)
  const marcaIds = marcas.map((item) => item.id)

  const relacoesResp = aliasIds.length && marcaIds.length
    ? await supabase
        .from('anunciante_take_marcas')
        .select('anunciante_take_id, marca_id, cliente_id_override')
        .in('anunciante_take_id', aliasIds)
        .in('marca_id', marcaIds)
    : { data: [], error: null }

  const override = new Map<string, string>()
  if (!relacoesResp.error) {
    for (const relacao of (relacoesResp.data ?? []) as Relacao[]) {
      if (relacao.cliente_id_override) override.set(`${relacao.anunciante_take_id}|${relacao.marca_id}`, relacao.cliente_id_override)
    }
  }

  const clienteIds = new Set<string>()
  for (const acao of acoes) {
    const alias = aliasPorNome.get(normalizarNome(acao.anunciante))
    if (!alias) continue
    const marca = marcaPorNome.get(normalizarNome(acao.marca))
    const clienteId = marca ? override.get(`${alias.id}|${marca.id}`) ?? alias.cliente_id : alias.cliente_id
    if (clienteId) clienteIds.add(clienteId)
  }

  if (clienteIds.size === 0) {
    return { slotsTotal, slotsOcupados, slotsLivres, setoresCompradores: [], erro: null }
  }

  const clientesResp = await supabase.from('clientes').select('id, setor').in('id', [...clienteIds])
  const setores = [...new Set(
    ((clientesResp.data ?? []) as { id: string; setor: string | null }[])
      .map((cliente) => cliente.setor?.trim())
      .filter((setor): setor is string => Boolean(setor)),
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return { slotsTotal, slotsOcupados, slotsLivres, setoresCompradores: setores, erro: null }
}
