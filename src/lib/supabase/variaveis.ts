/**
 * As duas variáveis de ambiente do Supabase, com um erro claro quando faltam.
 *
 * Sem isto, esquecer o `.env.local` produz uma mensagem enigmática do próprio
 * Supabase. Aqui a mensagem diz exatamente o que fazer.
 *
 * Precisam ser escritas por extenso (`process.env.NEXT_PUBLIC_...`, e não
 * `process.env[nome]`) porque o Next troca esse texto pelo valor durante o
 * build — se o nome for montado em tempo de execução, a troca não acontece.
 */
export function lerVariaveis(): { url: string; chave: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !chave) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local. ' +
        'Copie o .env.local.example e preencha com as chaves do Supabase.',
    )
  }

  return { url, chave }
}
