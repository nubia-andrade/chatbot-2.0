// Leitura do .env.local para os scripts de linha de comando.
//
// Só os scripts que rodam na máquina do administrador (`npm run importar`,
// `npm run admin`) passam por aqui: eles precisam da SUPABASE_SERVICE_ROLE_KEY,
// que ignora todas as regras de RLS do banco e por isso nunca pode ser lida
// por código de página ou componente.
import { readFileSync } from 'node:fs'

export function encerrarComErro(mensagem) {
  console.error(mensagem)
  process.exit(1)
}

export function lerEnv() {
  let texto
  try {
    texto = readFileSync('.env.local', 'utf8')
  } catch {
    encerrarComErro(
      'Não encontrei o arquivo .env.local na raiz do projeto.\n' +
        'Copie .env.local.example para .env.local e preencha com as chaves do Supabase ' +
        '(a SUPABASE_SERVICE_ROLE_KEY fica em Project Settings > API > service_role).',
    )
  }
  const env = {}
  for (const linha of texto.split('\n')) {
    const par = linha.match(/^([A-Z0-9_]+)=(.*)$/)
    if (par) env[par[1]] = par[2].trim()
  }
  return env
}

/**
 * As duas chaves que os scripts administrativos exigem, já validadas.
 */
export function lerCredenciaisDeServico() {
  const env = lerEnv()
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    encerrarComErro(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.\n' +
        'Preencha as duas chaves (Project Settings > API) antes de continuar.',
    )
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, chaveDeServico: env.SUPABASE_SERVICE_ROLE_KEY }
}
