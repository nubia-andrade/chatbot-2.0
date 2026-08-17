import { obterSessao } from '@/lib/sessao-servidor'
import { listarProgramas } from '@/lib/dados/programas'
import { podeConsultarRegional } from '@/lib/dominio/perfis'
import { PassoPrograma } from '@/components/consulta/PassoPrograma'

/**
 * Passo 3 — Programa e modalidade (tela 1d do handoff). Task 11.
 *
 * Server Component: é o único lugar que pode chamar `listarProgramas` e
 * `obterSessao` (dependem de `next/headers`, então não rodam num Client
 * Component). O provider do wizard e a guarda do passo só existem no
 * navegador, então a tela em si — e a checagem R13 do cliente escolhido —
 * fica em `PassoPrograma`, um Client Component que recebe os dados prontos.
 *
 * Só entram na grade os programas `ativo` e `disponivel_para_proposta` —
 * um programa inativo ou ainda em configuração não tem preço nem regra
 * pronta para sustentar uma proposta.
 */
export default async function PaginaPrograma() {
  const [sessao, programas] = await Promise.all([obterSessao(), listarProgramas()])

  const disponiveis = programas.filter(
    (programa) => programa.estado === 'ativo' && programa.disponivel_para_proposta,
  )

  return (
    <PassoPrograma
      programas={disponiveis}
      temPerfilRegional={podeConsultarRegional(sessao?.perfis ?? [])}
    />
  )
}
