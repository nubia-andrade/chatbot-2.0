# CHATBOT 2.0 — Entrega 1: Fundação e Dados

Data: 2026-08-15
Status: aguardando revisão

## Contexto

O CHATBOT 2.0 é um aplicativo web para executivos comerciais consultarem a
disponibilidade real de ações de conteúdo antes de gerar uma proposta. Apesar do
nome, não é um chatbot: é um wizard visual e determinístico que responde, nesta
ordem, **Posso vender? → Quando posso vender? → Quanto custa?**

O produto inteiro tem três entregas. Esta spec cobre apenas a primeira:

1. **Fundação e dados** (esta spec) — projeto, login, cadastro de programas,
   ingestão das vendas.
2. **Wizard de disponibilidade** — telas `1b` a `1e` do handoff.
3. **Resumo e proposta** — etapas 6 e 7, ainda sem desenho.

O handoff de design está em `design_handoff/` (seção `#t1` do HTML é a
especificação; `#t2` é exploratório e deve ser ignorado).

## Objetivo desta entrega

Ao final, deve ser possível: entrar no app com e-mail e senha, cadastrar um
programa com suas regras comerciais, rodar a importação das vendas e ver quantas
ações foram carregadas. Nada disso é visível ao executivo ainda — é a fundação
sobre a qual o wizard da Entrega 2 vai operar.

## Fora de escopo

- Wizard de disponibilidade, calendário e proposta (Entregas 2 e 3).
- SSO corporativo no login. O Supabase Auth trabalha com e-mail e senha; ligar
  SSO depende do mesmo pedido de credencial que a API vai exigir. O lugar do
  botão fica preparado na tela.
- Reserva de inventário. O produto valida disponibilidade num instante; não
  reserva.
- Mobile. Desktop-first, conforme o handoff.

## Arquitetura

Mesma stack e as mesmas convenções do `cache-hub`, que já roda neste padrão:

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres +
Auth) · Vitest · deploy na Vercel · código no GitHub.

Separação em camadas, herdada do cache-hub:

```
src/
  app/                    telas e rotas
    login/                tela 1a
    (app)/                tudo atrás do login
      configuracoes/programas/    cadastro
      configuracoes/importacao/   painel do snapshot
    globals.css           tokens de design do handoff
  components/             peças visuais por feature
  lib/
    dominio/              REGRAS DE NEGÓCIO — sem banco, sem tela, com teste
    dados/                leitura do Supabase
    acoes/                escrita (server actions)
    supabase/             conexão (navegador e servidor)
  proxy.ts                renova a sessão a cada requisição
scripts/importar.mjs      o importador da API
supabase/                 SQL versionado
dados/                    planilhas de trabalho — NUNCA versionadas
design_handoff/           referência visual, não é código
```

O nome interno do pacote é `chatbot-2.0` (npm não aceita espaço nem maiúscula);
o nome do produto, em telas e documentos, é **CHATBOT 2.0**.

### A decisão central: como os dados de venda chegam

A API `https://globotake.g.globo/api/v1/programsActionsPowerBi` exige
autenticação no SSO corporativo. Verificado em 2026-08-14: uma chamada anônima
responde HTTP 200 com a página de login, não com JSON. A Vercel não tem essas
credenciais.

**Decisão:** ingestão local com banco na nuvem. Um comando `npm run importar`
roda na máquina do administrador, onde o SSO funciona, e grava um snapshot no
Supabase. O aplicativo lê apenas do Supabase e nunca fala com a API.

A ingestão fica isolada atrás de uma interface, de modo que trocar "script
local" por "chamada autenticada da Vercel" — quando houver service account —
mexa em um arquivo só. Um caminho alternativo por upload de planilha continua
disponível como plano B, e é barato porque reaproveita o mesmo parser.

Consequência aceita: os dados têm a idade da última importação. O painel de
importação mostra essa data com destaque, para que ninguém confunda snapshot
velho com disponibilidade atual.

## Modelo de dados

Cinco tabelas no Supabase.

### `programas`

O cadastro comercial, com os 19 campos definidos pela área:

| Coluna | Tipo | Obrig. | Origem / observação |
| --- | --- | --- | --- |
| `id` | uuid | sim | chave |
| `nome` | text | sim | nome comercial, ex.: Mais Você |
| `mnemonico` | text | sim | **único**; chave de junção com a API, ex.: MAVO |
| `imagem_url` | text | não | Supabase Storage |
| `canal` | text | sim | TV Globo, Multishow, SporTV… |
| `possui_fluxo_aprovacao` | boolean | sim | |
| `contem_digital` | boolean | sim | |
| `redes_sociais` | boolean | sim | |
| `estado` | text | sim | ativo, inativo, em_configuracao |
| `dias_da_semana` | int[] | sim | 0=domingo … 6=sábado |
| `slots` | int | sim | ações de conteúdo por data de exibição |
| `bloqueio_mensal` | int | sim | ao atingir, o mês fecha |
| `acoes_minimas` | int | sim | mínimo por proposta |
| `acoes_maximas` | int | sim | máximo por proposta |
| `custo_midia` | numeric(14,2) | condicional | exigido quando `disponivel_para_proposta` |
| `custo_producao` | numeric(14,2) | condicional | exigido quando `disponivel_para_proposta` |
| `prazo_minimo_dias` | int | sim | antecedência mínima até a exibição |
| `percentual_simulcast` | numeric(5,2) | não | |
| `custo_multishow` | numeric(14,2) | não | |
| `disponivel_para_proposta` | boolean | sim | elegibilidade no gerador |

