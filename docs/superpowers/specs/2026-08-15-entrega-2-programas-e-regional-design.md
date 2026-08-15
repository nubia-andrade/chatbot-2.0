# CHATBOT 2.0 — Entrega 2: Área do programa, perfis e ações regionais

Data: 2026-08-15
Status: aguardando revisão

## Contexto

A Entrega 1 deixou pronto o alicerce: login, cadastro de programas com suas
regras comerciais, e a importação das vendas do Globo Take. O passo natural
seria o wizard de disponibilidade, mas a área trouxe três informações que o
calendário precisa conhecer **antes** de existir, sob pena de nascer mentindo:

1. **Datas bloqueadas** — o programa pode fechar uma data mesmo com slot livre.
2. **Restrições de anunciante** — o apresentador não faz certas categorias, e
   concorrentes não dividem o mesmo dia.
3. **Ações regionais** — a disponibilidade deixa de ser "quantos slots livres
   neste dia" e passa a ser "o que está livre neste dia, para esta praça".

Esta entrega constrói essas três coisas e a estrutura que as abriga. O wizard
vem na Entrega 3, já nascendo completo.

Regras regionais registradas em `docs/regras-acoes-regionais.md`.

## Objetivo

Ao final, um consultor de programa entra no sistema, abre o programa pelo qual
responde, e configura tudo que o calendário vai consultar: o cadastro, as datas
bloqueadas, as restrições de anunciante, e — para os programas elegíveis — as
praças, os preços e as ações regionais já vendidas.

## Fora de escopo

- O wizard de disponibilidade e o calendário (Entrega 3).
- Geração de proposta, modelo de slides e PDF (Entrega 4).
- Histórico de propostas e o painel do executivo (Entrega 4) — dependem de
  propostas existirem.
- Regras do **Altas Horas**, que vende regional mas não tem documento.

## Perfis de acesso

Hoje `perfil_usuario` guarda **um** perfil por pessoa. Isso não se sustenta: a
área confirmou que executivos acumulam nacional e regional, e alguém pode ser
consultor de um programa e executivo em outro contexto.

**Mudança:** perfil vira uma **lista** por usuário. `perfil_usuario` passa a ter
uma linha por par usuário/perfil.

| Perfil | Pode | Não pode |
| --- | --- | --- |
| `executivo` | Consultar disponibilidade nacional, gerar proposta, ver seu histórico | Ver ou editar cadastro de programa |
| `executivo_regional` | Consultar disponibilidade por praça e solicitar ação local | Idem |
| `consultor_programa` | Editar os programas sob sua responsabilidade | Excluir programa; tocar em programa de outro consultor |
| `proprietario` | Tudo, inclusive excluir programa e gerenciar usuários | — |

`executivo_regional` é acumulável com `executivo`: quem tem os dois enxerga a
opção de consulta regional; quem tem só `executivo` nem sabe que ela existe.

**Consultor é dono de programas específicos.** Nova tabela
`consultor_programa` (usuário × programa). Sem vínculo, o consultor não edita
nada — nem por interface, nem por RLS.

## Modelo de dados

### Alterações no que existe

**`perfil_usuario`** — deixa de ter chave primária em `usuario_id`. Passa a
`(usuario_id, perfil)`, permitindo várias linhas por pessoa. `nome` e `cargo`
saem para uma tabela `usuario` própria, para não se repetirem a cada perfil.

**`programas`** — ganha:

| Coluna | Tipo | Para quê |
| --- | --- | --- |
| `aceita_regional` | boolean | Se o programa vende ação regional |
| `dia_da_semana_regional` | smallint | Dia fixo do slot regional (5=sexta no Encontro, 6=sábado no É de Casa) |
| `prazo_minimo_regional_dias` | int | 7 no Encontro, 10 no É de Casa — distinto do prazo nacional |
| `max_pracas_por_acao` | int | Quantas praças um mesmo cliente compra numa ação (hoje 3) |
| `direitos_e_conexos` | numeric(14,2) | Valor fixo por ação regional |
| `custo_producao_regional` | numeric(14,2) | Custo de produção da ação regional |

