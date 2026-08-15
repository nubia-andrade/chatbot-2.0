'use server'

import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao, podeAdministrar } from '../sessao-servidor'

/**
 * Upload da imagem do programa para o Supabase Storage.
 *
 * Roda no servidor, com a sessão de quem está logado — nunca com a chave de
 * serviço. A permissão é conferida aqui para o erro sair em português e, de
 * novo, pelas policies de `storage.objects` em `supabase/schema.sql`, que
 * são a proteção real.
 *
 * O bucket `programas` é público na leitura (a imagem aparece na lista de
 * cadastro e, na Entrega 3, na proposta) e restrito a administradores na
 * escrita. Ele é criado pelo `schema.sql`; se não existir, esta função diz
 * exatamente isso em vez de falhar em silêncio.
 */

const BUCKET = 'programas'
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024

const ERRO_SEM_PERMISSAO = 'Você não tem permissão para enviar imagens de programa.'
const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
const ERRO_BUCKET_AUSENTE =
  'O espaço de armazenamento das imagens ainda não existe neste projeto do Supabase. ' +
  'Rode o supabase/schema.sql de novo ou crie o bucket "programas" (público) em ' +
  'Storage > New bucket — o README explica o passo a passo. Enquanto isso, dá para colar ' +
  'a URL de uma imagem já hospedada no campo abaixo.'

/** Extensão a partir do nome do arquivo, sem confiar no que veio do navegador. */
function extensaoDe(nome: string): string {
  const posicao = nome.lastIndexOf('.')
  if (posicao === -1) return 'img'
  const extensao = nome.slice(posicao + 1).toLowerCase()
  return /^[a-z0-9]{1,5}$/.test(extensao) ? extensao : 'img'
}

export async function enviarImagemDePrograma(
  formulario: FormData,
): Promise<{ url: string | null; erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { url: null, erro: ERRO_SESSAO_EXPIRADA }
  if (!podeAdministrar(sessao)) return { url: null, erro: ERRO_SEM_PERMISSAO }

  const arquivo = formulario.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { url: null, erro: 'Escolha um arquivo de imagem.' }
  }
  if (!arquivo.type.startsWith('image/')) {
    return { url: null, erro: 'O arquivo precisa ser uma imagem (PNG, JPG ou WEBP).' }
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return { url: null, erro: 'A imagem passa de 5 MB. Reduza o arquivo e tente de novo.' }
  }

  const supabase = await criarClienteServidor()

  // Nome sorteado: dois programas com arquivos de mesmo nome não se
  // sobrescrevem, e o nome original (que pode ter acento, espaço ou barra)
  // não vira caminho no bucket.
  const caminho = `${crypto.randomUUID()}.${extensaoDe(arquivo.name)}`

  const { error } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, {
    contentType: arquivo.type,
    upsert: false,
  })

  if (error) {
    const mensagem = error.message.toLowerCase()
    if (mensagem.includes('bucket not found') || mensagem.includes('not found')) {
      return { url: null, erro: ERRO_BUCKET_AUSENTE }
    }
    if (
      mensagem.includes('row-level security') ||
      mensagem.includes('unauthorized') ||
      mensagem.includes('policy')
    ) {
      return {
        url: null,
        erro:
          'O armazenamento não deixou gravar. Confira se você tem permissão de administrador e ' +
          'se as policies de storage do supabase/schema.sql já foram aplicadas.',
      }
    }
    return { url: null, erro: `Não foi possível enviar a imagem: ${error.message}` }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(caminho)
  return { url: data.publicUrl, erro: null }
}
