'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao, podeAdministrar } from '../sessao-servidor'
import { validarPrograma, type Programa } from '../dominio/cadastro'
import { podeExcluirPrograma, podeEditarPrograma } from '../dominio/perfis'

/**
 * Cadastrar e editar programas.
 *
 * A permissão é conferida aqui para o erro sair em português, e de novo no
 * banco pela policy "escrita administrador" de `supabase/schema.sql` — a
 * tela esconder "Configurações" de quem não administra (`BarraLateral.tsx`)
 * é conveniência, não proteção: quem forçar a URL esbarra nesta checagem e,
 * se contornar esta, esbarra no RLS.
 *
 * A validação que vale é a de `validarPrograma` (Task 6), chamada aqui ANTES
 * de qualquer gravação. A validação que o formulário faz no navegador é só
 * conveniência — feedback mais rápido, nada mais.
 */

const ERRO_SEM_PERMISSAO = 'Você não tem permissão para alterar programas.'
const ERRO_SEM_PERMISSAO_EXCLUIR = 'Só o proprietário pode excluir um programa.'
const ERRO_SEM_PERMISSAO_APELIDOS =
  'Você não tem permissão para alterar os apelidos deste programa.'
const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'

function traduzirErroDoPrograma(mensagem: string): string {
  const texto = mensagem.toLowerCase()

  if (texto.includes('programas_mnemonico_key') || texto.includes('duplicate')) {
    return 'Já existe um programa com este mnemônico.'
  }
  if (texto.includes('permission') || texto.includes('policy') || texto.includes('row-level')) {
    return 'O banco não deixou gravar. Confira se você tem permissão de administrador.'
  }

  return mensagem
}

/**
 * Cria (sem `id`) ou atualiza (com `id`) um programa.
 *
 * Devolve a lista de erros SEM gravar nada quando `validarPrograma` acusa
 * qualquer problema — a gente nunca grava um cadastro parcialmente inválido.
 */
export async function salvarPrograma(
  dados: Partial<Programa>,
): Promise<{ erros: string[]; id: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erros: [ERRO_SESSAO_EXPIRADA], id: null }
  if (!podeAdministrar(sessao)) return { erros: [ERRO_SEM_PERMISSAO], id: null }

  const erros = validarPrograma(dados)
  if (erros.length > 0) return { erros, id: null }

  const supabase = await criarClienteServidor()

  const valores = {
    nome: dados.nome!.trim(),
    mnemonico: dados.mnemonico!.trim().toUpperCase(),
    imagem_url: dados.imagem_url?.trim() || null,
    canal: dados.canal!.trim(),
    possui_fluxo_aprovacao: dados.possui_fluxo_aprovacao ?? false,
    contem_digital: dados.contem_digital ?? false,
    redes_sociais: dados.redes_sociais ?? false,
    estado: dados.estado ?? 'em_configuracao',
    dias_da_semana: dados.dias_da_semana ?? [],
    slots: dados.slots ?? 1,
    bloqueio_mensal: dados.bloqueio_mensal ?? 0,
    acoes_minimas: dados.acoes_minimas ?? 1,
    acoes_maximas: dados.acoes_maximas ?? 1,
    custo_midia_tv: dados.custo_midia_tv ?? null,
    custo_producao_tv: dados.custo_producao_tv ?? null,
    percentual_simulcast: dados.percentual_simulcast ?? null,
    custo_midia_digital: dados.custo_midia_digital ?? null,
    custo_producao_digital: dados.custo_producao_digital ?? null,
    prazo_minimo_dias: dados.prazo_minimo_dias ?? 0,
    disponivel_para_proposta: dados.disponivel_para_proposta ?? false,
    aceita_regional: dados.aceita_regional ?? false,
    dia_da_semana_regional: dados.dia_da_semana_regional ?? null,
    prazo_minimo_regional_dias: dados.prazo_minimo_regional_dias ?? null,
    max_pracas_por_acao: dados.max_pracas_por_acao ?? 3,
    custo_producao_regional: dados.custo_producao_regional ?? null,
    bloqueio_mensal_regional: dados.bloqueio_mensal_regional ?? null,
  }

  const consulta = dados.id
    ? supabase
        .from('programas')
        .update({ ...valores, atualizado_em: new Date().toISOString() })
        .eq('id', dados.id)
        .select('id')
    : supabase.from('programas').insert(valores).select('id')

  const { data, error } = await consulta

  if (error) return { erros: [traduzirErroDoPrograma(error.message)], id: null }

  // Um UPDATE barrado pelo RLS volta SEM erro e com zero linhas. Sem
  // conferir, a tela diria "salvou" e mostraria o valor antigo no refresh.
  if (!data || data.length === 0) {
    return {
      erros: ['O banco não deixou gravar. Confira se você tem permissão de administrador.'],
      id: null,
    }
  }

  revalidatePath('/configuracoes/programas')
  return { erros: [], id: data[0].id }
}

