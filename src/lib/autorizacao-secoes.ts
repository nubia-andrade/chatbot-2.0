import 'server-only'
import { redirect } from 'next/navigation'
import { obterSessao } from './sessao-servidor'
import { podeAcessarSecao, type SecaoApp } from './dominio/perfis'

export async function exigirAcessoASecao(secao: SecaoApp) {
  const sessao = await obterSessao()
  if (!sessao) redirect('/login')
  if (!podeAcessarSecao(sessao.secoes, secao)) redirect('/inicio')
  return sessao
}
