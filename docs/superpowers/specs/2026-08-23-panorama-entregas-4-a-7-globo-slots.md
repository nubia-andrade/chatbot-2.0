# Globo Slots — Panorama das Entregas 4 a 7 (registro retroativo)

Data: 2026-08-23
Status: registro do estado atual — não é um plano de trabalho futuro

## Por que este documento existe

As Entregas 1, 2 e 3 seguiram o processo disciplinado deste projeto: ideia →
spec revisada → plano task-a-task → implementação com revisão cruzada, cada
etapa registrada em `docs/superpowers/`. Este documento cobre um trecho que
**não** seguiu esse processo.

Entre 22/08/2026 e 23/08/2026, a branch `entrega-3-wizard` recebeu 88 commits
a partir de um ponto marcado como `"backup local antes do Globo Slots"`,
implementando o que os próprios nomes dos arquivos de migração chamam de
Entregas 4, 5, 6 e 7 — além do rebranding do produto de **CHATBOT 2.0** para
**Globo Slots**. Nenhuma dessas entregas tem spec nem plano em
`docs/superpowers/`. Este documento não é a spec que deveria ter sido escrita
antes — é o retrato de dentro para fora do que o código já faz, para o
projeto voltar a ter um registro coerente e para quem pegar a próxima entrega
não precisar arqueologizar 88 commits sozinho.

**Convenção mantida:** apesar de faltar a spec, quem implementou seguiu a
numeração e o estilo de comentário das migrações anteriores — os arquivos
`schema-entrega-N-*.sql` continuam com cabeçalho explicando o problema de
negócio, e a maioria das RPCs de escrita segue `security definer` com
checagem de identidade, no mesmo padrão que a Entrega 3 estabeleceu.

**Uma advertência sobre os nomes dos arquivos:** vários não descrevem o que
o arquivo faz. `schema-entrega-4-fechamento-propostas.sql` não trata de
negociação nem de fechamento comercial — trata de governança de marca manual
e configuração de e-mail por programa. `schema-entrega-5-filtro-ranking-
programas.sql` não filtra nem ordena programas — só resolve o nome do
executivo para o ranking de performance aparecer sem expor a tabela
`usuario`. Ao investigar uma área, confira o conteúdo do arquivo, não confie
só no nome.

## Entrega 4 — A fundação da proposta como documento

**O que existia antes:** a Entrega 3 terminava na consulta — o wizard
validava disponibilidade e não ia além. `docs/proposta-e-modelo.md`, escrito
em 16/08/2026 a partir de uma proposta real (É de Casa/HAVAN), registrou a
intenção antes de qualquer código: doze páginas de PDF, uma só gerada pelo
sistema (a "página de valor"), as demais montadas pelo consultor como
imagens em seções nomeadas.

**O que a Entrega 4 constrói**, por área de negócio:

**Proposta como registro.** `propostas` nasce como o documento comercial
gerado a partir de uma consulta — status de PDF, valores de mídia/produção/
direitos, `pdf_path` no bucket privado `propostas`. Visível para o próprio
autor ou o consultor do programa; gravado só pelo autor.

**Contexto e complementos, congelados no momento da geração.** `produto` e
`objetivo` (texto livre do executivo) e `inclui_digital`/`inclui_redes_sociais`
com seus valores entram na proposta como **cópia**, não referência — o mesmo
princípio que a Entrega 3 usou para gravar `consultas`: se o cadastro do
programa mudar depois, a proposta já emitida continua dizendo o que dizia.
Porta de entrada: o passo Resumo do wizard (`src/app/(app)/consulta/resumo`).

**Modelo de proposta em seções.** `programa_modelo_slides` guarda os slides
por seção (`capa`, `conteudo`, `digital`, `redes_sociais`, `valor`,
`observacoes`, `contracapa`), com slide único garantido para capa, valor e
contracapa — o código bate com o que `docs/proposta-e-modelo.md` pediu.
Editado em `configuracoes/programas/[id]/modelo`, por consultor do programa
ou proprietário.

**Carteira do executivo.** A busca de cliente/marca no wizard passou a
priorizar quem é da carteira de quem está logado (vínculo por e-mail ou pelo
campo `clientes.executivo`); proprietário e consultor de programa buscam a
carteira inteira. A regra vive na RPC `buscar_marcas`, não em TypeScript de
domínio.