### `programa_apelidos`

Uma linha por texto alternativo que deve casar com um programa
(`programa_id`, `texto`). Necessária porque 4 dos 23 programas chegam da API sem
mnemônico: `BREAK DE TERRITÓRIOS`, `FIZ A ESCOLHA CERTA`, `TURNES NOVELAS
SHOWS`, `VIVER SERTANEJO`. Sem apelido cadastrado, esses programas ficariam
invisíveis ao cálculo de ocupação.

### `formatos`

Os 73 formatos e suas 6 categorias (`formato` único, `categoria`), carregados de
`dados/Formatos.xlsx`. Categorias: AÇÃO DE CONTEÚDO, COMERCIAL, CONTEÚDO NO
BREAK, INSERT, VINHETA, CHAMADA.

### `clientes`

A carteira: `nome`, `cnpj`, `setor`, `industria`, `executivo`, `email`.
Alimenta a busca da etapa 1 e a classificação da etapa 2 (Entrega 2). Carregada
de `dados/Carteira.xlsx`.

### `acoes_vendidas`

O snapshot da API. Colunas guardadas: `numero_da_entrega` (chave de
conferência), `programa`, `data_de_exibicao`, `anunciante`, `marca`, `formato`,
`tipo_da_entrega`, `status_aprovacao`, `importado_em`.

Descartados na ingestão: `custo_de_producao`, `elenco`,
`envolvimento_do_talento`, `cache_extra`, `observacoes_financeiras`,
`status_de_pagamento`, `numero_documento`, `ajuste_gerencial`,
`data_de_gravacao`, `descritivo_da_acao`, `observacoes_gerais`,
`elenco_nome_artistico`, `usuario_de_criacao`, `id_sales_force`,
`nome_do_plano`, `vertical_de_origem`, `nome_da_obra`, `data_de_criacao`. Não
servem à disponibilidade, e parte deles é informação financeira e de talento que
não há razão para replicar.

## Regras de negócio

Estas regras vivem em `src/lib/dominio/`, sem dependência de banco ou tela, e
são as que ganham teste automatizado. Se qualquer uma quebrar, o aplicativo
passa a mentir sobre disponibilidade.

**R1 — Só ação de conteúdo ocupa slot.** Um registro de venda consome slot
apenas se a categoria do seu formato for AÇÃO DE CONTEÚDO. Comercial, conteúdo
no break, insert, vinheta e chamada aparecem na base mas são invisíveis ao
cálculo.

```
ocupacao(programa, data) = COUNT(acoes_vendidas
                                 WHERE programa e data
                                 AND categoria(formato) = 'AÇÃO DE CONTEÚDO')
```

Não existe coluna de quantidade na API: cada linha é uma ação. Verificado na
amostra de 302 registros — 284 consomem slot, 18 são ignoradas.

**R2 — Formato desconhecido resolve para AÇÃO DE CONTEÚDO.** Formato vazio, `-`
ou ausente da tabela `formatos` conta como ação de conteúdo. O viés é
deliberadamente conservador: essas são ações lançadas com muita antecedência,
ainda sem formato definido, e errar para o lado de "ocupa slot" evita anunciar
disponibilidade que não existe.

**R3 — Só o futuro interessa.** A ingestão descarta `data_de_exibicao` anterior
à data corrente. O passado não afeta disponibilidade.

**R4 — Ações sem data são descartadas.** `data_de_exibicao = 01/01/2999` é o
sentinela usado para ações ainda sem data. Decisão da área: ficam fora do
cálculo e sem aviso na interface. Na amostra eram 47 ações de conteúdo,
concentradas em novelas.

**R5 — A categoria é resolvida na leitura, não na ingestão.** O formato é
gravado como veio da API; a categoria vem de um join com `formatos`.
Reclassificar um formato ajusta todo o histórico sem reimportar nada.

**R6 — Junção de programa por mnemônico.** O campo `programa` da API chega como
`MNEMONICO - NOME` (ex.: `MAVO - MAIS VOCE`). A junção usa o mnemônico extraído
antes do primeiro ` - `; se não houver, cai para busca em `programa_apelidos`
pelo texto integral.

