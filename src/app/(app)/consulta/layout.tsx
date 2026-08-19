import type { ReactNode } from 'react'
import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'
import { LayoutConsultaCliente } from '@/components/consulta/LayoutConsultaCliente'

/** Shell do wizard + guarda de autorização da seção Nova consulta. */
export default async function LayoutConsulta({ children }: { children: ReactNode }) {
  await exigirAcessoASecao('consulta')
  return <LayoutConsultaCliente>{children}</LayoutConsultaCliente>
}
