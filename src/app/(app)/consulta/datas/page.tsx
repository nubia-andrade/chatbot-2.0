import { redirect } from 'next/navigation'

/**
 * Rota mantida apenas por compatibilidade com links/sessões anteriores.
 * A seleção de datas agora acontece dentro do próprio Calendário.
 */
export default function PassoDatasLegado() {
  redirect('/consulta/resumo')
}