### Tabelas novas

**`usuario`** — `(usuario_id, nome, cargo, criado_em)`. Recebe o que hoje mora
em `perfil_usuario` e não faz sentido repetir a cada perfil. Uma linha por
pessoa.

**`pracas`** — as 5 Globos: `SP`, `RJ`, `BH`, `DF`, `PE1`, com nome de exibição.
Tabela pequena e fixa, mas tabela: amanhã entra uma praça nova sem mexer em
código.

**`preco_regional`** — `(programa_id, praca_id, valor)`. É a tabela de preços
do documento: Encontro/SP = 49.000, Encontro/RJ = 25.000, e assim por diante.
Guarda também `atualizado_em`, porque os valores estão marcados como
provisórios ("checar com Pricing").

**`datas_bloqueadas`** — `(programa_id, data, motivo, criado_por)`. Uma data
bloqueada é indisponível mesmo com slot livre. `motivo` é texto livre e
obrigatório: quem consulta precisa saber por que aquele dia está fechado.

**`restricoes_anunciante`** — a restrição estática, cadastrada pelo consultor:

| Coluna | Observação |
| --- | --- |
| `programa_id` | A qual programa se aplica |
| `anunciante` | Nome do cliente, ou nulo |
| `setor` | Setor da carteira, ou nulo |
| `industria` | Indústria da carteira, ou nulo |
| `motivo` | Texto livre, obrigatório |

Pelo menos um entre `anunciante`, `setor` e `industria` precisa estar
preenchido — garantido por `check`. Isso cobre as três formas que a área
descreveu: cliente nomeado, categoria inteira ("bebidas alcoólicas"), ou o
cruzamento dos dois.

A restrição **por concorrência** não entra aqui: ela é calculada no momento da
consulta, cruzando o que já está vendido na data com a classificação da
carteira. Só o que ninguém consegue deduzir é que se cadastra.

**`acoes_regionais`** — a base que o consultor alimenta:

| Coluna | Observação |
| --- | --- |
| `programa_id`, `data_de_exibicao` | Qual programa, qual data |
| `cliente_id` | Referência a `clientes` |
| `praca_id` | Uma linha por praça vendida |
| `origem` | `manual` ou `sugerido_api` |
| `numero_da_entrega` | Vínculo com a ação da API, quando houver |

**Uma linha por praça**, não uma linha por ação com lista de praças. Um cliente
que compra SP, RJ e BH gera três linhas. Isso torna a consulta de
disponibilidade trivial (`where data e praca`) e o limite de 3 praças vira uma
validação na escrita, não uma estrutura de dados.

## Regras de negócio

Todas em `src/lib/dominio/`, com teste, seguindo o padrão da Entrega 1.

**R8 — Slot regional é por praça.** Cada praça tem seu próprio slot na data. No
Encontro, uma sexta comporta 5 slots independentes (SP, RJ, BH, DF, PE1).
Vendido SP, as outras quatro seguem livres para outros clientes.

**R9 — Um cliente compra no máximo `max_pracas_por_acao` praças** (hoje 3) numa
mesma ação, consumindo o slot de cada praça envolvida.

**R10 — O slot regional só existe no dia da semana do programa.** Encontro só
tem regional às sextas; É de Casa, aos sábados. Fora desse dia, não há
disponibilidade regional — nem "esgotado", simplesmente não existe.

**R11 — Prazo mínimo regional é próprio.** 7 dias no Encontro, 10 no É de Casa,
contados da data da consulta até a exibição. Data dentro do prazo aparece como
bloqueada por prazo.

**R12 — Data bloqueada vence tudo.** Se a data está em `datas_bloqueadas`, não
importa quantos slots estejam livres: indisponível, com o motivo à vista.

**R13 — Restrição de anunciante bloqueia o cliente no programa inteiro.** Se o
cliente, seu setor ou sua indústria casa com uma restrição cadastrada, aquele
programa não é oferecido para ele. A checagem é por correspondência do mais
específico para o mais genérico: anunciante, depois setor+indústria, depois
setor ou indústria isolados.

