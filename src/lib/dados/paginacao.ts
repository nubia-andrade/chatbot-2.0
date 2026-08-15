/**
 * Leitura paginada do Supabase.
 *
 * O PostgREST devolve no máximo 1000 linhas por requisição (o limite padrão
 * do Supabase). Um `select()` sem `range()` parece funcionar — não dá erro,
 * não avisa nada — e simplesmente para na milésima linha. Neste produto isso
 * é grave de duas formas:
 *
 * - o painel de importação mostraria um total truncado;
 * - pior: a remoção-por-diferença do importador (`scripts/importar.mjs`) só
 *   enxergaria 1000 entregas, e toda venda cancelada além desse ponto
 *   continuaria ocupando slot para sempre — o app anunciaria indisponível o
 *   que já está livre e, na direção oposta, manteria lixo na base.
 *
 * Por isso toda leitura de tabela que pode passar de 1000 linhas
 * (`acoes_vendidas`, `clientes`) passa por aqui. Quando só o total interessa,
 * não use esta função: `select('*', { count: 'exact', head: true })` devolve a
 * contagem sem trazer linha nenhuma.
 */

export const TAMANHO_DA_PAGINA = 1000

type Pagina<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Chama `buscarPagina` em laço, com faixas de `TAMANHO_DA_PAGINA` linhas, até
 * uma página vir incompleta (sinal de que acabou).
 *
 * `buscarPagina` recebe os índices inclusivos que vão direto para o
 * `.range(de, ate)` do Supabase.
 */
export async function lerPaginado<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<Pagina<T>>,
): Promise<{ linhas: T[]; erro: string | null }> {
  const linhas: T[] = []
  let de = 0

  for (;;) {
    const { data, error } = await buscarPagina(de, de + TAMANHO_DA_PAGINA - 1)

    if (error) return { linhas, erro: error.message }

    const pagina = data ?? []
    linhas.push(...pagina)

    // Página incompleta significa fim dos dados. Uma página cheia pode ser a
    // última — nesse caso o laço faz uma requisição a mais, que volta vazia.
    if (pagina.length < TAMANHO_DA_PAGINA) return { linhas, erro: null }

    de += TAMANHO_DA_PAGINA
  }
}
