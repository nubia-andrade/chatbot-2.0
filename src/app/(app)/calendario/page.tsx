import { CalendarioGloboSlots } from '@/components/oportunidades/CalendarioGloboSlots'
import { listarOportunidadesAtivas } from '@/lib/dados/oportunidades'

export default async function PaginaCalendario() {
  const oportunidades = await listarOportunidadesAtivas()
  return <CalendarioGloboSlots oportunidades={oportunidades} />
}
