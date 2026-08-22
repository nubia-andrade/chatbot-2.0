'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeAdministrarGovernancaGlobal } from '../dominio/perfis'

function slugDe(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function criarFormatoDeOportunidade(formData: FormData) {
  const sessao = await obterSessao()
  if (!sessao || !podeAdministrarGovernancaGlobal(sessao.perfis)) return
  const nome = String(formData.get('nome') ?? '').trim()
  if (!nome || nome.length > 80) return
  const slug = slugDe(nome)
  if (!slug) return

  const supabase = await criarClienteServidor()
  const { data: existentes } = await supabase
    .from('oportunidade_formatos')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
  const ordem = Number(existentes?.[0]?.ordem ?? 0) + 10

  await supabase.from('oportunidade_formatos').insert({
    nome,
    slug,
    ordem,
    ativo: true,
    criado_por: sessao.usuarioId,
    atualizado_em: new Date().toISOString(),
  })
  revalidatePath('/configuracoes/formatos-oportunidades')
  revalidatePath('/oportunidades')
}

export async function alternarFormatoDeOportunidade(formData: FormData) {
  const sessao = await obterSessao()
  if (!sessao || !podeAdministrarGovernancaGlobal(sessao.perfis)) return
  const id = String(formData.get('id') ?? '')
  const ativo = String(formData.get('ativo') ?? '') === 'true'
  if (!id) return

  const supabase = await criarClienteServidor()
  await supabase
    .from('oportunidade_formatos')
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/configuracoes/formatos-oportunidades')
  revalidatePath('/oportunidades')
}
