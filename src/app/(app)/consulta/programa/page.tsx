import { redirect } from 'next/navigation'

/** Compatibilidade: Programa e modalidade agora fazem parte da etapa Contexto. */
export default function PassoProgramaLegado() {
  redirect('/consulta')
}
