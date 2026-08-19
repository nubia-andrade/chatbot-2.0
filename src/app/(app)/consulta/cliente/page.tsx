import { redirect } from 'next/navigation'

/** Compatibilidade: Cliente agora faz parte da etapa Contexto. */
export default function PassoClienteLegado() {
  redirect('/consulta')
}
