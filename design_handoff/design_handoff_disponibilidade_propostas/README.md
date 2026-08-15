# Handoff: App de Consulta de Disponibilidade & Geração de Propostas ("chatbot 2.0")

## Overview
Aplicativo web responsivo (desktop-first) para executivos comerciais consultarem a
disponibilidade **real e elegível** de um cliente antes de gerar uma proposta comercial.
O fluxo é visual e determinístico — a disponibilidade vem de dados + regras de negócio,
não de linguagem natural. O objetivo é impedir propostas para datas/programas/espaços
indisponíveis ou em conflito comercial.

O fluxo do usuário responde a três perguntas, nesta ordem, antes de liberar **Gerar proposta**:
**Posso vender? → Quando posso vender? → Quanto custa?**

Fluxo canônico: `Cliente → Setor/Categoria → Programa/Produto → Calendário → Datas → Resumo → Proposta`.

## About the Design Files
Os arquivos deste bundle são **referências de design feitas em HTML** — protótipos que
mostram a aparência e o comportamento pretendidos, **não** código de produção para copiar
diretamente. A tarefa é **recriar estes designs no ambiente do codebase de destino**
(React/Next, Vue, etc.) usando os padrões e bibliotecas já estabelecidos. Caso ainda não
exista um ambiente, escolher o framework mais adequado e implementar os designs nele.

Recomendação de arquitetura (do escopo): o front-end **não** deve depender de várias fontes
diretamente. Consumir uma **camada única de dados/API** que já entrega a disponibilidade com
as regras aplicadas: `Slots existentes − vendidos − reservados − conflitos de concorrência −
patrocinadores conflitantes − bloqueios por prazo − regras do programa`.
Regras de negócio devem ser **parametrizáveis** (antecedência mínima, slots por programa/data,
categorias concorrentes, etc.), nunca hardcoded na UI.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamentos e estados finais estão definidos
abaixo com valores exatos. Recriar a UI fielmente usando as bibliotecas/padrões do codebase.

> **Escopo deste handoff = Turn 1 (fluxo principal).** O arquivo HTML `Chatbot 2.0 - Telas.dc.html`
> contém duas seções: `#t1` (fluxo principal — a especificação) e `#t2` (variações exploratórias,
> **fora de escopo** — ignorar na implementação). Direção escolhida: **navegação em sidebar + wizard
> de 7 passos**, calendário em **grade mensal** (tela `1e`).

---

## Design Tokens

### Cores
| Token | Hex | Uso |
|---|---|---|
| Brand gradient | `linear-gradient(135deg,#FF2D55 0%,#A031F5 52%,#2D6BFF 100%)` | Logo, botões primários, painéis hero, item de nav ativo |
| Gradient tile A | `linear-gradient(160deg,#FFD23F,#FF5E3A)` | Tiles decorativos (login) |
| Gradient tile B | `linear-gradient(160deg,#12D8FA,#2D6BFF)` | Tiles / capas de programa |
| Gradient tile C | `linear-gradient(160deg,#F857A6,#7A2FF2)` | Tiles decorativos |
| Roxo primário (texto/acento) | `#7A2FF2` | Links, destaques, valor, borda selecionada |
| Roxo hover | `#5E22C4` | `a:hover` |
| Texto principal | `#1A1626` | Títulos/corpo |
| Texto secundário | `#6B6577` / `#8A8497` | Subtítulos, labels |
| Texto terciário / placeholder | `#A79FB4` / `#B4AEC0` | Metadados, placeholders |
| Fundo app (canvas) | `#E7E5EE` | Fundo geral do documento |
| Superfície branca | `#FFFFFF` | Cards, painéis |
| Superfície suave | `#FAF9FC` / `#FCFBFE` | Inputs, right rail |
| Bordas | `#ECEAF1` / `#F0EEF4` / `#E2DFEA` / `#EDEBF2` | Divisórias e contornos |
| Chrome do browser mock | `#F5F4F8` | Barra superior da janela |

### Status de slot (5 estados) — cor + fundo
| Estado | Cor (dot/texto) | Fundo célula | Selecionável |
|---|---|---|---|
| 🟢 Disponível | `#16A34A` | `#EAF7EF` | Sim |
| 🔴 Indisponível por concorrência | `#E11D48` | `#FDECEF` | Não |
| 🟡 Bloqueado por prazo | `#F59E0B` | `#FEF4E6` | Não |
| ⚪ Reservado / em negociação | `#64748B` | `#EEF1F5` | Não |
| ⚫ Esgotado | `#1E1B2E` | `#E9E7EE` | Não |
| Selecionada (overlay) | borda `2px solid #7A2FF2` + badge check `#7A2FF2` | — | — |

