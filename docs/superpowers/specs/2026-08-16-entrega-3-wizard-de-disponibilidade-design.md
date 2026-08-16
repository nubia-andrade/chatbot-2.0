# CHATBOT 2.0 — Entrega 3: Wizard de disponibilidade

Data: 2026-08-16
Status: aguardando revisão

## Contexto

As Entregas 1 e 2 construíram tudo que o calendário precisa consultar: o login,
o cadastro dos programas com suas regras comerciais, a importação das vendas do
Globo Take, e — na Entrega 2 — as datas bloqueadas, as restrições de anunciante,
os períodos de preço diferenciado, a elegibilidade regional dos clientes e a
disponibilidade regional por praça.

Nada disso é visível ao executivo ainda. `src/app/(app)/consulta/page.tsx` é um
aviso de seção em construção. Esta entrega constrói a razão de existir do
produto: o wizard que responde **Posso vender? → Quando posso vender? → Quanto
custa?**

O handoff de design está em `design_handoff/` (a seção `#t1` do HTML é a
especificação; `#t2` é exploratório e deve ser ignorado). As telas `1b` a `1e`
são desta entrega.

## Objetivo

Ao final, um executivo comercial entra no sistema, escolhe um cliente da
carteira, vê a classificação dele e as regras que vão pesar, escolhe o programa
e a modalidade, lê um calendário mensal com a disponibilidade **já elegível
para aquele cliente**, seleciona datas — e, no regional, praças — e chega a um
resumo com o valor discriminado. A consulta fica gravada como o retrato do que
foi validado naquele instante.

O wizard **não reserva inventário**. Ele valida disponibilidade num instante, e
isso fica escrito na tela.

## Fora de escopo

- **Gerar a proposta**, o modelo de slides e o PDF (Entrega 4). O sétimo passo
  do handoff aparece no stepper, desabilitado, com a nota de quando chega — a
  mesma decisão que a Entrega 2 tomou com a aba Modelo de propostas.
- **Histórico de consultas e painel do executivo** (Entrega 4). Esta entrega
  grava as consultas; a tela que as lista vem depois.
- **Reserva de inventário.** O produto valida, não reserva. A arquitetura fica
  preparada para uma reserva temporária, mas ela não existe aqui.
- **Regras do Altas Horas**, que vende regional sem documento.
- **Mobile no cadastro.** As telas de consulta são responsivas — o executivo
  consulta fora da mesa; as de configuração seguem desktop-first.

## O fluxo

Seis passos, nas rotas abaixo, com o stepper de 7 pílulas do handoff no topo
(a sétima, Proposta, desabilitada):

| # | Rota | Pergunta que responde |
| --- | --- | --- |
| 1 | `/consulta/cliente` | Para quem você está vendendo? |
| 2 | `/consulta/setor` | O que o sistema sabe sobre esse cliente? |
| 3 | `/consulta/programa` | O que você está vendendo, e em que modalidade? |
| 4 | `/consulta/calendario` | Quando posso vender? |
| 5 | `/consulta/datas` | Quanto de cada data? |
| 6 | `/consulta/resumo` | Quanto custa? |

Uma rota por passo, e não uma tela só com estado interno: o botão voltar do
navegador é justamente onde o executivo mais recorre, e um F5 no quarto passo
não pode apagar os três anteriores. Um provider em `/consulta/layout.tsx`
guarda o estado e o espelha em `sessionStorage`. Cada rota tem um guarda que
devolve ao primeiro passo pendente quando alguém entra pela URL no meio.

## O motor de disponibilidade

O handoff é explícito: *"o front-end não deve depender de várias fontes
diretamente"*. Um único dia do calendário depende de seis fontes — o cadastro
do programa, `acoes_vendidas`, `datas_bloqueadas`, `restricoes_anunciante`,
`datas_especiais` e `acoes_regionais`.

**`src/lib/dominio/disponibilidade.ts`** concentra isso numa função pura:

```
calcularDisponibilidadeDoMes(insumos) → DiaDeDisponibilidade[]
```

Recebe tudo já carregado — o programa, as ações vendidas do mês, os bloqueios,
as restrições, os períodos especiais, as ações regionais, o cliente com sua
classificação e a data de hoje — e devolve, para cada dia: o estado, `livres` e
`total`, os motivos quando indisponível, as praças e seus estados no regional,
e o valor unitário daquele dia com o acréscimo de período especial já aplicado.

A camada `src/lib/dados/disponibilidade.ts` faz **um** carregamento por mês. O
Server Component carrega; o Client Component só pinta.

**Esta função não reimplementa regra nenhuma.** `contarOcupacao`,
`estaBloqueada`, `dentroDoPrazoMinimo`, `restricaoQueBloqueia`,
`concorrenteNaData`, `temSlotRegionalEm`, `pracasLivresEm`, `periodoEspecialEm`,
`calcularCustoDaAcaoRegional` e `calcularDireitosTv` já existem e estão
testados. Ela os **ordena**. É o único lugar do sistema que sabe em que ordem as
regras se aplicam, e é isso que a torna o arquivo mais importante da entrega.

### Estados de um dia

| Estado | Quando | Regra |
| --- | --- | --- |
| — sem exibição | dia fora de `dias_da_semana` (ou de `dia_da_semana_regional`) | R10 |
| 🟡 Fora do prazo mínimo | antes de hoje + `prazo_minimo_dias` (ou `prazo_minimo_regional_dias`) | R11 |
| ⛔ Bloqueado pelo programa | data em `datas_bloqueadas`, com o motivo cadastrado | R12 |
| 🔴 Indisponível por concorrência | concorrente do cliente já vendido na data | R14 |
| ⚫ Esgotado | `livres` = 0 | R1, R8 |
| 🟢 Disponível | sobrou slot (ou praça) | — |

**Dia sem exibição não é um estado, é ausência de inventário.** A célula fica
apagada e não interativa. "Esgotado" e "o programa não vai ao ar nesse dia" são
coisas diferentes, e confundi-las faz o executivo achar que perdeu uma venda que
nunca existiu.

**Os motivos se acumulam, a cor não.** Uma data pode estar ao mesmo tempo fora
do prazo e bloqueada pelo programa. `DiaDeDisponibilidade` carrega uma **lista**
de motivos, não um só. A célula pinta pelo primeiro da ordem acima — o prazo,
que forma uma faixa contígua legível de uma vez — e sinaliza que há mais de um
motivo; o detalhe da célula mostra os dois por extenso. Nenhuma informação se
perde e a faixa de prazo não fica furada por uma célula de outra cor.

**Feriado é ilustração, nunca regra.** O calendário mostra o nome do feriado na
célula — "Natal", "Carnaval" — para o executivo se situar no mês sem abrir outra
aba. Mas isso **não altera disponibilidade nem preço**: 25/12 só fecha se alguém
o cadastrou em `datas_bloqueadas`, e só muda de valor se estiver dentro de um
período de `datas_especiais`. Um feriado sem cadastro é um dia vendável como
outro qualquer, e a célula continua verde.

A separação precisa ser visível: o nome do feriado aparece como legenda discreta
da célula, no mesmo lugar em qualquer estado, e **nunca** como um dos motivos de
indisponibilidade. Quem lê "Natal" numa célula verde precisa entender que o
programa vende naquele dia.

`src/lib/dominio/feriados.ts` é uma função pura, sem banco: os feriados
nacionais fixos (01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12) e os
móveis derivados da Páscoa — Carnaval, Sexta-feira Santa e Corpus Christi —,
calculada pelo algoritmo de Meeus/Butcher. São os móveis que justificam a
função existir: ninguém sabe de cabeça quando cai o Carnaval de 2027, e é o
feriado que mais desloca grade comercial. Feriado estadual e municipal ficam de
fora — são muitos, mudam por praça, e o que decide continua sendo o cadastro.

