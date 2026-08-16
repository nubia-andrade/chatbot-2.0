'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeEditarPrograma } from '../dominio/perfis'
import { PRACAS, validarCompra, type AcaoRegional, type ConfiguracaoRegional } from '../dominio/regional'
import { dentroDoPrazoMinimo } from '../dominio/bloqueios'
import { extrairMnemonico } from '../dominio/programas'

/**
 * Escrita e consulta de apoio da aba Regional — Task 12.
 *
 * A permissão é conferida aqui (para o erro sair em português) e de novo no
 * banco pela policy "escrita consultor" de `preco_regional`/`acoes_regionais`
 * (`supabase/schema-entrega-2.sql`): consultor só grava no programa a que
 * está vinculado, proprietário em todos.
 */

const ERRO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.'
const ERRO_SEM_PERMISSAO = 'Você não tem permissão para alterar dados regionais deste programa.'

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Preços por praça (Step 1)
// ---------------------------------------------------------------------------

export type EntradaDePreco = { praca_codigo: string; valor: number }

function validarPrecos(precos: EntradaDePreco[]): string[] {
  const erros: string[] = []
  for (const preco of precos) {
    if (!PRACAS.includes(preco.praca_codigo as (typeof PRACAS)[number])) {
      erros.push(`Praça desconhecida: ${preco.praca_codigo}.`)
      continue
    }
    if (!Number.isFinite(preco.valor) || preco.valor < 0) {
      erros.push(`Informe um valor válido para ${preco.praca_codigo}.`)
    }
  }
  return erros
}

