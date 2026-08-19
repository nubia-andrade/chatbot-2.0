import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'

export default async function LayoutHistorico({ children }: { children: React.ReactNode }) {
  await exigirAcessoASecao('historico')
  return children
}
