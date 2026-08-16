'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeEditarPrograma } from '../dominio/perfis'
import { restricaoQueBloqueia, type Restricao as RegraDeRestricao } from '../dominio/restricoes'
import { lerPaginado } from '../dados/paginacao'

/**
 * Cadastro de restrições de anunciante — Task 11.
 *
 * A permissão é conferida aqui (para o erro sair em português) e de novo no
 * banco pela policy "escrita consultor" de `restricoes_anunciante`
 * (`supabase/schema-entrega-2.sql`).
 */

export type DadosDeRestricao = {
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para alterar restrições deste programa.'

/**
 * Mesma regra do `check` de `restricoes_anunciante`: ao menos um entre
 * anunciante, setor e indústria precisa estar preenchido — validado aqui
 * ANTES de gravar, para o erro sair em português e com o formulário
 * preenchido, e não como uma constraint violada devolvida crua pelo banco.
 */
function validar(dados: Partial<DadosDeRestricao>): string[] {
  const erros: string[] = []

  if (!dados.motivo || dados.motivo.trim() === '') {
    erros.push('Informe o motivo da restrição.')
  }

  const temAlvo = Boolean(
    dados.anunciante?.trim() || dados.setor?.trim() || dados.industria?.trim(),
  )
  if (!temAlvo) {
    erros.push('Escolha um anunciante, um setor e indústria, ou uma categoria.')
  }

  return erros
}

/**
 * Grava uma restrição nova — o formulário não edita, só cria.
 *
 * Devolve o `id` gerado pelo banco para a lista da tela poder oferecer
 * "Excluir" na restrição recém-criada sem recarregar a página. Sem ele, a
 * linha nova ficaria com um id inventado no navegador e o botão de exclusão
 * não acharia nada para apagar — justamente no momento em que a exclusão é
 * mais provável: logo depois de cadastrar errado.
 */
export async function salvarRestricao(
  programaId: string,
  dados: Partial<DadosDeRestricao>,
): Promise<{ erros: string[]; id: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erros: [ERRO_SESSAO_EXPIRADA], id: null }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erros: [ERRO_SEM_PERMISSAO], id: null }
  }

  const erros = validar(dados)
  if (erros.length > 0) return { erros, id: null }

  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('restricoes_anunciante')
    .insert({
      programa_id: programaId,
      anunciante: dados.anunciante?.trim() || null,
      setor: dados.setor?.trim() || null,
      industria: dados.industria?.trim() || null,
      motivo: dados.motivo!.trim(),
    })
    .select('id')

  if (error) {
    return { erros: ['Não foi possível gravar a restrição. Tente novamente.'], id: null }
  }

  // INSERT barrado pelo RLS volta sem erro e sem linhas — sem conferir, a tela
  // diria "salva" e a restrição não estaria bloqueando nada.
  if (!data || data.length === 0) {
    return {
      erros: ['O banco não deixou gravar. Confira sua permissão neste programa.'],
      id: null,
    }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/restricoes`)
  return { erros: [], id: data[0].id }
}

/**
 * Remove uma restrição cadastrada.
 *
 * Existe porque a alternativa era pior: uma restrição criada por engano
 * bloqueia venda de verdade — o cliente some das datas oferecidas — e, sem
 * esta função, só sairia por acesso direto ao banco. Quem cadastrou não
 * consegue desfazer o próprio erro.
 *
 * Não usa `ConfirmacaoNomeada` (digitar o nome), reservada para a exclusão de
 * programa: apagar uma restrição não destrói dado nenhum além dela mesma e é
 * refazível em dez segundos pelo formulário ao lado. A confirmação em duas
 * etapas da tela é proporcional ao estrago.
 */
export async function excluirRestricao(
  programaId: string,
  restricaoId: string,
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: ERRO_SEM_PERMISSAO }
  }

  const supabase = await criarClienteServidor()

  const { error, count } = await supabase
    .from('restricoes_anunciante')
    .delete({ count: 'exact' })
    .eq('id', restricaoId)
    .eq('programa_id', programaId)

  if (error) return { erro: 'Não foi possível excluir a restrição. Tente novamente.' }

  // DELETE barrado pelo RLS volta sem erro e sem linhas afetadas — sem
  // conferir, a tela diria "excluída" com a restrição ainda bloqueando venda.
  if (!count) return { erro: 'O banco não deixou excluir. Confira sua permissão neste programa.' }

  revalidatePath(`/configuracoes/programas/${programaId}/restricoes`)
  return { erro: null }
}

/**
 * Quantos clientes da carteira uma restrição, ainda não salva, afetaria —
 * o número que a tela mostra antes de habilitar "Salvar". É a diferença
 * entre bloquear uma marca (1 cliente) e bloquear um setor inteiro (pode
 * ser centenas) sem perceber.
 *
 * Roda a mesma regra de decisão de venda (`restricaoQueBloqueia`, Task 5)
 * contra a carteira inteira — não uma aproximação à parte, a regra de
 * verdade, para o número da prévia bater com o efeito real depois de salvo.
 *
 * A carteira tem 15.519 linhas: sem `lerPaginado` (Task de importação,
 * `src/lib/dados/paginacao.ts`), o PostgREST devolveria só as primeiras
 * 1000 e o alcance de uma restrição de setor sairia subestimado sem
 * nenhum aviso — o número mostrado pareceria pequeno e inofensivo quando
 * na verdade é muito maior.
 */
export async function calcularAlcanceDaRestricao(
  dados: Partial<DadosDeRestricao>,
): Promise<{ alcance: number; totalDaCarteira: number; erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { alcance: 0, totalDaCarteira: 0, erro: ERRO_SESSAO_EXPIRADA }

  const temAlvo = Boolean(
    dados.anunciante?.trim() || dados.setor?.trim() || dados.industria?.trim(),
  )
  if (!temAlvo) return { alcance: 0, totalDaCarteira: 0, erro: null }

  const supabase = await criarClienteServidor()
  const { linhas, erro } = await lerPaginado<{ nome: string; setor: string | null; industria: string | null }>(
    (de, ate) => supabase.from('clientes').select('nome, setor, industria').range(de, ate),
  )

  if (erro) {
    return {
      alcance: 0,
      totalDaCarteira: 0,
      erro: 'Não foi possível calcular quantos clientes esta restrição afeta.',
    }
  }

  const restricaoDeTeste: RegraDeRestricao = {
    anunciante: dados.anunciante?.trim() || null,
    setor: dados.setor?.trim() || null,
    industria: dados.industria?.trim() || null,
    motivo: dados.motivo?.trim() || '—',
  }

  const alcance = linhas.reduce(
    (total, cliente) =>
      restricaoQueBloqueia([restricaoDeTeste], {
        nome: cliente.nome,
        setor: cliente.setor,
        industria: cliente.industria,
      })
        ? total + 1
        : total,
    0,
  )

  return { alcance, totalDaCarteira: linhas.length, erro: null }
}