/** Grava os 5 preços de uma vez — a tabela de preços do Step 1 salva em lote. */
export async function salvarPrecos(
  programaId: string,
  precos: EntradaDePreco[],
): Promise<{ erros: string[] }> {
  const sessao = await obterSessao()
  if (!sessao) return { erros: [ERRO_SESSAO_EXPIRADA] }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erros: [ERRO_SEM_PERMISSAO] }
  }

  const erros = validarPrecos(precos)
  if (erros.length > 0) return { erros }

  const supabase = await criarClienteServidor()

  const { error } = await supabase.from('preco_regional').upsert(
    precos.map((preco) => ({
      programa_id: programaId,
      praca_codigo: preco.praca_codigo,
      valor: preco.valor,
      atualizado_em: new Date().toISOString(),
    })),
    { onConflict: 'programa_id,praca_codigo' },
  )

  if (error) {
    return { erros: ['Não foi possível gravar os preços. Tente novamente.'] }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/regional`)
  return { erros: [] }
}

// ---------------------------------------------------------------------------
// Registro de ação vendida (Step 3)
// ---------------------------------------------------------------------------

export type DadosDeAcaoRegional = {
  data: string
  clienteId: string
  clienteNome: string
  pracas: string[]
  /** 'sugerido_api' quando a data veio pré-marcada pela sugestão da API; 'manual' senão. */
  origem?: 'manual' | 'sugerido_api'
}

function ehViolacaoDeUnicidade(mensagem: string, codigo: string | undefined): boolean {
  return codigo === '23505' || mensagem.toLowerCase().includes('duplicate')
}

/**
 * Registra uma ação regional vendida: uma linha por praça, todas com o mesmo
 * cliente e data (R8/R9 — cada praça consome seu próprio slot, até
 * `max_pracas_por_acao` por ação).
 *
 * Revalida contra o banco NA HORA de gravar (não confia só no que a tela
 * mandou): lê o programa e as ações já vendidas naquela data de novo, e roda
 * `validarCompra` (Task 3) — a mesma regra que decide a matriz — antes do
 * insert. Sem isso, duas abas abertas ao mesmo tempo poderiam vender a
 * mesma praça duas vezes na janela entre a tela carregar e o clique.
 */
export async function registrarAcaoRegional(
  programaId: string,
  dados: DadosDeAcaoRegional,
): Promise<{ erros: string[] }> {
  const sessao = await obterSessao()
  if (!sessao) return { erros: [ERRO_SESSAO_EXPIRADA] }
  if (!podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programaId)) {
    return { erros: [ERRO_SEM_PERMISSAO] }
  }

  if (!dados.clienteId || dados.clienteNome.trim() === '') {
    return { erros: ['Escolha um cliente da carteira.'] }
  }

  const supabase = await criarClienteServidor()

  const { data: programa, error: erroPrograma } = await supabase
    .from('programas')
    .select('aceita_regional, dia_da_semana_regional, max_pracas_por_acao, prazo_minimo_regional_dias')
    .eq('id', programaId)
    .maybeSingle()

  if (erroPrograma || !programa) {
    return { erros: ['Não foi possível carregar a configuração regional do programa.'] }
  }

  const config: ConfiguracaoRegional = {
    aceita_regional: programa.aceita_regional,
    dia_da_semana_regional: programa.dia_da_semana_regional,
    max_pracas_por_acao: programa.max_pracas_por_acao,
  }

  const erros: string[] = []

  if (programa.prazo_minimo_regional_dias !== null && dentroDoPrazoMinimo(hojeIso(), dados.data, programa.prazo_minimo_regional_dias)) {
    erros.push(`Esta data está fora do prazo mínimo de ${programa.prazo_minimo_regional_dias} dias.`)
  }

  const { data: acoesNaData, error: erroAcoes } = await supabase
    .from('acoes_regionais')
    .select('data_de_exibicao, praca_codigo, cliente_nome')
    .eq('programa_id', programaId)
    .eq('data_de_exibicao', dados.data)

  if (erroAcoes) {
    return { erros: ['Não foi possível conferir as praças já vendidas nesta data. Tente novamente.'] }
  }

  erros.push(...validarCompra(config, (acoesNaData ?? []) as AcaoRegional[], dados.data, dados.pracas))

  if (erros.length > 0) return { erros }

  const origem = dados.origem ?? 'manual'

  const linhas = dados.pracas.map((praca) => ({
    programa_id: programaId,
    data_de_exibicao: dados.data,
    cliente_id: dados.clienteId,
    cliente_nome: dados.clienteNome,
    praca_codigo: praca,
    origem,
  }))

  const { error: erroDoLote } = await supabase.from('acoes_regionais').insert(linhas)

  if (!erroDoLote) {
    revalidatePath(`/configuracoes/programas/${programaId}/regional`)
    return { erros: [] }
  }

  // Lote recusado (uma praça foi vendida por outra pessoa entre a validação
  // acima e este insert): grava uma a uma para salvar o que ainda couber.
  const errosDoLote: string[] = []
  for (const linha of linhas) {
    const { error } = await supabase.from('acoes_regionais').insert(linha)
    if (error) {
      errosDoLote.push(
        ehViolacaoDeUnicidade(error.message, error.code)
          ? `A praça ${linha.praca_codigo} acabou de ser vendida por outra pessoa nesta data.`
          : `Não foi possível gravar a praça ${linha.praca_codigo}.`,
      )
    }
  }

  revalidatePath(`/configuracoes/programas/${programaId}/regional`)
  return { erros: errosDoLote }
}

// ---------------------------------------------------------------------------
// Sugestão a partir da API (Step 3)
// ---------------------------------------------------------------------------

export type SugestaoDeAcaoRegional = {
  entregaEncontrada: boolean
  descricao: string | null
  pracasSugeridas: string[]
  /**
   * Preenchido só quando uma entrega foi encontrada mas nenhuma praça pôde
   * ser sugerida — explica por quê, para a tela nunca fingir que verificou
   * e não achou nada quando na verdade não tinha como olhar.
   */
  limitacao: string | null
}

const NOTA_SEM_DESCRITIVO =
  'A base de entregas importada (acoes_vendidas) não guarda o texto descritivo da ação ' +
  '("descritivo_da_acao" ficou fora da projeção da Entrega 1) — só anunciante, marca e ' +
  'formato, que não citam praça de forma confiável. Confira e marque as praças manualmente.'

/**
 * Procura, em `acoes_vendidas`, uma entrega deste programa nesta data — o
 * gatilho da sugestão do Step 3 ("Encontramos uma ação nesta data: [...]").
 *
 * IMPORTANTE — limitação real, não hipotética: a tabela `acoes_vendidas` não
 * tem a coluna `descritivo_da_acao` (verificado contra o banco de produção
 * em 246 linhas reais, incluindo entregas de FATI e CASA). Sem esse texto,
 * `pracasNoTexto` (Task 6) não tem o que ler — rodá-la sobre `anunciante` ou
 * `marca` inventaria sinal onde não há nenhum, e um nome de marca que por
 * acaso contivesse "SP" ou "RJ" como palavra isolada produziria uma praça
 * sugerida falsa. Por isso esta função avisa que encontrou a entrega, mas
 * NUNCA marca praças sozinha: `pracasSugeridas` vem sempre vazio, e
 * `limitacao` explica por quê, para o consultor decidir com informação
 * completa em vez de confiar numa sugestão fabricada.
 */
export async function buscarSugestaoDeAcao(
  programaId: string,
  dataIso: string,
): Promise<SugestaoDeAcaoRegional> {
  const supabase = await criarClienteServidor()

  const { data: programa } = await supabase
    .from('programas')
    .select('mnemonico')
    .eq('id', programaId)
    .maybeSingle()

  if (!programa?.mnemonico) {
    return { entregaEncontrada: false, descricao: null, pracasSugeridas: [], limitacao: null }
  }

  const { data: entregasNaData, error } = await supabase
    .from('acoes_vendidas')
    .select('numero_da_entrega, programa, anunciante, marca, formato')
    .eq('data_de_exibicao', dataIso)

  if (error || !entregasNaData) {
    return { entregaEncontrada: false, descricao: null, pracasSugeridas: [], limitacao: null }
  }

  const mnemonicoAlvo = programa.mnemonico.trim().toUpperCase()
  const entrega = entregasNaData.find(
    (linha) => extrairMnemonico(linha.programa)?.toUpperCase() === mnemonicoAlvo,
  )

  if (!entrega) {
    return { entregaEncontrada: false, descricao: null, pracasSugeridas: [], limitacao: null }
  }

  const descricao = [entrega.anunciante, entrega.marca, entrega.formato]
    .filter((parte) => parte && parte.trim() !== '')
    .join(' · ')

  return {
    entregaEncontrada: true,
    descricao: descricao || `Entrega ${entrega.numero_da_entrega}`,
    pracasSugeridas: [],
    limitacao: NOTA_SEM_DESCRITIVO,
  }
}
