import { redirect } from 'next/navigation'

/** Compatibilidade: Setor e indústria são contexto automático do cliente. */
export default function PassoSetorLegado() {
  redirect('/consulta')
}
