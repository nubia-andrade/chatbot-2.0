import { criarClienteServidor } from '../supabase/cliente-servidor'
import { carregarInventarioDaOportunidade } from './inventario-oportunidades'

export type CategoriaDeOportunidade = {
  id: string
  nome: string
  slug: string
  ativo: boolean
  ordem: number
}

export type FormatoDeOportunidade = {
  id: string
  nome: string
  slug: string
  ativo: boolean
  ordem: number
}

export type TipoExibicaoDaOportunidade = 'data_unica' | 'periodo'
export type TipoCustoProducao = 'valor' | 'sob_consulta'

export type OportunidadePublicada = {
  id: string
  programaId: string
  programaNome: string
  categoriaId: string
  categoriaNome: string
  categoriaSlug: string
  formatoId: string | null
  formatoNome: string
  formatoSlug: string
  tipoExibicao: TipoExibicaoDaOportunidade
  /** Data âncora para ordenação/compatibilidade. Em período, é a data inicial. */
  dataISO: string
  dataInicio: string | null
  dataFim: string | null
  expiraEm: string
  prazoEnvioPi: string | null
  sigla: string
  valorAcao: number | null
  direitosConexos: number | null
  custoProducaoTipo: TipoCustoProducao
  custoProducao: number | null
  titulo: string
  descricao: string
  imagem: string | null
  autor: string
  criadoPor: string
  inventarioAplicavel: boolean
  slotsLivres: number
  slotsTotal: number
  slotsOcupados: number
  setoresCompradores: string[]
}

type LinhaOportunidade = {
  id: string
  programa_id: string
  categoria_id: string
  formato_id: string | null
  tipo_exibicao: TipoExibicaoDaOportunidade | null
  data_evento: string | null
  data_inicio: string | null
  data_fim: string | null
  expira_em: string
  prazo_envio_pi: string | null
  sigla: string | null
  valor_acao: number | string | null
  direitos_conexos: number | string | null
  custo_producao_tipo: TipoCustoProducao | null
  custo_producao: number | string | null
  titulo: string
  descricao: string
  imagem_url: string | null
  criado_por: string
  criado_por_nome: string
  programas: { nome: string; mnemonico: string } | { nome: string; mnemonico: string }[] | null
  oportunidade_categorias: { nome: string; slug: string } | { nome: string; slug: string }[] | null
  oportunidade_formatos: { nome: string; slug: string } | { nome: string; slug: string }[] | null
}

function numeroOuNulo(valor: number | string | null): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

export async function listarCategoriasDeOportunidade(incluirInativas = false): Promise<CategoriaDeOportunidade[]> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('oportunidade_categorias')
    .select('id, nome, slug, ativo, ordem')
    .order('ordem')
    .order('nome')
  if (!incluirInativas) consulta = consulta.eq('ativo', true)

  const { data, error } = await consulta
  if (error) {
    console.error('Falha ao listar categorias de oportunidade:', error.message)
    return []
  }
  return (data ?? []) as CategoriaDeOportunidade[]
}

export async function listarFormatosDeOportunidade(incluirInativos = false): Promise<FormatoDeOportunidade[]> {
  const supabase = await criarClienteServidor()
  let consulta = supabase
    .from('oportunidade_formatos')
    .select('id, nome, slug, ativo, ordem')
    .order('ordem')
    .order('nome')
  if (!incluirInativos) consulta = consulta.eq('ativo', true)

  const { data, error } = await consulta
  if (error) {
    console.error('Falha ao listar formatos de oportunidade:', error.message)
    return []
  }
  return (data ?? []) as FormatoDeOportunidade[]
}

export async function listarOportunidadesAtivas(): Promise<OportunidadePublicada[]> {
  const supabase = await criarClienteServidor()
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('oportunidades')
    .select('id, programa_id, categoria_id, formato_id, tipo_exibicao, data_evento, data_inicio, data_fim, expira_em, prazo_envio_pi, sigla, valor_acao, direitos_conexos, custo_producao_tipo, custo_producao, titulo, descricao, imagem_url, criado_por, criado_por_nome, programas(nome, mnemonico), oportunidade_categorias(nome, slug), oportunidade_formatos(nome, slug)')
    .eq('ativo', true)
    .gte('expira_em', hoje)
    .order('data_evento')
    .order('data_inicio')

  if (error) {
    console.error('Falha ao listar oportunidades:', error.message)
    return []
  }

  const linhas = (data ?? []) as LinhaOportunidade[]
  return Promise.all(linhas.map(async (linha) => {
    const programa = Array.isArray(linha.programas) ? linha.programas[0] : linha.programas
    const categoria = Array.isArray(linha.oportunidade_categorias)
      ? linha.oportunidade_categorias[0]
      : linha.oportunidade_categorias
    const formato = Array.isArray(linha.oportunidade_formatos)
      ? linha.oportunidade_formatos[0]
      : linha.oportunidade_formatos
    const tipoExibicao: TipoExibicaoDaOportunidade = linha.tipo_exibicao === 'periodo' ? 'periodo' : 'data_unica'
    const inventarioAplicavel = tipoExibicao === 'data_unica' && Boolean(linha.data_evento)
    const inventario = inventarioAplicavel && linha.data_evento
      ? await carregarInventarioDaOportunidade(linha.programa_id, linha.data_evento)
      : { slotsLivres: 0, slotsTotal: 0, slotsOcupados: 0, setoresCompradores: [] as string[] }

    return {
      id: linha.id,
      programaId: linha.programa_id,
      programaNome: programa?.nome ?? 'Programa',
      categoriaId: linha.categoria_id,
      categoriaNome: categoria?.nome ?? 'Outras',
      categoriaSlug: categoria?.slug ?? 'outras',
      formatoId: linha.formato_id,
      formatoNome: formato?.nome ?? 'Formato não informado',
      formatoSlug: formato?.slug ?? 'nao-informado',
      tipoExibicao,
      dataISO: linha.data_evento ?? linha.data_inicio ?? '',
      dataInicio: linha.data_inicio,
      dataFim: linha.data_fim,
      expiraEm: linha.expira_em,
      prazoEnvioPi: linha.prazo_envio_pi,
      sigla: linha.sigla ?? programa?.mnemonico ?? '',
      valorAcao: numeroOuNulo(linha.valor_acao),
      direitosConexos: numeroOuNulo(linha.direitos_conexos),
      custoProducaoTipo: linha.custo_producao_tipo === 'sob_consulta' ? 'sob_consulta' : 'valor',
      custoProducao: numeroOuNulo(linha.custo_producao),
      titulo: linha.titulo,
      descricao: linha.descricao,
      imagem: linha.imagem_url,
      autor: linha.criado_por_nome,
      criadoPor: linha.criado_por,
      inventarioAplicavel,
      slotsLivres: inventario.slotsLivres,
      slotsTotal: inventario.slotsTotal,
      slotsOcupados: inventario.slotsOcupados,
      setoresCompradores: inventario.setoresCompradores,
    }
  }))
}