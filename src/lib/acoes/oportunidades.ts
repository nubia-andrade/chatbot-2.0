'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { carregarInventarioDaOportunidade, type InventarioDaOportunidade } from '../dados/inventario-oportunidades'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

const BUCKET = 'oportunidades'
const TAMANHO_MAXIMO = 5 * 1024 * 1024

export async function consultarInventarioDaOportunidade(programaId: string, dataISO: string): Promise<InventarioDaOportunidade> {
  const sessao = await obterSessao()
  if (!sessao) return { slotsTotal: 0, slotsOcupados: 0, slotsLivres: 0, setoresCompradores: [], erro: 'Sua sessão expirou.' }
  return carregarInventarioDaOportunidade(programaId, dataISO)
}

function extensao(nome: string) {
  const valor = nome.split('.').pop()?.toLowerCase() ?? 'img'
  return /^[a-z0-9]{1,5}$/.test(valor) ? valor : 'img'
}

export async function publicarOportunidade(formulario: FormData): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.' }

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  if (!proprietario && !consultor) return { ok: false, erro: 'Você não tem permissão para publicar oportunidades.' }

  const programaId = String(formulario.get('programaId') ?? '').trim()
  const categoriaId = String(formulario.get('categoriaId') ?? '').trim()
  const dataISO = String(formulario.get('dataISO') ?? '').trim()
  const expiraEm = String(formulario.get('expiraEm') ?? '').trim()
  const titulo = String(formulario.get('titulo') ?? '').trim()
  const descricao = String(formulario.get('descricao') ?? '').trim()

  if (!programaId || (!proprietario && !sessao.programasVinculados.includes(programaId))) return { ok: false, erro: 'Escolha um programa que você administra.' }
  if (!categoriaId) return { ok: false, erro: 'Escolha uma categoria.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return { ok: false, erro: 'Escolha a data do evento.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiraEm)) return { ok: false, erro: 'Escolha a data de expiração.' }
  if (!titulo || titulo.length > 160) return { ok: false, erro: 'O título deve ter entre 1 e 160 caracteres.' }
  if (!descricao || descricao.length > 300) return { ok: false, erro: 'A descrição deve ter entre 1 e 300 caracteres.' }

  const hoje = new Date().toISOString().slice(0, 10)
  if (dataISO < hoje) return { ok: false, erro: 'A data do evento não pode estar no passado.' }
  if (expiraEm < hoje) return { ok: false, erro: 'A data de expiração não pode estar no passado.' }
  if (expiraEm > dataISO) return { ok: false, erro: 'A oportunidade deve expirar até, no máximo, a data do evento.' }

  const supabase = await criarClienteServidor()
  const categoria = await supabase.from('oportunidade_categorias').select('id').eq('id', categoriaId).eq('ativo', true).maybeSingle()
  if (categoria.error || !categoria.data) return { ok: false, erro: 'A categoria escolhida não está disponível.' }

  const inventario = await carregarInventarioDaOportunidade(programaId, dataISO)
  if (inventario.erro) return { ok: false, erro: inventario.erro }
  if (inventario.slotsLivres <= 0) return { ok: false, erro: 'Esta data está sem slots livres. Escolha outra data.' }

  let imagemUrl: string | null = null
  const arquivo = formulario.get('imagem')
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!arquivo.type.startsWith('image/')) return { ok: false, erro: 'A imagem deve ser PNG, JPG ou WEBP.' }
    if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: 'A imagem passa de 5 MB.' }
    const caminho = `${sessao.usuarioId}/${crypto.randomUUID()}.${extensao(arquivo.name)}`
    const upload = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
    if (upload.error) return { ok: false, erro: `Não foi possível enviar a imagem: ${upload.error.message}` }
    imagemUrl = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
  }

  const insercao = await supabase.from('oportunidades').insert({
    programa_id: programaId,
    categoria_id: categoriaId,
    data_evento: dataISO,
    expira_em: expiraEm,
    titulo,
    descricao,
    imagem_url: imagemUrl,
    criado_por: sessao.usuarioId,
    criado_por_nome: sessao.nome,
    ativo: true,
  }).select('id').single()

  if (insercao.error) return { ok: false, erro: `Não foi possível publicar: ${insercao.error.message}` }
  revalidatePath('/oportunidades')
  revalidatePath('/calendario')
  return { ok: true, id: insercao.data.id as string }
}
