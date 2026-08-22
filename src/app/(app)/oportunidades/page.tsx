import { redirect } from 'next/navigation'
import { OportunidadesGloboSlots } from '@/components/oportunidades/OportunidadesGloboSlots'
import { listarProgramas } from '@/lib/dados/programas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'

export default async function PaginaOportunidades() {
  const [sessao, programas] = await Promise.all([obterSessao(), listarProgramas()])
  if (!sessao) redirect('/login')

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  const programasVisiveis = programas
    .filter((programa) => programa.estado !== 'inativo')
    .filter((programa) => proprietario || !consultor || sessao.programasVinculados.includes(programa.id))
    .map((programa) => ({ id: programa.id, nome: programa.nome }))

  return <OportunidadesGloboSlots nomeUsuario={sessao.nome} programas={programasVisiveis} />
}
