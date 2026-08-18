import { InicioDaConsulta } from '@/components/consulta/InicioDaConsulta'
import { listarProgramas } from '@/lib/dados/programas'

export default async function PaginaConsulta() {
  const programas = (await listarProgramas())
    .filter(
      (programa) =>
        programa.estado === 'ativo' &&
        programa.disponivel_para_proposta
    )
    .map((programa) => ({
      id: programa.id,
      nome: programa.nome,
      canal: programa.canal,
      aceita_regional: programa.aceita_regional,
    }))

  return <InicioDaConsulta programas={programas} />
}