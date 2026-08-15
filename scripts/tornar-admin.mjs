// Acrescenta um perfil a uma conta já existente no Supabase Auth.
// Uso: npm run admin -- pessoa@empresa.com [perfil]
// Perfil padrão: proprietario
//
// Por que este script existe: `perfil_usuario` nasce vazia e só tem policy
// de select, então nada dentro do aplicativo cria a primeira linha. Sem ele,
// todo mundo que entra cai no perfil `executivo` (o padrão de
// `src/lib/sessao-servidor.ts`), ninguém vê Configurações, e as telas desta
// entrega ficam inacessíveis para sempre.
//
// Perfis se acumulam: rodar de novo com outro perfil ACRESCENTA uma linha em
// `perfil_usuario`, sem apagar as que já existem — uma pessoa pode ser, por
// exemplo, `proprietario` e `executivo_regional` ao mesmo tempo.
//
// Roda na máquina do administrador e usa a SUPABASE_SERVICE_ROLE_KEY, que
// ignora o RLS — por isso é um comando de linha de comando, nunca código de
// página ou componente.
import { createClient } from '@supabase/supabase-js'
import { lerCredenciaisDeServico, encerrarComErro } from './ambiente.mjs'

const PERFIS_VALIDOS = ['executivo', 'executivo_regional', 'consultor_programa', 'proprietario']
const PERFIL_PADRAO = 'proprietario'
const USUARIOS_POR_PAGINA = 1000

const email = (process.argv[2] ?? '').trim().toLowerCase()
const perfil = (process.argv[3] ?? PERFIL_PADRAO).trim().toLowerCase()

if (email === '') {
  encerrarComErro(
    'Falta o e-mail.\n' +
      'Uso: npm run admin -- pessoa@empresa.com [perfil]\n' +
      `Perfis válidos: ${PERFIS_VALIDOS.join(', ')} (padrão: ${PERFIL_PADRAO}).`,
  )
}

if (!PERFIS_VALIDOS.includes(perfil)) {
  encerrarComErro(
    `Perfil inválido: "${perfil}".\n` +
      `Perfis válidos: ${PERFIS_VALIDOS.join(', ')}.\n` +
      'Uso: npm run admin -- pessoa@empresa.com [perfil]',
  )
}

const { url, chaveDeServico } = lerCredenciaisDeServico()
const supabase = createClient(url, chaveDeServico, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Procura a conta pelo e-mail na Admin API.
 *
 * A listagem é paginada porque `listUsers` também para em uma página só —
 * com a base de usuários crescendo, procurar só na primeira página diria
 * "não existe" para contas reais.
 */
async function encontrarUsuario(emailProcurado) {
  for (let pagina = 1; ; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: USUARIOS_POR_PAGINA,
    })

    if (error) {
      encerrarComErro(
        'Não consegui consultar os usuários do Supabase: ' +
          error.message +
          '\nConfira se a SUPABASE_SERVICE_ROLE_KEY do .env.local é a chave secreta ' +
          '(Project Settings > API) e se a NEXT_PUBLIC_SUPABASE_URL aponta para o projeto certo.',
      )
    }

    const usuarios = data?.users ?? []
    const achado = usuarios.find((usuario) => (usuario.email ?? '').toLowerCase() === emailProcurado)
    if (achado) return achado
    if (usuarios.length < USUARIOS_POR_PAGINA) return null
  }
}

const usuarioAuth = await encontrarUsuario(email)

if (!usuarioAuth) {
  encerrarComErro(
    `Não existe nenhuma conta com o e-mail ${email} neste projeto do Supabase.\n\n` +
      'Este comando só promove quem já tem conta — ele não cria contas.\n' +
      'Crie a conta antes, no painel do Supabase:\n' +
      '  Authentication > Users > Add user > Create new user\n' +
      '  (informe o e-mail e uma senha, e marque "Auto Confirm User")\n' +
      'Depois rode de novo: npm run admin -- ' +
      email +
      '\n\nNada foi alterado no banco.',
  )
}

// `nome` é obrigatório em `usuario`. Numa promoção de quem já tem linha, o
// nome cadastrado é preservado; numa criação, usa o que o Auth souber e, na
// falta, a parte do e-mail antes do @ — melhor que gravar vazio, e a pessoa
// pode ajustar depois.
const { data: usuarioExistente } = await supabase
  .from('usuario')
  .select('nome, cargo')
  .eq('usuario_id', usuarioAuth.id)
  .maybeSingle()

const nomeDosMetadados = usuarioAuth.user_metadata?.nome ?? usuarioAuth.user_metadata?.full_name ?? ''
const nome = usuarioExistente?.nome || nomeDosMetadados || email.split('@')[0]

const { error: erroAoGravarUsuario } = await supabase
  .from('usuario')
  .upsert({ usuario_id: usuarioAuth.id, nome }, { onConflict: 'usuario_id' })

if (erroAoGravarUsuario) {
  encerrarComErro(
    'Não consegui gravar o usuário: ' +
      erroAoGravarUsuario.message +
      '\nSe a mensagem falar em relação inexistente, aplique antes o supabase/schema-entrega-2.sql ' +
      'no SQL Editor do Supabase.',
  )
}

const { data: perfisExistentes } = await supabase
  .from('perfil_usuario')
  .select('perfil')
  .eq('usuario_id', usuarioAuth.id)

const jaTinhaEssePerfil = (perfisExistentes ?? []).some((linha) => linha.perfil === perfil)

if (!jaTinhaEssePerfil) {
  const { error: erroAoGravarPerfil } = await supabase
    .from('perfil_usuario')
    .insert({ usuario_id: usuarioAuth.id, perfil })

  if (erroAoGravarPerfil) {
    encerrarComErro(
      'Não consegui gravar o perfil: ' +
        erroAoGravarPerfil.message +
        '\nSe a mensagem falar em relação inexistente, aplique antes o supabase/schema-entrega-2.sql ' +
        'no SQL Editor do Supabase.',
    )
  }
}

const todosOsPerfis = [
  ...new Set([...(perfisExistentes ?? []).map((linha) => linha.perfil), perfil]),
]

if (jaTinhaEssePerfil) {
  console.log(
    `${email} já tinha o perfil "${perfil}". Nada mudou.\n` +
      `Perfis atuais: ${todosOsPerfis.join(', ')}.`,
  )
} else {
  console.log(
    `Perfil "${perfil}" acrescentado a ${email} (nome: ${nome}).\n` +
      `Perfis atuais: ${todosOsPerfis.join(', ')}.\n` +
      'Se a pessoa já estiver com o app aberto, ela precisa recarregar a página.',
  )
}