### Tipografia
- **Headings / números:** `'Space Grotesk'` (Google Fonts), pesos 400–700.
- **Corpo / UI:** `'Manrope'` (Google Fonts), pesos 400–800.
- Escala usada: título de tela **26–28px/700**; título hero login **44px/800**; seção **18–20px/700**;
  labels **11–13px/600–700**; metadados **10–12px/500**; uppercase labels com `letter-spacing:.5px`.
- `letter-spacing:-.5px` a `-1px` nos títulos grandes em Space Grotesk.

### Raios, sombras, espaçamento
- Border-radius: janela/card **16px**; sub-card **12–14px**; input **11–14px**; botão **11–12px**;
  pílula/tag **20px**; célula de calendário **11px**; avatar **50%**.
- Sombra de janela: `0 18px 50px rgba(60,30,110,.14)`.
- Sombra de botão primário: `0 12px 26px rgba(122,47,242,.28–.32)`.
- Sombra de card selecionado: `0 14px 34px rgba(122,47,242,.18)`.
- Gaps: grid de calendário **6px**; grids de cards **16px**; padding de conteúdo **34–40px**.

---

## Screens / Views (Turn 1)

### 1a — Login
- **Purpose:** autenticação do executivo (conta corporativa).
- **Layout:** split 52% / 48%.
  - **Esquerda (52%)**: painel com `brand gradient`, 3 tiles arredondados flutuantes (animação `floaty`,
    translateY ±14px, rotação leve, `box-shadow 0 20px 40px rgba(0,0,0,.22)`), logo `chatbot2.0` no topo,
    headline **"Posso vender? Quando? Quanto?"** (44px/800 branco), subtítulo, rodapé
    "Disponibilidade → Proposta → PDF".
  - **Direita (48%)**: form centralizado — título "Entrar", campo **E-mail corporativo**, campo **Senha**,
    link "Esqueci minha senha" (alinhado à direita), botão primário **Entrar** (52px, brand gradient),
    divisor "ou", botão secundário **Entrar com SSO corporativo** (borda `#E2DFEA`).
- **Estados:** inputs com placeholder `#B4AEC0`, foco → borda `#A031F5`.

### 1b — Busca de cliente (passo 1 de 7)
- **Purpose:** pesquisar o anunciante por nome ou CNPJ; setor/categoria são detectados automaticamente.
- **Layout:** app shell = **sidebar 224px** + **main** (header 60px + stepper + conteúdo).
  - **Sidebar (branca, borda direita `#F0EEF4`):** logo; itens: Início, **Nova consulta (ativo)**,
    Propostas, Histórico, Configurações. Item ativo = pílula `linear-gradient(135deg,rgba(255,45,85,.12),rgba(45,107,255,.12))`,
    texto `#7A2FF2`, dot com brand gradient; itens inativos = dot `#D6D1E0`, texto `#8A8497`.
    Rodapé: avatar + "Marina Alves / Executiva comercial".
  - **Header:** "Nova consulta" + "Etapa 1 de 7".
  - **Stepper (7 pílulas):** 1·Cliente (ativo, brand gradient, texto branco) · 2·Setor · 3·Programa ·
    4·Calendário · 5·Datas · 6·Resumo · 7·Proposta (inativos: fundo `#F5F4F8`, texto `#B4AEC0`).
  - **Conteúdo:** título "Para quem você está vendendo?"; input de busca grande (58px, borda `2px #A031F5`,
    sombra roxa suave); chips de recentes (Itaú, Ambev, Magalu); lista "3 resultados" — primeiro item com
    **borda gradiente** (padding-box + border-box), tag de categoria (`rgba(122,47,242,.1)` texto `#7A2FF2`)
    e botão **Selecionar** (brand gradient); demais itens neutros.

### 1c — Identificação de setor / categoria (passo 2 de 7)
- **Purpose:** exibir a classificação governada do cliente e as regras de concorrência aplicáveis.
- **Layout:** mesmo shell. Header "Etapa 2 de 7"; stepper com **1·Cliente = "✓ Cliente"** (verde
  `#16A34A` / `#EAF7EF`) e **2·Setor ativo**.
- **Componentes:**
  - **Card do cliente:** faixa superior com brand gradient (nome 20px/800 branco + CNPJ + tag
    "Cliente selecionado"); abaixo grid de 3 colunas: **Setor** = "Bens de consumo",
    **Indústria** = "Alimentos & Bebidas", **Categoria comercial** = "Alimentos".
  - **Regras de concorrência aplicáveis:** linha de alerta vermelha (`#FDECEF`/borda `#FDE0E6`,
    texto `#8B1030`) "Bloqueio para concorrentes diretos na categoria **Alimentos** — exclusividade por data";
    linha neutra "Categorias concorrentes: Snacks, Chocolates, Café — 4 categorias".
  - **Ações:** "← Voltar" (secundário) + "Selecionar programa →" (primário, brand gradient).