**Acessos e seções por perfil.** `perfil_secao` é a matriz perfil × seção do
app (`inicio`, `consulta`, `propostas`, `configuracoes` — `aprovacoes` chega
na Entrega 5), editável só pelo proprietário em
`configuracoes/perfis`. É o que hoje decide o que a sidebar mostra a cada
perfil (`SecaoApp`/`SECOES_PADRAO_POR_PERFIL` em `src/lib/dominio/perfis.ts`).

**Divergência do documento de intenção, resolvida:** `docs/proposta-e-
modelo.md` apontava que a página de valor mostrava um "Total" que não incluía
direitos e produção, ao contrário de `custo-da-acao-regional.ts`. Conferido
em `src/lib/dominio/resumo-financeiro.ts`: hoje os dois números **coexistem**,
nomeados e mostrados separadamente — `total_comercial` (mídia + digital +
redes + simulcast, o que o cliente vê como valor de veiculação) e
`total_geral` (soma tudo, para registro interno). O resumo do wizard mostra
os dois rotulados, nunca um escondendo o outro.

## Entrega 5 — Ciclo de vida comercial e governança

**Negociação e versionamento.** Uma proposta emitida ganha `negociacao_status`
(`em_negociacao`, `fechada`, `perdida`, `cancelada`, `substituida`) e pode
virar nova versão (`grupo_versao_id`, `versao`, `proposta_anterior_id`) sem
apagar a anterior — histórico e KPI sempre sabem qual versão vale. As regras
de transição vivem em RPCs (`atualizar_negociacao_proposta`,
`proxima_versao_da_proposta`), não em `src/lib/dominio/`.

**Fluxo de aprovação.** Programa com `possui_fluxo_aprovacao` faz a proposta
nascer `pendente`, com o PDF **não liberado** ao executivo até decisão do
consultor do programa ou do proprietário (`aprovacao_status`:
`nao_requerida → pendente → aprovada` ou `rejeitada`). Aprovar libera o PDF e,
numa versão nova, substitui automaticamente a anterior da mesma família;
rejeitar exige justificativa e devolve para o executivo revisar. Cada decisão
gera um registro de auditoria em `proposta_aprovacoes` e dispara e-mail via
Microsoft Graph. Porta de entrada: `/aprovacoes` (`PainelDeAprovacoes`).

**Acompanhamento de performance.** `/desempenho` mostra ao executivo os
próprios números (propostas geradas, valor ofertado, conversão, evolução
mensal, alertas de proposta parada); consultor e proprietário veem a visão
agregada por programa, com ranking de executivos. A regra que garante que só
a versão vigente de cada família entra no cálculo — nunca uma v2 pendente
escondendo uma v1 aprovada — está em `src/lib/dominio/performance-
propostas.ts`, com teste.

**Governança de marcas: automática e manual.** Uma marca chega a um cliente
por duas portas. A **automática** vem do Globo Take: um gatilho em
`acoes_vendidas` aprende pares Anunciante+Marca e casa com a carteira só
quando o nome normalizado bate com exatamente um cliente — sem ambiguidade,
sem match. A **manual** vem do próprio executivo, durante a consulta, quando
cadastra uma marca nova para um cliente da própria carteira; isso nasce
`pendente` de revisão e aparece para o proprietário em
`configuracoes/marcas` (`PainelDeMarcaManual`), com um relatório diário por
e-mail avisando o que ficou pendente. Regra de arbitragem quando os dois
caminhos discordam: **o vínculo manual sempre vence** — uma correção
administrativa nunca é sobrescrita silenciosamente pelo aprendizado
automático.

**Restrição por Segmentação (SE).** Um campo cadastral da carteira, distinto
de Setor e Indústria — a própria migração é explícita sobre isso. Entra como
terceiro critério de restrição cadastrada (`restricaoQueBloqueia`, testado),
na ordem anunciante → Setor+Indústria → Segmentação SE. **Não** participa da
regra de concorrência por data (R14) — só é usada para restrição cadastrada
pelo consultor. A restrição por "só Setor" ou "só Indústria" isolados foi
descontinuada; linhas antigas ficam no banco só para auditoria.

## Entregas 6 e 7 — Oportunidades (a "Vitrine")

Um conceito novo, paralelo ao wizard de consulta: qualquer consultor de
programa publica uma "oportunidade" comercial avulsa (data comemorativa, ação
de talento, período sazonal) atrelada a um programa que administra; qualquer
usuário autenticado vê o feed em `/oportunidades`. Só o consultor vinculado
àquele programa (ou o proprietário) edita ou exclui — reforçado por commit
recente ("security: restringir exclusão de oportunidade a consultor").

