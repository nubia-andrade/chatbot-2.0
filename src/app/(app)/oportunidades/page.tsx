import { redirect } from 'next/navigation'
import { OportunidadesGloboSlots } from '@/components/oportunidades/OportunidadesGloboSlots'
import { listarCategoriasDeOportunidade, listarFormatosDeOportunidade, listarOportunidadesAtivas } from '@/lib/dados/oportunidades'
import { listarProgramas } from '@/lib/dados/programas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'

export default async function PaginaOportunidades() {
  const [sessao, programas, categorias, formatos, oportunidades] = await Promise.all([
    obterSessao(),
    listarProgramas(),
    listarCategoriasDeOportunidade(),
    listarFormatosDeOportunidade(),
    listarOportunidadesAtivas(),
  ])
  if (!sessao) redirect('/login')

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  const programasVisiveis = programas
    .filter((programa) => programa.estado !== 'inativo')
    .filter((programa) => proprietario || !consultor || sessao.programasVinculados.includes(programa.id))
    .map((programa) => ({ id: programa.id, nome: programa.nome, mnemonico: programa.mnemonico }))

  return (
    <OportunidadesGloboSlots
      nomeUsuario={sessao.nome}
      programas={programasVisiveis}
      categorias={categorias}
      formatos={formatos}
      oportunidadesIniciais={oportunidades}
    />
  )
}