/**
 * Substitui o conjunto de apelidos de um programa pela lista `textos`.
 *
 * Recebe sempre a lista completa e desejada (não um apelido por vez): apaga
 * quem saiu, mantém quem ficou, insere quem é novo. Duplicatas e textos em
 * branco são descartados antes de gravar.
 *
 * A permissão é `podeEditarPrograma` — vínculo com ESTE programa —, e não o
 * `podeAdministrar` amplo que valia antes. Apelido não é detalhe cosmético:
 * é ele que decide qual entrega da API ocupa qual programa (`encontrarProgramaId`),
 * então reescrever os apelidos de um programa alheio é reescrever a ocupação
 * dele. A policy de `programa_apelidos` fecha o mesmo buraco no banco
 * (`supabase/schema-entrega-2-correcoes.sql`).
 */
export async function salvarApelidos(
  programaId: string,
  textos: string[],
): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erro: ERRO_SEM_PERMISSAO_APELIDOS }
  }

  const supabase = await criarClienteServidor()

  const normalizados = [...new Set(textos.map((texto) => texto.trim()).filter((texto) => texto !== ''))]

  const { error: erroAoLimpar } = await supabase
    .from('programa_apelidos')
    .delete()
    .eq('programa_id', programaId)

  if (erroAoLimpar) {
    return { erro: 'Não foi possível atualizar os apelidos. Tente novamente.' }
  }

  if (normalizados.length > 0) {
    const { error: erroAoGravar } = await supabase
      .from('programa_apelidos')
      .insert(normalizados.map((texto) => ({ programa_id: programaId, texto })))

    if (erroAoGravar) {
      // `texto` é único na tabela inteira, não só por programa: um apelido
      // já usado em outro cadastro colide aqui.
      return {
        erro: 'Não foi possível gravar um ou mais apelidos — talvez já estejam em uso em outro programa.',
      }
    }
  }

  revalidatePath(`/configuracoes/programas/${programaId}`)
  return { erro: null }
}

/**
 * Exclui um programa — a única ação irreversível da Entrega 2. Por cascata
 * do banco (`supabase/schema-entrega-2.sql`), leva junto as datas
 * bloqueadas, as restrições de anunciante, os preços regionais e as ações
 * regionais daquele programa.
 *
 * A checagem de `podeExcluirPrograma` (só proprietário) acontece aqui para
 * o erro sair em português, e de novo no banco pela policy "remocao
 * proprietario" de `programas` — a interface esconder o botão "Excluir"
 * para quem não é proprietário (`CartaoDePrograma.tsx`) é conveniência, não
 * proteção: quem forçar a chamada sem ser proprietário esbarra nesta
 * checagem e, se contornar esta, esbarra no RLS.
 */
export async function excluirPrograma(id: string): Promise<{ erro: string | null }> {
  const sessao = await obterSessao()
  if (!sessao) return { erro: ERRO_SESSAO_EXPIRADA }
  if (!podeExcluirPrograma(sessao.perfis)) return { erro: ERRO_SEM_PERMISSAO_EXCLUIR }

  const supabase = await criarClienteServidor()

  const { error, count } = await supabase
    .from('programas')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    return { erro: 'Não foi possível excluir o programa. Tente novamente.' }
  }

  // Um DELETE barrado pelo RLS volta sem erro e sem linhas afetadas — sem
  // conferir, a tela diria "excluído" com o programa ainda no banco.
  if (!count || count === 0) {
    return { erro: 'O banco não deixou excluir. Confira se você é proprietário.' }
  }

  revalidatePath('/configuracoes/programas')
  return { erro: null }
}
