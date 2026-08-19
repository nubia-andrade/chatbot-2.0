import { criarClienteServidor } from '../supabase/cliente-servidor'

export type UsuarioDeEmailDoPrograma = {
  usuario_id: string
  email: string
  nome: string
  selecionado: boolean
}

export type ConfiguracaoDeEmailDoPrograma = {
  ativo: boolean
  usuarios: UsuarioDeEmailDoPrograma[]
  schemaDisponivel: boolean
}

const ARQUIVO_SCHEMA = 'supabase/schema-entrega-4-fechamento-propostas.sql'

export async function obterConfiguracaoDeEmailDoPrograma(
  programaId: string,
): Promise<ConfiguracaoDeEmailDoPrograma> {
  const supabase = await criarClienteServidor()

  const [{ data: config, error: erroConfig }, { data: usuarios, error: erroUsuarios }] = await Promise.all([
    supabase
      .from('programa_email_config')
      .select('ativo')
      .eq('programa_id', programaId)
      .maybeSingle(),
    supabase.rpc('listar_usuarios_email_programa', { p_programa_id: programaId }),
  ])

  const mensagem = `${erroConfig?.message ?? ''} ${erroUsuarios?.message ?? ''}`.toLowerCase()
  const schemaIndisponivel = mensagem.includes('programa_email_config')
    || mensagem.includes('listar_usuarios_email_programa')
    || mensagem.includes('could not find')

  if (schemaIndisponivel) {
    return { ativo: false, usuarios: [], schemaDisponivel: false }
  }

  if (erroConfig) console.error('Falha ao carregar configuração de e-mail:', erroConfig.message)
  if (erroUsuarios) console.error('Falha ao listar usuários para e-mail:', erroUsuarios.message)

  return {
    ativo: Boolean(config?.ativo),
    usuarios: ((usuarios ?? []) as UsuarioDeEmailDoPrograma[]).filter((item) => Boolean(item.email)),
    schemaDisponivel: true,
  }
}

export async function emailAutomaticoAtivo(programaId: string): Promise<boolean> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('programa_email_config')
    .select('ativo')
    .eq('programa_id', programaId)
    .maybeSingle()

  if (error) {
    const mensagem = error.message.toLowerCase()
    if (mensagem.includes('programa_email_config') || mensagem.includes('could not find')) return false
    console.error('Falha ao conferir disparo automático:', error.message)
    return false
  }

  return Boolean(data?.ativo)
}

export const ORIENTACAO_SCHEMA_EMAIL = `Execute ${ARQUIVO_SCHEMA} no Supabase para habilitar a configuração de e-mail.`
