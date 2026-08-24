import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'

export default async function LayoutOportunidades({ children }: { children: React.ReactNode }) {
  await exigirAcessoASecao('oportunidades')
  return children
}
