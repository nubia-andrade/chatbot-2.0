'use server'

import { carregarDisponibilidade, type ResultadoDeDisponibilidade } from '../dados/disponibilidade'
import type { Modalidade } from '../dominio/disponibilidade'

/**
 * Ponte de Server Action para `carregarDisponibilidade` (Task 8) — Task 12.
 *
 * `carregarDisponibilidade` usa `criarClienteServidor`, que depende de
 * `cookies()` (`next/headers`) e só roda no servidor. A tela do calendário
 * (passo 4 do wizard) é um Client Component — o provider do wizard e a
 * navegação de mês só existem no navegador (`ProvedorDaConsulta.tsx`) — e
 * precisa recarregar a disponibilidade a cada troca de mês/cliente/programa,
 * então não dá pra buscar isso uma vez só num Server Component ancestral,
 * como `programa/page.tsx` faz com `listarProgramas`.
 *
 * Uma Server Action resolve isso: o corpo roda no servidor (cookies
 * inclusos), mas quem chama é o navegador — o mesmo mecanismo que
 * `gravarConsulta` (`consultas.ts`) já usa para o passo final do wizard.
 * Não reimplementa nada de `carregarDisponibilidade`: só repassa os
 * parâmetros.
 */
export async function carregarDisponibilidadeDoCalendario(params: {
  programaId: string
  clienteId: string
  modalidade: Modalidade
  ano: number
  mes: number
}): Promise<ResultadoDeDisponibilidade> {
  return carregarDisponibilidade(params)
}
