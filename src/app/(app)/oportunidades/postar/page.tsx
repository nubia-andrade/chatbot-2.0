import { redirect } from 'next/navigation'
import { OportunidadesGloboSlots } from '@/components/oportunidades/OportunidadesGloboSlots'
import { listarCategoriasDeOportunidade } from '@/lib/dados/oportunidades'
import { listarProgramas } from '@/lib/dados/programas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'

export default async function PaginaPostarOportunidade() {
  const [sessao, programas, categorias] = await Promise.all([
    obterSessao(),
    listarProgramas(),
    listarCategoriasDeOportunidade(),
  ])
  if (!sessao) redirect('/login')

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  if (!proprietario && !consultor) redirect('/oportunidades')

  const programasVisiveis = programas
    .filter((programa) => programa.estado !== 'inativo')
    .filter((programa) => proprietario || sessao.programasVinculados.includes(programa.id))
    .map((programa) => ({ id: programa.id, nome: programa.nome }))

  return (
    <OportunidadesGloboSlots
      nomeUsuario={sessao.nome}
      programas={programasVisiveis}
      categorias={categorias}
      oportunidadesIniciais={[]}
      modoInicial="postar"
    />
  )
}