**R14 — Concorrência bloqueia por data.** Se já existe ação vendida na data para
um cliente de mesmo setor e indústria, outro cliente daquela categoria não pode
entrar na mesma data. Vale para nacional e regional.

**R15 — Ação regional consome slot nacional (provisório).** Enquanto a área não
confirmar, a ação regional conta também como ocupação do dia no inventário
nacional. É o caminho conservador: mostrar menos disponibilidade nacional do
que existe custa uma venda possível; o contrário faz vender espaço inexistente.
A regra vive numa função isolada, para inverter em um ponto só.

**R16 — Bloqueio mensal do regional.** 4 ações no mês fecham o mês, conforme o
Manual de Práticas. Reaproveita o campo `bloqueio_mensal` já existente.

## Telas

Seguindo os tokens do handoff e o padrão da Entrega 1.

**Lista de programas** — deixa de ser tabela e vira **grade de cartões**, como o
sistema atual, mas com o visual do CHATBOT 2.0: capa com a imagem do programa
(ou gradiente da marca, quando não houver), nome, status colorido, data da
última modificação, e um botão **Ver** que leva à área do programa. O menu de
três pontos traz **Editar** e — só para o proprietário — **Excluir**. Busca por
nome no topo.

**Área do programa** — cabeçalho com a imagem e o nome, e abas:

| Aba | Conteúdo |
| --- | --- |
| Cadastro | Os 19 campos da Entrega 1 |
| Datas bloqueadas | Calendário simples com as datas fechadas e seus motivos |
| Restrições | Lista de anunciantes, setores e indústrias vetados |
| Regional | Praças elegíveis, preços por praça, e as ações já vendidas |

A aba Regional só aparece quando `aceita_regional` está marcado.

**Modelo de propostas** fica de fora desta entrega, por decisão de escopo: ele
não alimenta o cálculo de disponibilidade e depende de definir a proposta em
si, o que acontece na Entrega 4. A aba nasce visível e desabilitada, com a nota
de quando chega — melhor do que aparecer sem aviso.

## Experiência do usuário

A área pediu a melhor experiência possível. Traduzido em decisões que valem
para toda a entrega, e que a revisão deve cobrar:

**Aproveitar o que o sistema já sabe.** O banco tem 15.519 clientes com setor e
indústria. Nenhum campo que se refira a cliente, setor ou indústria pode ser
texto livre: são campos de busca que completam a partir da carteira. Digitar
"Ambev" à mão cria "AMBEV", "Ambev S/A" e "ambev" — três restrições que não se
reconhecem. O mesmo vale para as praças e para os programas.

**Sugerir a partir da API, decidir com gente.** Ao cadastrar uma ação regional,
o sistema lê a `descritivo_da_acao` da entrega correspondente, propõe as praças
que reconheceu ("Ação regional para SP1, RJ + BH" → SP, RJ e BH pré-marcadas) e
deixa o consultor confirmar ou corrigir. Ele digita menos e a decisão continua
sendo humana. O campo `origem` registra se veio de sugestão ou do zero.

**Nunca perder trabalho digitado.** Formulário com alteração não salva avisa
antes de sair da página. Erro de gravação devolve o formulário preenchido, com
o foco no primeiro campo com problema — nunca uma tela em branco e um "erro ao
salvar".

