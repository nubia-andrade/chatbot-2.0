// Promove uma conta já existente no Supabase Auth a administrador geral.
// Uso: npm run admin -- pessoa@empresa.com
//
// Por que este script existe: `perfil_usuario` nasce vazia e só tem policy
// de select, então nada dentro do aplicativo cria a primeira linha. Sem ele,
// todo mundo que entra cai no perfil `executivo` (o padrão de
// `src/lib/sessao-servidor.ts`), ninguém vê Configurações, e as telas desta
// entrega ficam inacessíveis para sempre.
//
// Roda na máquina do administrador e usa a SUPABASE_SERVICE_ROLE_KEY, que
// ignora o RLS — por isso é um comando de linha de comando, nunca código de
// página ou componente.
import { createClient } from '@supabase/supabase-js'
import { lerCredenciaisDeServico, encerrarComErro } from './ambiente.mjs'

const PERFIL = 'admin_geral'
const USUARIOS_POR_PAGINA = 1000

const email = (process.argv[2] ?? '').trim().toLowerCase()

if (email === '') {
  encerrarComErro(
    'Falta o e-mail.\n' + 'Uso: npm run admin -- pessoa@empresa.com',
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

const usuario = await encontrarUsuario(email)

if (!usuario) {
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

// `nome` é obrigatório em `perfil_usuario`. Numa promoção de quem já tem
// linha, o nome cadastrado é preservado; numa criação, usa o que o Auth
// souber e, na falta, a parte do e-mail antes do @ — melhor que gravar
// vazio, e a pessoa pode ajustar depois.
const { data: perfilExistente } = await supabase
  .from('perfil_usuario')
  .select('nome, perfil')
  .eq('usuario_id', usuario.id)
  .maybeSingle()

const nomeDosMetadados = usuario.user_metadata?.nome ?? usuario.user_metadata?.full_name ?? ''
const nome = perfilExistente?.nome || nomeDosMetadados || email.split('@')[0]

const { error: erroAoGravar } = await supabase
  .from('perfil_usuario')
  .upsert({ usuario_id: usuario.id, nome, perfil: PERFIL }, { onConflict: 'usuario_id' })

if (erroAoGravar) {
  encerrarComErro(
    'Não consegui gravar o perfil: ' +
      erroAoGravar.message +
      '\nSe a mensagem falar em relação inexistente, aplique antes o supabase/schema.sql ' +
      'no SQL Editor do Supabase.',
  )
}

if (perfilExistente) {
  console.log(
    `Perfil de ${email} atualizado de "${perfilExistente.perfil}" para "${PERFIL}".\n` +
      'Se a pessoa já estiver com o app aberto, ela precisa recarregar a página.',
  )
} else {
  console.log(
    `Perfil criado para ${email} como "${PERFIL}" (nome: ${nome}).\n` +
      'Ela já pode entrar no app e ver o menu Configurações.',
  )
}
