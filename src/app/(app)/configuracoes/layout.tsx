import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'

export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  await exigirAcessoASecao('configuracoes')
  return children
}
