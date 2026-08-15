# CHATBOT 2.0

Aplicativo web de consulta de disponibilidade comercial e geração de propostas.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4
- [Supabase](https://supabase.com) (`@supabase/ssr` e `@supabase/supabase-js`)
- [Vitest](https://vitest.dev) para testes

## Como rodar

Instale as dependências e suba o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Sobe o servidor com o build de produção |
| `npm run lint` | Roda o ESLint |
| `npm test` | Roda os testes uma vez (Vitest) |
| `npm run test:assistir` | Roda os testes em modo observador |
| `npm run seed:gerar` | Gera `supabase/seed-formatos.sql` e `supabase/seed-clientes.sql` a partir das planilhas em `dados/` (lê arquivo local; não fala com o Supabase) |
| `npm run importar` | Busca as vendas na API do Globo Take e grava o snapshot em `acoes_vendidas` |
| `npm run importar -- --arquivo caminho.json` | Mesma importação, lendo os registros de um arquivo salvo em vez de chamar a API — veja "Importar sem o comando de linha" |
| `npm run admin -- <e-mail>` | Promove uma conta já existente a administrador geral |

## Configuração

Copie `.env.local.example` para `.env.local` e preencha com as chaves do
projeto no Supabase (`Project Settings > API`).

A `SUPABASE_SERVICE_ROLE_KEY` ignora todas as regras de RLS do banco. Ela é
usada só pelos scripts de linha de comando que rodam na sua máquina
(`npm run importar` e `npm run admin`) — nunca deve rodar no navegador nem ser
cadastrada na Vercel. O `npm run seed:gerar` não usa chave nenhuma: ele só lê
as planilhas de `dados/` e escreve arquivos `.sql`, que você aplica à mão no
SQL Editor.

## Instalação do zero, na ordem

1. **Aplicar o schema.** No painel do Supabase, `SQL Editor` > cole o conteúdo
   de `supabase/schema.sql` > `Run`. Cria as seis tabelas, o RLS, o bucket de
   imagens e as policies. Pode ser rodado de novo a qualquer momento.
2. **Aplicar a Entrega 2.** Ainda no `SQL Editor`, cole o conteúdo de
   `supabase/schema-entrega-2.sql` > `Run`. Roda depois do `schema.sql`: torna
   os perfis acumuláveis, cria `usuario` e as tabelas da área regional
   (`pracas`, `preco_regional`, `acoes_regionais`, `datas_bloqueadas`,
   `restricoes_anunciante`, `consultor_programa`) e as colunas novas de
   `programas`. Também pode ser rodado de novo a qualquer momento.
4. **Carregar formatos e clientes.** Rode `npm run seed:gerar` (exige as
   planilhas em `dados/`) e aplique no SQL Editor, nesta ordem,
   `supabase/seed-formatos.sql` e `supabase/seed-clientes.sql`. São 73
   formatos e ~15,5 mil clientes.
5. **Criar o usuário no painel.** `Authentication` > `Users` > `Add user` >
   `Create new user`. Informe e-mail e senha e marque **Auto Confirm User**.
6. **Tornar esse usuário administrador.** Na raiz do projeto:

   ```bash
   npm run admin -- pessoa@empresa.com
   ```

   Sem este passo ninguém enxerga Configurações: `perfil_usuario` nasce vazia
   e todo mundo cai no perfil `executivo`, que não administra nada. O script
   não cria contas — se o e-mail não existir, ele diz isso e manda voltar ao
   passo 5. Repita o comando para cada pessoa que precisar administrar.
7. **Importar as vendas.** `npm run importar`. Se a API devolver a página de
   login em vez de JSON, veja "Importar sem o comando de linha" abaixo — é o
   caminho normal, não um sinal de erro. Depois de importar,
   `Configurações > Importação` mostra a data do snapshot e o que veio.

### Importar sem o comando de linha

`npm run importar` chama a API do Globo Take direto do terminal. Isso só
funciona se o SSO corporativo autenticar a chamada — e a sessão do SSO vive
nos **cookies do navegador**; o Node não tem acesso a eles. Fazer login numa
aba do navegador não resolve nada aqui: o problema não é a sessão ter
expirado, é que o terminal nunca a vê. Quando isso acontece, o comando
imprime essa explicação e para sem tocar no banco.

O caminho que funciona: salvar a resposta da API pelo navegador (onde a
sessão existe de verdade) e apontar o importador para o arquivo salvo.

1. Com a sessão do SSO ativa, abra
   `https://globotake.g.globo/api/v1/programsActionsPowerBi` no navegador.
   A página mostra só o JSON da resposta.
2. Salve com **Ctrl+S** (ou `Arquivo > Salvar como`), escolhendo o formato de
   página que salva o texto puro (no Chrome/Edge, "Página da Web, somente
   HTML" já grava o JSON puro; outros navegadores podem chamar de "Texto" ou
   "Todos os arquivos"). Dê à extensão do arquivo `.json`, ex.:
   `resposta-globotake.json`.
3. Rode a importação apontando para o arquivo:

   ```bash
   npm run importar -- --arquivo caminho/para/resposta-globotake.json
   ```

Daí em diante o fluxo é idêntico ao da API: os mesmos filtros de data, a
mesma projeção de colunas, a mesma trava contra números de entrega
duplicados, a mesma leitura paginada e o mesmo upsert com remoção-por-
diferença. Só a origem dos dados muda — nada no cálculo de disponibilidade é
diferente entre os dois caminhos.

Aceita tanto um array puro (`[...]`) quanto um envelope
(`{"data": [...]}` ou `{"results": [...]}`), do mesmo jeito que a leitura da
API já aceita. Se o arquivo não existir ou não for um JSON válido, o comando
avisa exatamente qual arquivo e qual foi o problema, sem alterar o banco.

### Imagens dos programas

O upload do cadastro de programas grava no bucket `programas` do Supabase
Storage, criado pelo `schema.sql` do passo 1. Se o app reclamar de que o
espaço de armazenamento não existe, crie o bucket à mão — `Storage` >
`New bucket` > nome `programas`, com **Public bucket** ligado — e rode o
`schema.sql` de novo para instalar as policies (leitura pública, escrita só
para administradores). Enquanto isso, o formulário aceita colar a URL de uma
imagem já hospedada.

## Dados

A pasta `dados/` guarda planilhas de trabalho com CNPJ e e-mails nominais e
**nunca é versionada** (veja `.gitignore`). O handoff de design vive em
`design_handoff/`.