**R7 — Validações do cadastro.** `acoes_minimas <= acoes_maximas`; `slots > 0`;
`prazo_minimo_dias >= 0`; `dias_da_semana` não vazio; `mnemonico` único.

## A ingestão

`npm run importar` executa, nesta ordem:

1. Busca a API com as credenciais do SSO do usuário logado na máquina.
2. Descarta registros com `data_de_exibicao` no passado (R3) ou igual a
   `01/01/2999` (R4).
3. Projeta apenas as colunas de interesse.
4. Substitui `acoes_vendidas` por inteiro, dentro de uma transação.
5. Relata: total recebido, importado, descartado por data, e **formatos novos
   que não existem em `formatos`**.

**Substituição total, não incremental.** Uma venda cancelada desaparece da API;
uma estratégia de "só insere o que é novo" a manteria ocupando slot para sempre.

**O alerta de formato novo** é obrigatório: sem ele, um formato criado na origem
entraria mudo, seria tratado como ação de conteúdo por R2, e distorceria a
ocupação sem ninguém perceber.

## Telas

Todas seguem os tokens do handoff: gradiente da marca
`linear-gradient(135deg,#FF2D55,#A031F5,#2D6BFF)`, tipografia Space Grotesk
(títulos e números) e Manrope (corpo), raios de 11 a 16px e as sombras
tabeladas. Os tokens vivem em `globals.css`.

**Login (`1a`)** — split 52/48. Painel esquerdo com o gradiente, três tiles
flutuantes (animação `floaty`), logo e a headline "Posso vender? Quando?
Quanto?". Direita: e-mail corporativo, senha, "Esqueci minha senha", botão
Entrar de 52px. O botão de SSO fica fora desta entrega.

**Shell do app** — sidebar de 224px com Início, Nova consulta, Propostas,
Histórico e Configurações, e rodapé com avatar, nome e perfil. Nesta entrega
apenas Configurações responde; os demais mostram aviso de seção em construção,
para que o app seja navegável desde o primeiro dia.

**Cadastro de programas** — lista e formulário com os 19 campos, upload de
imagem e gestão dos apelidos alternativos.

**Painel de importação** — data e hora do último snapshot em destaque, contagens
de importados e descartados, e a lista de formatos novos a classificar.

## Perfis e segurança

Três perfis, conforme o handoff: **Executivo**, **Admin Programa**, **Admin
Geral**. Nesta entrega, só Admin Geral e Admin Programa acessam Configurações.

Quem decide o que cada pessoa vê é o **RLS no Supabase**, não a interface —
esconder item de menu é conveniência, a proteção real está no banco. Todas as
cinco tabelas nascem com RLS ativo. `clientes` é a mais sensível: contém CNPJ e
e-mails nominais de executivos.

As planilhas em `dados/` entram no `.gitignore` por inteiro. Nenhum dado de
cliente sobe para o GitHub.

## Testes

`npm test` (Vitest) cobre `src/lib/dominio`, sem banco nem tela:

| Regra | Arquivo |
| --- | --- |
| R1 — só ação de conteúdo ocupa slot | `ocupacao.test.ts` |
| R2 — formato desconhecido é ação de conteúdo | `formatos.test.ts` |
| R3/R4 — filtro de data e sentinela | `ingestao.test.ts` |
| R6 — junção por mnemônico e apelido | `programas.test.ts` |
| R7 — validações do cadastro | `cadastro.test.ts` |

Os testes usam a amostra real de 302 registros como base de casos.

## Critérios de aceite

1. `npm run dev` sobe o app em <http://localhost:3000>.
2. É possível entrar com e-mail e senha reais do Supabase Auth.
3. A tela de login corresponde ao handoff `1a`.
4. Um programa pode ser cadastrado com os 19 campos e reaparece na lista.
5. `npm run importar` carrega a amostra e relata importados e descartados.
6. Dada a amostra de 302 registros, a ocupação calculada para
   `DOMI - DOMINGAO` em `16/08/2026` é **5**, e para `MAVO - MAIS VOCE` nenhuma
   data ultrapassa **2**.
7. `npm test` passa.
8. `npm run build` completa sem erro.

## Pendências para as próximas entregas

- **Match anunciante ↔ carteira.** A API traz `anunciante` e `marca`, sem CNPJ;
  a carteira traz CNPJ e nome de conta. A regra de concorrência da Entrega 2
  depende de cruzar os dois, e o cruzamento por nome é frágil. Precisa de
  estratégia própria — provavelmente normalização mais tabela de equivalências
  revisada por gente.
- **Service account no SSO.** Enquanto não houver, a importação é manual.
- **Categorias concorrentes.** O handoff cita "Snacks, Chocolates, Café" como
  categorias concorrentes de Alimentos, mas não existe fonte para essa taxonomia
  nos dados atuais. Precisa ser cadastrada.
- **Etapas 6 e 7** não têm desenho no handoff.