**R16 — bloqueio mensal** entra nesta entrega, como a Entrega 2 registrou que
entraria. Atingido o teto do mês — `bloqueio_mensal` no nacional,
`bloqueio_mensal_regional` no regional (4 ações, conforme o Manual de Práticas)
—, todos os dias restantes do mês fecham, com o motivo por extenso. A contagem
é do mês da data consultada, não dos últimos 30 dias.

**R15 segue conservador**, como a Entrega 2 decidiu: a ação regional conta
também como ocupação do dia no inventário nacional, numa função isolada
(`regionalConsomeSlotNacional`) que se inverte em um ponto só quando a área
confirmar.

### Concorrência no nacional: casar o anunciante com a carteira

`acoes_vendidas.anunciante` é texto livre digitado do outro lado da API. Para
aplicar R14 é preciso descobrir o setor e a indústria de quem já comprou a data,
e isso exige casar esse texto com `clientes`.

**Medido contra o banco real (246 ações vendidas, 15.519 clientes):**

| Estratégia | Ações que casam |
| --- | --- |
| Nome normalizado (acento e caixa) | 48 de 246 — 19,5% |
| Nome reduzido (sem `*` final, sem forma societária) | 206 de 246 — 83,7% |

A redução tira o `*` que a API acrescenta, o conteúdo entre parênteses e as
formas societárias (`SA`, `S/A`, `LTDA`, `ME`, `EIRELI`, `CIA`, `DO BRASIL`,
`COMERCIO`, `INDUSTRIA`, `PARTICIPACOES`) — ruído puro para identificar de que
marca se trata. Vive em **`src/lib/dominio/casamento-anunciante.ts`**, com teste
sobre estes nomes reais.

Sobram 40 ações (14 nomes distintos: `PORTO SEGURO`, `PAGSEGURO`, `JBS`,
`EBAZAR.COM.BR`, `STELLANTIS AUTOMÓVEIS`, entre outros) que não estão na
carteira com grafia compatível, e 133 chaves que ficam **ambíguas** — dois
clientes diferentes viram o mesmo nome curto, com classificações que não batem,
e aí não há como saber qual é o setor do concorrente.

**Nome que não casa, ou que casa de forma ambígua, não bloqueia a data.** A
célula recebe uma marca discreta e o resumo diz "3 ações nesta data sem
classificação — concorrência não verificada". Bloquear por precaução esconderia
disponibilidade real por causa de grafia de cadastro, e o executivo não teria
como saber que a data existia. `concorrenteNaData` já segue essa convenção:
cliente sem classificação devolve nulo.

A área informou que a base de clientes do Globo Take será ajustada. A cobertura
de 83,7% é a foto de 16/08/2026 e deve subir; o aviso na tela é o que dá
visibilidade ao problema enquanto ele durar, e continua correto depois.

## As telas

Seguindo os tokens do handoff e o padrão das entregas anteriores.

**Passo 1 — Cliente.** Título "Para quem você está vendendo?", campo de busca de
58px com borda `2px #A031F5`, e a lista de resultados com setor e indústria em
cada linha. Reaproveita `CampoDeBuscaDeCliente`, construído na Entrega 2, que
**nunca aceita texto livre** — o cliente vem da carteira ou não vem.

**Passo 2 — Classificação.** Só leitura. Cartão com faixa de gradiente da marca
trazendo nome e CNPJ, e abaixo setor, indústria e se o cliente é apto a ações
regionais. Em seguida, as regras que vão pesar nesta consulta: os programas com
restrição cadastrada contra ele, e a categoria pela qual ele disputa
exclusividade por data.

A classificação **não é editável aqui**. Ela vem da carteira e só muda na
carteira — deixar corrigir no wizard recria exatamente a divergência que a
Entrega 2 combateu ao proibir texto livre nos campos de cliente. Cliente sem
setor ou indústria aparece com aviso explícito, dizendo que a verificação de
concorrência não vai rodar para ele e a quem pedir a correção.

