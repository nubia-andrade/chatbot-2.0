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

### URL de redirecionamento (obrigatório para "Esqueci minha senha")

O fluxo de `/esqueci-senha` → e-mail → `/redefinir-senha` só funciona se o
Supabase tiver permissão de mandar a pessoa de volta para o app. No painel do
projeto, em `Authentication > URL Configuration`:

- **Site URL**: `http://localhost:3000` (em desenvolvimento).
- **Redirect URLs**: adicione `http://localhost:3000/**`.

Quando existir domínio de produção, repita os dois campos com esse domínio
(ex.: `https://seu-dominio.com` e `https://seu-dominio.com/**`) — sem isso o
link do e-mail de redefinição é recusado pelo Supabase (redirect not allowed)
mesmo com o código correto.

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
3. **Aplicar as correções da Entrega 2.** Ainda no `SQL Editor`, cole
   `supabase/schema-entrega-2-correcoes.sql` > `Run`. Este arquivo é o
   **último da sequência e tem a palavra final sobre autorização**: resolve a
   divergência entre as duas definições de `e_administrador()`, restringe a
   escrita de `programa_apelidos` a quem é consultor daquele programa (era
   qualquer administrador) e amarra as imagens do Storage a quem as enviou.
   Também é idempotente.

   ⚠️ Se algum dia você reaplicar o `schema.sql` ou o `schema-entrega-2.sql`
   sozinho, **rode este arquivo de novo em seguida** — os anteriores recriam
   as policies amplas e a definição antiga de `e_administrador()`, revertendo
   a autorização sem erro nenhum no console.
4. **Aplicar a reestruturação de Custos.** Ainda no `SQL Editor`, cole
   `supabase/schema-entrega-2-custos.sql` > `Run`. Roda depois do arquivo
   anterior: separa custo nacional de TV e de Digital (renomeia
   `custo_midia`/`custo_producao` para `custo_midia_tv`/`custo_producao_tv` e
   cria `custo_midia_digital`/`custo_producao_digital`), faz o mesmo em
   `preco_regional` (renomeia `valor` para `custo_midia_tv` e cria as colunas
   de produção, simulcast e digital por praça) e remove `custo_multishow`,
   `direitos_e_conexos` e `custo_producao_regional` — os dois últimos porque
   "direitos e conexos" virou um valor calculado (15% da mídia de TV, com
   simulcast; 15% da mídia digital, sem simulcast —
   `src/lib/dominio/direitos-e-conexos.ts`) em vez de um campo digitado, e a
   produção regional passou a ser por praça. Todo `rename` preserva o dado
   que já estava gravado; os `drop column` removem o que não existe mais no
   modelo novo — o cabeçalho do arquivo lista, coluna por coluna, o que
   acontece com cada valor existente. Idempotente.
5. **Aplicar a reestruturação de Produção Regional.** Ainda no `SQL Editor`,
   cole `supabase/schema-entrega-2-producao-regional.sql` > `Run`. Roda
   depois do arquivo anterior: reverte parte da mudança de Custos porque a
   área decidiu que a produção regional é **única por programa**, não por
   praça (um cliente que compra 3 praças paga a produção uma vez, não três)
   — remove `preco_regional.custo_producao_tv` e
   `preco_regional.custo_producao_digital` (nasceram nulas em todo mundo, o
   arquivo confere isso antes do `drop`) e cria um único
   `programas.custo_producao_regional`. Também cria
   `programas.bloqueio_mensal_regional`: o documento da área diz "4 ações
   bloqueiam o mês" no regional, um número diferente do `bloqueio_mensal`
   nacional que a usuária já configurou (12 no Encontro, 2 no É de Casa) — as
   duas grandezas não cabiam numa coluna só. A regra em si (4 ações fecham o
   mês) ainda não é aplicada em lugar nenhum; só a coluna, o campo no
   cadastro e a validação de não-negativo entram por este arquivo. Idempotente.
6. **Carregar formatos e clientes.** Rode `npm run seed:gerar` (exige as
   planilhas em `dados/`) e aplique no SQL Editor, nesta ordem,
   `supabase/seed-formatos.sql` e `supabase/seed-clientes.sql`. São 73
   formatos e ~15,5 mil clientes.
7. **Criar o usuário no painel.** `Authentication` > `Users` > `Add user` >
   `Create new user`. Informe e-mail e senha e marque **Auto Confirm User**.
8. **Tornar esse usuário administrador.** Na raiz do projeto:

   ```bash
   npm run admin -- pessoa@empresa.com
   ```

   Sem este passo ninguém enxerga Configurações: `perfil_usuario` nasce vazia
   e todo mundo cai no perfil `executivo`, que não administra nada. O script
   não cria contas — se o e-mail não existir, ele diz isso e manda voltar ao
   passo 7. Repita o comando para cada pessoa que precisar administrar.
9. **Importar as vendas.** `npm run importar`. Se a API devolver a página de
   login em vez de JSON, veja "Importar sem o comando de linha" abaixo — é o
   caminho normal, não um sinal de erro. Depois de importar,
   `Configurações > Importação` mostra a data do snapshot e o que veio.
