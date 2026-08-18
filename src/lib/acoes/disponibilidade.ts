'use server'

import { carregarDisponibilidade, type ResultadoDeDisponibilidade } from '../dados/disponibilidade'
import { obterSessao } from '../sessao-servidor'
import { podeConsultarRegional } from '../dominio/perfis'
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
 *
 * **Achado Important da revisão da Task 12:** uma Server Action é um
 * endpoint POST alcançável por qualquer requisição com a `Origin` certa —
 * "a tela esconde a opção regional de quem não tem o perfil" (`PassoPrograma.tsx`)
 * é conveniência, não proteção. Sem a checagem abaixo, `modalidade: 'regional'`
 * postado direto para esta ponte devolvia `dia.pracas[].cliente_nome` (quem
 * comprou cada praça) e `valor_unitario`/`precosRegionais` a QUALQUER usuário
 * autenticado, regional ou não — a mesma proteção que `gravarConsulta`
 * (`consultas.ts:191-199`) já aplica antes de gravar. Espelha essa checagem
 * linha a linha, inclusive as mensagens de erro, para as duas pontas do
 * wizard (ler disponibilidade e gravar a consulta) tratarem "sem permissão
 * regional" da mesma forma.
 */

const ERRO_SESSAO_EXPIRADA = 'Sessão expirada. Entre de novo.'
const ERRO_SEM_PERMISSAO_REGIONAL = 'Você não tem permissão para consultar disponibilidade regional.'

export async function carregarDisponibilidadeDoCalendario(params: {
  programaId: string
  clienteId: string
  modalidade: Modalidade
  ano: number
  mes: number
}): Promise<ResultadoDeDisponibilidade> {
  // 1. Sem sessão, nada acontece — mesmo formato de `gravarConsulta`.
  const sessao = await obterSessao()
  if (!sessao) {
    return { dias: [], programa: null, erro: ERRO_SESSAO_EXPIRADA, precosRegionais: [] }
  }

  // 2. Regional exige o perfil — esconder a modalidade na tela (`PassoPrograma.tsx`)
  // é conveniência, isto é a proteção real.
  if (params.modalidade === 'regional' && !podeConsultarRegional(sessao.perfis)) {
    return { dias: [], programa: null, erro: ERRO_SEM_PERMISSAO_REGIONAL, precosRegionais: [] }
  }

  return carregarDisponibilidade(params)
}