**Passo 3 — Programa e modalidade.** Grade de cartões dos programas `ativo` e
`disponivel_para_proposta`, com capa, formato, comercialização, slots por dia e
antecedência mínima — esta em `#F59E0B`, como o handoff pede.

Programa com restrição cadastrada contra o cliente (R13) aparece **esmaecido e
não clicável, com o motivo à vista** ("Apresentadora não faz bebidas
alcoólicas"). Sumir da lista deixaria o executivo sem entender a ausência;
deixar escolher e negar dois passos depois seria pior ainda.

O cartão de um programa com `aceita_regional` oferece duas modalidades:
**Nacional** e **Regional**. Regional só aparece quando o cliente é
`apto_regional` **e** o executivo tem o perfil `executivo_regional`. Quando não
aparece, o cartão diz por quê — falta de elegibilidade do cliente e falta de
perfil são problemas diferentes, resolvidos por pessoas diferentes.

**Passo 4 — Calendário.** A tela central. Grade mensal de 7 colunas com gap de
6px, navegação entre meses, e a nota "Disponibilidade elegível para *Nestlé*".
Legenda com os estados. Cada célula, de 82px de altura mínima: número do dia em
Space Grotesk, dot de estado, "N livres" na cor do estado e "usados/total"
abaixo.

No **regional**, a célula do dia que tem slot mostra as cinco praças em
miniatura, cada uma com seu próprio estado — porque a pergunta regional não é
"este dia está livre?", e sim "o que está livre neste dia, para qual praça".

Célula não disponível não é clicável (`cursor: not-allowed`) e mostra o motivo.
Célula selecionada recebe borda `2px #7A2FF2` e o badge de check.

**Passo 5 — Datas.** O painel de 300px do handoff, agora como passo próprio: as
datas escolhidas, e para cada uma o contador de ações — começando em
`acoes_minimas`, limitado pelo menor entre `acoes_maximas` e os slots livres
daquele dia. No regional, as praças de cada data, com as já vendidas
desabilitadas e o teto de `max_pracas_por_acao` validado por `validarCompra`,
que já existe.

Cada data mostra seu subtotal. Remover uma data devolve os slots.

**Passo 6 — Resumo.** O valor discriminado: mídia, direitos e conexos e
produção, por data e no total, usando `calcularCustoDaAcaoRegional` e
`calcularDireitosTv` — que já são o cálculo oficial e não se duplicam aqui.
Período especial aparece **nomeado, com o acréscimo visível**, nunca embutido
no número: "Black Friday · +20%".

O aviso âmbar do handoff, obrigatório: "A proposta valida a disponibilidade
neste momento — não confirma reserva do inventário."

O botão **Gerar proposta** aparece desabilitado, com "Disponível na próxima
entrega".

Chegar a esta tela grava a consulta.

## Modelo de dados

**`consultas`** — o retrato do que foi validado:

| Coluna | Observação |
| --- | --- |
| `id`, `criado_em`, `usuario_id` | Quem consultou e quando |
| `cliente_id`, `cliente_nome`, `cliente_setor`, `cliente_industria` | Cópia, não só referência |
| `programa_id`, `programa_nome` | Idem |
| `modalidade` | `nacional` ou `regional` |
| `valor_total` | O total apurado no resumo |
| `avisos` | jsonb — o que não pôde ser verificado (concorrência sem classificação) |

**`consulta_itens`** — uma linha por data escolhida: `consulta_id`, `data`,
`quantidade`, `pracas` (text[], vazio no nacional), `valor_unitario`,
`valor_total`, e o período especial aplicado, quando houver.

**Guarda o retrato, não só as referências.** Preço muda, programa é renomeado,
cliente é reclassificado. Uma consulta feita em agosto precisa continuar dizendo
em novembro o que dizia em agosto — é isso que explica uma proposta divergente
semanas depois, e o motivo de `cliente_nome` conviver com `cliente_id`. Mesma
decisão que `acoes_regionais` já tomou ao guardar `cliente_nome` ao lado de
`cliente_id`.

`avisos` é jsonb porque a lista do que não pôde ser verificado vai crescer, e
não vale uma tabela: ninguém consulta por ela, só a lê junto da consulta.

## Segurança

As duas tabelas nascem com RLS ativo. O executivo lê e escreve as **próprias**
consultas (`usuario_id = auth.uid()`); o proprietário lê todas. Ninguém edita
consulta gravada — um retrato que se altera não é retrato.

A modalidade regional exige `executivo_regional` **no servidor**, não só na
interface: esconder a opção é conveniência de tela, a proteção real está na
server action e no banco.

## Testes

Cobrem `src/lib/dominio`, sem banco nem tela:

| Regra | Arquivo |
| --- | --- |
| Ordem dos estados, motivos acumulados, dia sem exibição | `disponibilidade.test.ts` |
| R11/R12 na mesma data, R14 no nacional, R16 mensal | `disponibilidade.test.ts` |
| Praças por data no regional, R10 fora do dia da semana | `disponibilidade.test.ts` |
| Redução de nome e casamento com a carteira | `casamento-anunciante.test.ts` |
| Feriados fixos e móveis, e que feriado não bloqueia | `feriados.test.ts` |
| O que pode virar consulta gravada | `consulta.test.ts` |

Os casos usam os números reais: Encontro com slot às sextas, 7 dias de prazo e
teto mensal de 4 ações regionais; É de Casa aos sábados com 10 dias. Os nomes
de `casamento-anunciante.test.ts` são os 14 que hoje não casam e os que passaram
a casar com a redução — medidos, não inventados.

## Critérios de aceite

1. O wizard percorre os seis passos, o botão voltar do navegador funciona e um
   F5 no meio não perde o que já foi escolhido.
2. Entrar por `/consulta/calendario` sem ter escolhido cliente devolve ao passo 1.
3. Cliente só vem da carteira; nenhum campo aceita nome digitado.
4. Programa com restrição contra o cliente aparece esmaecido, com o motivo.
5. A modalidade Regional só aparece para cliente apto e executivo com perfil
   regional, e é recusada no servidor quando forçada sem perfil.
6. No Encontro, uma sexta com SP, RJ e BH vendidos mostra DF e PE1 livres; uma
   quinta-feira não mostra disponibilidade regional alguma.
7. Data dentro do prazo mínimo aparece amarela; data também bloqueada mostra os
   dois motivos no detalhe, sem furar a faixa amarela.
8. Mês com o teto de ações atingido fecha, com o motivo por extenso.
9. Feriado aparece nomeado na célula e **não** altera o estado: um 25/12 sem
   cadastro segue disponível e vendável; o mesmo 25/12 em `datas_bloqueadas`
   fecha pelo bloqueio, não por ser feriado. Carnaval é calculado corretamente
   em pelo menos três anos diferentes.
10. Data com ação de concorrente do cliente aparece vermelha, nomeando o
    concorrente; data com anunciante não classificado segue disponível, com o
    aviso de concorrência não verificada.
11. O resumo discrimina mídia, direitos e produção, e nomeia o período especial
    com o percentual.
12. Chegar ao resumo grava uma linha em `consultas` e uma por data em
    `consulta_itens` — verificado direto no banco.
13. O aviso de que não há reserva de inventário está visível no resumo.
14. `npm test` passa; `npm run build` e `npm run lint` completam sem erro.

## Pendências para confirmar com a área

- **Se a ação regional consome o slot nacional** (R15 segue conservador).
- **Os valores por praça**, marcados como "checar com Pricing".
- **As regras do Altas Horas**, que vende regional sem documento.
- **O que é o "pré-projeto"** que as regras mandam emitir.
- **Se as praças de uma mesma ação podem ter anunciantes diferentes.**
- **O ajuste da base de clientes do Globo Take**, que deve elevar a cobertura do
  casamento de anunciantes acima dos 83,7% medidos hoje.
