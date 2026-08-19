import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'

export default async function LayoutPropostas({ children }: { children: React.ReactNode }) {
  await exigirAcessoASecao('propostas')
  return children
}