**A rota `/vitrine` existe só como redirecionamento** para `/oportunidades` —
mas a sidebar continua chamando o item de menu de "Vitrine", com `secao: null`
no código (deliberado: é a única entrada que ignora a matriz de seções por
perfil, "uma experiência transversal para todos os perfis autenticados",
conforme o próprio comentário do código). O nome de produto e o nome técnico
divergem de propósito — vale confirmar com quem decide UX se isso deve
continuar assim.

**Ponto de atenção — fora do padrão do resto do domínio:** não existe
`src/lib/dominio/oportunidades.ts`. As validações de data, moeda e regra de
negócio da oportunidade moram dentro da server action
(`src/lib/acoes/oportunidades.ts`), sem teste unitário. É a única área do
produto sem a separação domínio-puro-testado que rege o resto do código
(280 testes de domínio cobrindo as Entregas 1-3; nenhum cobrindo
oportunidades).

## Segurança — o que foi conferido

Toda server action nova (`acoes/oportunidades.ts`, `excluir-oportunidade.ts`,
`aprovacoes.ts`, `acompanhamento-propostas.ts`, `marcas-*.ts`, `modelo-
proposta.ts`, `email-programa.ts`, `perfis-acessos.ts`, `restricoes.ts`)
chama `obterSessao()` como primeira linha, com uma exceção correta: o
disparo do relatório diário de marcas (`src/lib/marcas/relatorio-diario.ts`)
não checa sessão de usuário porque não é chamado por um usuário — é um job
de servidor, protegido por comparação de `CRON_SECRET` no cabeçalho.

**Uma exceção real foi encontrada e corrigida nesta análise (commit
`96332e7`):** `carregarResumoFinanceiro` (`src/lib/acoes/resumo-
financeiro.ts`) não checava sessão — qualquer requisição de rede devolvia
preços e descontos de qualquer programa por ID. Já corrigido, seguindo o
mesmo padrão do resto do projeto.

## Testes — onde a cobertura de domínio existe e onde não existe

Cobertos, com teste de domínio puro: restrições (incluindo Segmentação SE),
performance/versionamento de propostas, casamento de anunciante/marca,
exibição marca×cliente, texto da proposta. **Sem teste de domínio:** a lógica
de negócio de oportunidades (não separada em módulo puro); a governança de
marcas automática×manual e o fluxo de aprovação (ambos vivem em SQL/RPC
`security definer`, não em TypeScript). Isso não significa ausência de
verificação — RPC com `security definer` é uma fronteira que o Postgres
aplica sozinha — mas significa que uma regra de negócio errada ali só se
descobre lendo SQL ou testando manualmente, nunca rodando `npm test`.

## O que esta análise corrigiu, fora do escopo de conteúdo deste documento

Registrado aqui para não se perder: `npm run build` estava quebrado (erro de
tipo real em `ExcluirOportunidadeFlutuante.tsx`, não estilo), `npm run lint`
reprovava com 17 erros reais (a maioria `setState` síncrono em efeito,
identificados e corrigidos pela causa, não suprimidos), `carregarResumo
Financeiro` sem sessão, e `@pdf-lib/fontkit` estava ausente do `package.json`
commitado enquanto o código de PDF ainda a importa. Tudo corrigido e
commitado (`96332e7`); `npm test` segue em 353/353.

## Pendências e observações para confirmar com quem decide o produto

- **`README.md` não foi atualizado** desde o rebranding — ainda começa com
  "# CHATBOT 2.0" e descreve o produto pela definição anterior a Oportunidades,
  Vitrine, Aprovações e Performance.
- **`src/components/consulta/CalendarioDeDisponibilidade.tsx` é código morto**
  — não é importado em lugar nenhum. Parece uma versão anterior do calendário
  do wizard de 3 passos, superada pela implementação atual em
  `consulta/calendario/page.tsx` mas nunca removida.
- **O nome "Vitrine" no menu e "Oportunidades" na rota/código**: confirmar se
  é decisão de marketing deliberada (o comentário no código sugere que sim)
  ou pendência de rebranding.
- **`assets/fonts/*.ttf` e os logos em `public/` não estão versionados** —
  confirmar se devem entrar no repositório ou se são ativos licenciados que
  devem ficar fora do controle de versão.
- **A cobertura de teste de oportunidades** fica abaixo do padrão do resto do
  domínio — vale decidir se isso é dívida a resolver ou um padrão aceito para
  esta área do produto.
- **As migrações de Entrega 4 a 7 já foram aplicadas no banco de produção?**
  Nenhum arquivo indica status de aplicação — só quem tem acesso ao Supabase
  real sabe.
