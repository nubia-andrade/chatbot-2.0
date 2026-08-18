'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeEditarPrograma } from '../dominio/perfis'

const BUCKET = 'programas'
const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024

function autorizado(
  perfis: string[],
  programasVinculados: string[],
  programaId: string,
): boolean {
  return podeEditarPrograma(perfis, programasVinculados, programaId)
}

function extensaoDe(nome: string): 'png' | 'jpg' {
  return nome.toLowerCase().endsWith('.png') ? 'png' : 'jpg'
}

function caminhoPublicoDaUrl(url: string): string | null {
  const marcador = `/storage/v1/object/public/${BUCKET}/`
  const indice = url.indexOf(marcador)
  if (indice < 0) return null
  return decodeURIComponent(url.slice(indice + marcador.length))
}

export async function adicionarSlideAoModelo(
  programaId: string,
  formulario: FormData,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!autorizado(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: 'Você não tem permissão para alterar o modelo deste programa.' }
  }

  const arquivo = formulario.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha uma imagem para o slide.' }
  }
  if (!['image/png', 'image/jpeg'].includes(arquivo.type)) {
    return { erro: 'Use uma imagem PNG ou JPG para o slide.' }
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { erro: 'A imagem passa de 8 MB. Reduza o arquivo e tente de novo.' }
  }

  const supabase = await criarClienteServidor()
  const { data: ultimo } = await supabase
    .from('programa_modelo_slides')
    .select('ordem')
    .eq('programa_id', programaId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  const ordem = (ultimo?.ordem ?? 0) + 1
  const caminho = `modelos/${programaId}/${crypto.randomUUID()}.${extensaoDe(arquivo.name)}`
  const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  })

  if (erroUpload) {
    return { erro: `Não foi possível enviar a imagem: ${erroUpload.message}` }
  }

  const { data: publico } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  const { error: erroRegistro } = await supabase.from('programa_modelo_slides').insert({
    programa_id: programaId,
    imagem_url: publico.publicUrl,
    ordem,
  })

  if (erroRegistro) {
    await supabase.storage.from(BUCKET).remove([caminho])
    return { erro: `Não foi possível adicionar o slide: ${erroRegistro.message}` }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/modelo`)
  return { erro: null }
}

export async function moverSlideDoModelo(
  programaId: string,
  slideId: string,
  direcao: 'subir' | 'descer',
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!autorizado(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: 'Você não tem permissão para alterar o modelo deste programa.' }
  }

  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('programa_modelo_slides')
    .select('id, ordem')
    .eq('programa_id', programaId)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })

  if (error) return { erro: 'Não foi possível carregar a ordem dos slides.' }
  const slides = data ?? []
  const indice = slides.findIndex((slide) => slide.id === slideId)
  if (indice < 0) return { erro: 'Slide não encontrado.' }

  const destino = direcao === 'subir' ? indice - 1 : indice + 1
  if (destino < 0 || destino >= slides.length) return { erro: null }

  // Renumera a sequência inteira para evitar colisões e manter uma ordem simples.
  const novaOrdem = [...slides]
  ;[novaOrdem[indice], novaOrdem[destino]] = [novaOrdem[destino], novaOrdem[indice]]

  for (let i = 0; i < novaOrdem.length; i += 1) {
    const { error: erroAtualizar } = await supabase
      .from('programa_modelo_slides')
      .update({ ordem: i + 1, atualizado_em: new Date().toISOString() })
      .eq('id', novaOrdem[i].id)
      .eq('programa_id', programaId)
    if (erroAtualizar) return { erro: 'Não foi possível reordenar os slides.' }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/modelo`)
  return { erro: null }
}

export async function removerSlideDoModelo(
  programaId: string,
  slideId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: 'Sua sessão expirou. Entre de novo.' }
  if (!autorizado(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: 'Você não tem permissão para alterar o modelo deste programa.' }
  }

  const supabase = await criarClienteServidor()
  const { data: slide } = await supabase
    .from('programa_modelo_slides')
    .select('imagem_url')
    .eq('id', slideId)
    .eq('programa_id', programaId)
    .maybeSingle()

  const { error } = await supabase
    .from('programa_modelo_slides')
    .delete()
    .eq('id', slideId)
    .eq('programa_id', programaId)

  if (error) return { erro: 'Não foi possível remover o slide.' }

  const caminho = slide?.imagem_url ? caminhoPublicoDaUrl(slide.imagem_url) : null
  if (caminho) await supabase.storage.from(BUCKET).remove([caminho])

  // Normaliza as posições restantes.
  const { data: restantes } = await supabase
    .from('programa_modelo_slides')
    .select('id')
    .eq('programa_id', programaId)
    .order('ordem', { ascending: true })
    .order('criado_em', { ascending: true })

  for (let i = 0; i < (restantes ?? []).length; i += 1) {
    await supabase
      .from('programa_modelo_slides')
      .update({ ordem: i + 1, atualizado_em: new Date().toISOString() })
      .eq('id', restantes![i].id)
  }

  revalidatePath(`/configuracoes/programas/${programaId}/modelo`)
  return { erro: null }
}
