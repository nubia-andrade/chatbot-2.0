import { createClient } from '@supabase/supabase-js'
import { lerVariaveis } from './variaveis'

/**
 * Cliente restrito a rotinas servidor-servidor, como jobs agendados.
 * Nunca importe este módulo em componentes client-side.
 */
export function criarClienteServico() {
  const { url } = lerVariaveis()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRole) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para executar o relatório diário de marcas.')
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
