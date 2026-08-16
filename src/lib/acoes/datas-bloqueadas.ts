'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeEditarPrograma } from '../dominio/perfis'

/**
 * Cadastro de datas bloqueadas — Task 11.
 *
 * A permissão é conferida aqui (para o erro sair em português) e de novo no
 * banco pela policy "escrita consultor" de `datas_bloqueadas`
 * (`supabase/schema-entrega-2.sql`): consultor só grava no programa a que
 * está vinculado, proprietário em todos.
 */

const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para alterar datas bloqueadas deste programa.'

function formatarDataBR(iso: string): string {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return iso
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getUTCFullYear()}`
}

function ehViolacaoDeUnicidade(mensagem: string, codigo: string | undefined): boolean {
  return codigo === '23505' || mensagem.toLowerCase().includes('duplicate')
}

/**
 * Bloqueia um lote de datas de uma vez, todas com o mesmo motivo.
 *
 * Tenta gravar o lote inteiro numa única inserção — o caminho comum, sem
 * conflito. Se o banco recusar (uma das datas já estava bloqueada, pela
 * unicidade `(programa_id, data)`), regrava uma a uma para salvar o que der
 * e devolve, por data, qual não entrou — por isso a assinatura devolve uma
 * LISTA de erros, e não um só: um lote de 5 datas em que 1 já estava
 * bloqueada ainda bloqueia as outras 4.
 */
export async function bloquearDatas(
  programaId: string,
  datas: string[],
  motivo: string,
): Promise<{ erros: string[] }> {
  const sessao = await obterSessao()
  if (!sessao) return { erros: [ERRO_SESSAO_EXPIRADA] }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erros: [ERRO_SEM_PERMISSAO] }
  }

  const motivoLimpo = motivo.trim()
  if (motivoLimpo === '') return { erros: ['Informe o motivo do bloqueio.'] }

  const datasUnicas = [...new Set(datas)]
  if (datasUnicas.length === 0) return { erros: ['Selecione ao menos uma data no calendário.'] }

  const supabase = await criarClienteServidor()

  const { error: erroDoLote } = await supabase
    .from('datas_bloqueadas')
    .insert(datasUnicas.map((data) => ({ programa_id: programaId, data, motivo: motivoLimpo })))

  if (!erroDoLote) {
    revalidatePath(`/configuracoes/programas/${programaId}/datas`)
    return { erros: [] }
  }

  const erros: string[] = []
  for (const data of datasUnicas) {
    const { error } = await supabase
      .from('datas_bloqueadas')
      .insert({ programa_id: programaId, data, motivo: motivoLimpo })

    if (error) {
      erros.push(
        ehViolacaoDeUnicidade(error.message, error.code)
          ? `${formatarDataBR(data)}: já estava bloqueada.`
          : `${formatarDataBR(data)}: não foi possível gravar.`,
      )
    }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/datas`)
  return { erros }
}

/** Remove um único bloqueio de data — a linha "Desbloquear" da listagem. */
export async function desbloquearData(programaId: string, data: string): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: ERRO_SEM_PERMISSAO }
  }

  const supabase = await criarClienteServidor()

  const { error, count } = await supabase
    .from('datas_bloqueadas')
    .delete({ count: 'exact' })
    .eq('programa_id', programaId)
    .eq('data', data)

  if (error) return { erro: 'Não foi possível desbloquear a data. Tente novamente.' }

  // DELETE barrado pelo RLS volta sem erro e sem linhas — sem conferir, a
  // tela diria "desbloqueada" com o registro ainda no banco.
  if (!count) return { erro: 'O banco não deixou desbloquear. Confira sua permissão neste programa.' }

  revalidatePath(`/configuracoes/programas/${programaId}/datas`)
  return { erro: null }
}
