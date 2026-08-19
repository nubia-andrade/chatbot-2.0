import { redirect } from 'next/navigation'

/** Histórico deixou de ser uma seção principal; rastreabilidade vive na proposta. */
export default function PaginaHistorico() {
  redirect('/propostas')
}