10. **Configurar as ações regionais.** Depois de cadastrar os programas
    (`Configurações > Programas`), aplique `supabase/seed-regional.sql` no
    SQL Editor. Ele configura o **Encontro** e o **É de Casa** com os
    valores de `docs/regras-acoes-regionais.md`: dia da semana do slot
    regional, prazo mínimo próprio, teto de praças, o preço de mídia de TV
    de cada uma das 5 praças, e agora também o custo de produção regional
    (único por programa: R$ 7.797,00 no Encontro, R$ 7.910,00 no É de Casa)
    e o bloqueio mensal regional (4 nos dois). Direitos e conexos continuam
    fora do seed — é valor calculado, nunca gravado. Idempotente, e casa os
    programas pelo mnemônico (`FATI` e `CASA`) — se os seus tiverem outro,
    ajuste o arquivo.

   O mesmo arquivo corrige o mnemônico do É de Casa de `EDC` para `CASA`. Não
   é detalhe: a API manda `"CASA - E DE CASA"`, e com `EDC` nenhuma entrega
   desse programa era reconhecida — a ocupação nacional ficava zerada e a
   sugestão de ação regional nunca achava nada, em silêncio.

   ⚠️ **Os valores monetários são provisórios.** O documento da área marca
   preço por praça, direitos e conexos e custo de produção como "checar com
   Pricing". A aba Regional exibe esse aviso na tela. Quando Pricing
   confirmar, atualize `supabase/seed-regional.sql` **e**
   `docs/regras-acoes-regionais.md` juntos, para os dois não divergirem.
11. **Aplicar Datas especiais.** No `SQL Editor`, cole
    `supabase/schema-datas-especiais.sql` > `Run`. Roda depois de todos os
    arquivos anteriores (usa `e_consultor_de`, criada no passo 2). Cria a
    tabela `datas_especiais` — períodos com preço diferenciado por programa
    (Black Friday, Natal…), diferentes de `datas_bloqueadas`: aquela impede a
    venda, esta muda o preço, e as duas coexistem sem se tocar. O campo
    `texto_investimento` é gravado agora mas só é lido na Entrega 4, quando a
    página de valor da proposta for gerada — a tela avisa isso. A regra "dois
    períodos do mesmo programa não podem se sobrepor" não é um `check` de
    banco (exigiria a extensão `btree_gist`, que este projeto não usa em
    lugar nenhum); é validada em `src/lib/dominio/datas-especiais.ts` antes da
    escrita. Idempotente.
12. **Aplicar Datas especiais — dias da semana.** No `SQL Editor`, cole
    `supabase/schema-datas-especiais-dias.sql` > `Run`. Roda depois do passo
    11. Acrescenta `dias_da_semana smallint[]` (opcional) à tabela
    `datas_especiais` — vazio ou nulo continua significando "todos os dias
    do período", os cadastros já existentes não mudam. Preenchido, restringe
    o período a dias específicos da semana (0=domingo … 6=sábado, convenção
    de `programas.dias_da_semana`) — caso real: Mais Você, janeiro a abril,
    valor diferenciado só às quartas-feiras. Idempotente.
13. **Aplicar Elegibilidade regional.** No `SQL Editor`, cole
    `supabase/schema-clientes-regional.sql` > `Run`. Roda depois de todos os
    arquivos anteriores (usa `e_administrador()`, criada no passo 2).
    Acrescenta a `clientes`: `segmentacao_se`, `cod_siscom`, `setor_ibope` (só
    guardadas) e `apto_regional boolean not null default false` — quem pode
    comprar ação regional, **do cliente, global**, válida em qualquer
    programa que aceite regional, não configuração de um programa específico.
    Cria o índice `clientes_apto_regional_idx` e a policy de escrita
    (consultor de programa ou proprietário) que faltava em `clientes` (antes,
    só leitura). Idempotente.

    Depois de aplicado, recarregue a carteira com os valores novos: rode
    `npm run seed:gerar` (gera `supabase/seed-clientes.sql` de novo, agora
    com as 4 colunas) e, em seguida, `node .superpowers/carregar-seed.mjs`
    para gravar direto pela API — ele **atualiza no lugar** (casa cada linha
    da planilha com o cliente já gravado por CNPJ e, na falta dele, por nome,
    e faz upsert pelo `id`), nunca apaga e reinsere: `acoes_regionais`
    referencia `clientes.id`, e um `delete`+`insert` trocaria os ids e
    quebraria toda ação regional já vendida.
14. **Aplicar Consultas gravadas.** No `SQL Editor`, cole
    `supabase/schema-entrega-3.sql` > `Run`. Roda depois de todos os arquivos
    anteriores (usa `e_proprietario()`, criada no passo 2). Cria as tabelas
    `consultas` e `consulta_itens` — o retrato do que foi validado no wizard
    de disponibilidade num instante (cliente, programa, preço, avisos), com
    RLS: o executivo só vê e grava as próprias, o proprietário vê todas, e
    ninguém edita ou apaga uma consulta já gravada. Idempotente.

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
`schema.sql` seguido do `schema-entrega-2-correcoes.sql` para instalar as
policies: leitura pública, envio por consultor ou proprietário, e alteração
ou remoção só por quem enviou o arquivo (ou pelo proprietário). Enquanto
isso, o formulário aceita colar a URL de uma imagem já hospedada.

## Dados

A pasta `dados/` guarda planilhas de trabalho com CNPJ e e-mails nominais e
**nunca é versionada** (veja `.gitignore`). O mesmo vale para
`.superpowers/`, a área de trabalho do desenvolvimento, que guarda backups do
banco — inclusive a carteira inteira em JSON. O handoff de design vive em
`design_handoff/`.
