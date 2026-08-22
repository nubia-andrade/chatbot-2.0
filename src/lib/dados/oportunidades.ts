import { criarClienteServidor } from '../supabase/cliente-servidor'
import { carregarInventarioDaOportunidade } from './inventario-oportunidades'

export type CategoriaDeOportunidade = {
  id: string
  nome: string
  slug: string
  ativo: boolean
  ordem: number
}

export type OportunidadePublicada = {
  id: string
  programaId: string
  programaNome: string
  categoriaId: string
  categoriaNome: string
  categoriaSlug: string
  dataISO: string
  expiraEm: string
  titulo: string
  descricao: string
  imagem: string | null
  autor: string
  slotsLivres: number
  slotsTotal: number
  slotsOcupados: number
  setoresCompradores: string[]
}

type LinhaOportunidade = {
  id: string
  programa_id: string
  categoria_id: string
  data_evento: string
  expira_em: string
  titulo: string
  descricao: string
  imagem_url: string | null
  criado_por_nome: string
  programas: { nome: string } | { nome: string }[] | null
  oportunidade_categorias: { nome: string; slug: string } | { nome: string; slug: string }[] | null
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

export async function listarOportunidadesAtivas(): Promise<OportunidadePublicada[]> {
  const supabase = await criarClienteServidor()
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('oportunidades')
    .select('id, programa_id, categoria_id, data_evento, expira_em, titulo, descricao, imagem_url, criado_por_nome, programas(nome), oportunidade_categorias(nome, slug)')
    .eq('ativo', true)
    .gte('expira_em', hoje)
    .order('data_evento')

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
    const inventario = await carregarInventarioDaOportunidade(linha.programa_id, linha.data_evento)
    return {
      id: linha.id,
      programaId: linha.programa_id,
      programaNome: programa?.nome ?? 'Programa',
      categoriaId: linha.categoria_id,
      categoriaNome: categoria?.nome ?? 'Outras',
      categoriaSlug: categoria?.slug ?? 'outras',
      dataISO: linha.data_evento,
      expiraEm: linha.expira_em,
      titulo: linha.titulo,
      descricao: linha.descricao,
      imagem: linha.imagem_url,
      autor: linha.criado_por_nome,
      slotsLivres: inventario.slotsLivres,
      slotsTotal: inventario.slotsTotal,
      slotsOcupados: inventario.slotsOcupados,
      setoresCompradores: inventario.setoresCompradores,
    }
  }))
}