**Todo estado tem forma.** Carregando, vazio, com erro e cheio são quatro telas
diferentes, e as quatro precisam existir. O vazio explica o que fazer ("Nenhuma
data bloqueada. Bloqueie datas em que o programa não aceita ação, como
feriados") em vez de mostrar uma lista vazia sem contexto.

**Toda ação dá retorno imediato.** Botão que grava fica desabilitado enquanto
grava — se der para clicar duas vezes, alguém vai. Sucesso é confirmado
visivelmente, não deduzido pelo silêncio.

**Destruir exige confirmação nomeada.** Excluir programa pede que a pessoa
digite o nome do programa. Não é fricção gratuita: é a única ação irreversível
desta entrega, e leva junto datas bloqueadas, restrições, preços e ações
regionais.

**Mostrar a consequência, não só o dado.** A aba Regional não lista apenas
preços: mostra o valor total de uma ação nas praças selecionadas, somando
direitos e conexos e produção — que é a pergunta que o consultor realmente tem.
Datas bloqueadas mostram quantas ações seriam afetadas antes de confirmar.

**Calendário se mostra como calendário.** Datas bloqueadas e disponibilidade
regional aparecem em grade mensal, com os mesmos estados coloridos do handoff,
não como lista de datas. A informação é temporal; a forma acompanha.

**Acessibilidade não é etapa final.** Todo campo tem rótulo associado, foco
visível, e navegação por teclado funcional. Cor nunca é o único indicador de
estado — sempre acompanhada de texto ou ícone. Contraste mínimo de 4.5:1 para
texto, conforme WCAG AA.

**Responsivo de verdade nas telas de consulta.** O executivo consulta
disponibilidade fora da mesa. O cadastro pode ser desktop-first; a consulta,
não.

## Segurança

O RLS ganha uma função `e_consultor_de(programa_id)`, e as políticas de escrita
de `programas`, `datas_bloqueadas`, `restricoes_anunciante`, `preco_regional` e
`acoes_regionais` passam a exigir `e_consultor_de(...)` ou `e_proprietario()`.
Só o proprietário apaga programa.

Esconder aba ou botão é conveniência de interface; a proteção real continua no
banco.

## Testes

Cobrem `src/lib/dominio`, sem banco nem tela:

| Regra | Arquivo |
| --- | --- |
| R8/R9 — slot por praça e teto de praças por ação | `regional.test.ts` |
| R10/R11 — dia da semana e prazo mínimo regional | `regional.test.ts` |
| R12 — data bloqueada vence | `bloqueios.test.ts` |
| R13 — restrição por anunciante, setor e indústria | `restricoes.test.ts` |
| R14 — concorrência por data | `restricoes.test.ts` |
| R15 — regional consumindo slot nacional | `ocupacao.test.ts` |
| Perfis acumuláveis e vínculo consultor-programa | `perfis.test.ts` |

Os testes usam as regras reais do documento: Encontro com 1 slot às sextas e 7
dias de prazo; É de Casa com 1 slot aos sábados e 10 dias.

## Critérios de aceite

1. Uma pessoa pode ter mais de um perfil, e quem tem `executivo_regional`
   enxerga a consulta regional; quem não tem, não.
2. Um consultor só edita os programas aos quais está vinculado — verificado
   também com a interface contornada, direto no banco.
3. A lista de programas mostra cartões com imagem, status e data de
   modificação; **Excluir** só aparece para o proprietário.
4. É possível bloquear uma data com motivo, e ela aparece bloqueada.
5. É possível cadastrar restrição por anunciante, por setor+indústria e só por
   categoria.
6. No Encontro, numa sexta com SP, RJ e BH vendidos, `DF` e `PE1` continuam
   disponíveis, e um quarto cliente não consegue comprar SP.
7. Numa quinta-feira, o Encontro não oferece disponibilidade regional alguma.
8. Campos de cliente, setor e indústria completam a partir da carteira — não
   aceitam texto livre.
9. Sair de um formulário alterado sem salvar dispara aviso.
10. Excluir programa exige digitar o nome do programa.
11. Toda lista tem estado vazio com orientação, e todo botão de gravação fica
    desabilitado durante a gravação.
12. `npm test` passa; `npm run build` completa sem erro.

## Pendências para confirmar com a área

- **Se a ação regional consome o slot nacional** (R15 segue conservador).
- **Os valores por praça**, marcados no documento como "checar com Pricing".
- **As regras do Altas Horas**, que vende regional sem documento.
- **O que é o "pré-projeto"** que as regras mandam emitir — mesmo documento da
  proposta nacional, ou artefato próprio.
- **Se as praças de uma mesma ação podem ter anunciantes diferentes** — o
  modelo atual permite, já que a linha é por praça.