### 1d — Seleção de programa / produto (passo 3 de 7)
- **Purpose:** escolher o programa/oportunidade comercial a consultar.
- **Layout:** shell; conteúdo com título "O que você está vendendo?" e **grid de 3 cards**.
  - Cada card: capa 104px com gradiente próprio + nome (18px/800 branco); corpo com linhas
    label/valor: **Formato**, **Comercialização** (período), **Slots/dia**, **Antecedência mínima**
    (valor em `#F59E0B`).
  - Card selecionado ("Novela das 9") = borda `2px #A031F5` + sombra roxa + badge "Selecionado".
  - Rodapé: faixa tracejada informando que regras/antecedência vêm da **biblioteca do programa
    (parametrizável no admin)** + botão "Ver calendário →".

### 1e — Calendário de disponibilidade (passo 4 de 7) — **tela central**
- **Purpose:** mostrar a disponibilidade **elegível para o cliente** por dia e selecionar datas.
- **Layout:** shell; área dividida em **calendário (flex:1)** + **right rail 300px**.
  - **Cabeçalho do calendário:** navegação ‹ "Março 2026" › + nota "Disponibilidade elegível para **Nestlé**".
  - **Legenda:** os 5 estados (dot colorido + label).
  - **Grid:** cabeçalho Dom–Sáb; grade de 7 colunas, gap 6px. Cada célula (min-height 82px): número do dia
    (Space Grotesk 14px), dot de status no canto, "{avail} livres" (na cor do status), "{used}/{total}" abaixo.
    Célula com fundo por status. **Selecionada:** overlay borda `2px #7A2FF2` + badge check circular roxo (15px).
    Datas selecionadas padrão no protótipo: **5, 12, 19**; regra de negócio: só estados `Disponível` são selecionáveis.
  - **Right rail (`#FCFBFE`):** "Datas selecionadas" (lista com dot verde, data, "N inserções", botão remover ×);
    bloco resumo (Datas, Inserções, **Valor estimado R$ 148.000** em roxo);
    aviso âmbar "A proposta valida a disponibilidade neste momento — não confirma reserva do inventário";
    botão **Gerar proposta →** (50px, brand gradient).

---

## Interactions & Behavior
- **Navegação do wizard:** passos avançam via botões primários; passos concluídos viram "✓ <nome>" em verde
  no stepper. Voltar preservando seleção.
- **Busca de cliente:** debounce na digitação → chamar API de clientes; ao selecionar, disparar identificação
  de setor/categoria (server-side, taxonomia única e governada).
- **Seleção de datas:** apenas células `Disponível` são clicáveis; clique alterna seleção (overlay roxo + badge).
  Estados não elegíveis são visualmente distintos e não interativos (cursor `not-allowed`).
- **Gerar proposta:** habilitado quando há ≥1 data selecionada e todas as validações passam. O MVP apenas
  **registra que a disponibilidade foi validada naquele momento** (não reserva definitiva) — deixar isso explícito na UI.
- **Animação:** tiles do login usam keyframe `floaty` (≈6–8s, ease-in-out, translateY 0→-14px, rotação preservada por `--r`).
- **Hover/focus:** inputs → borda `#A031F5`; itens de lista/nav → realce sutil; links → `#5E22C4`.

## State Management
- `session/auth`: usuário logado (executivo), perfil de acesso (Executivo / Admin Programa / Admin Geral).
- `consulta` (wizard): `{ cliente, classificacao: {setor,industria,categoria,concorrentes[]}, programa,
  mesVisivel, disponibilidadePorDia[], datasSelecionadas[], resumo:{datas,insercoes,valorEstimado} }`.
- **Disponibilidade por dia** vem já resolvida da camada de API (estado + slots total/used/avail por data);
  o front não recalcula regras.
- Concorrência de acesso: diferenciar **Disponibilidade → Proposta → Reserva/Fechamento** (arquitetura
  preparada para reserva temporária configurável — fora do MVP).

## Responsive behavior
Desktop-first neste entregável. Mobile (fase seguinte): calendário permanece legível com sinalização por cor;
filtros em painel lateral/modal; resumo em cards; ações principais sempre acessíveis.

## Assets
- **Fontes:** Google Fonts — Space Grotesk (400,500,600,700) e Manrope (400,500,600,700,800).
- **Imagens:** nenhuma imagem raster usada; capas de programa e tiles são gradientes CSS. Substituir por
  imagens reais dos programas quando disponíveis (biblioteca de templates do programa).
- **Ícones:** apenas formas simples (dots, glifos ‹ › ✓ ×). Trocar pelo icon set do codebase.
- **Marca:** `chatbot 2.0` é um placeholder de marca própria — **não** usar o logo/branding da Globo.

## Files
- `Chatbot 2.0 - Telas.dc.html` — protótipo hi-fi (seção `#t1` = escopo; `#t2` = variações, ignorar).
  É um Design Component (renderiza standalone no navegador). Abrir para referência visual pixel a pixel.
