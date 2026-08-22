# Handoff: Vitrine de Oportunidades (consultores dos programas do chat)

## Overview
App web onde consultores de marketing postam "oportunidades de ação" (ações comemorativas, sazonais e participações de talentos nos programas) em formato de **vitrine** de cards. Cada card mostra uma imagem (pequena/média) com um selo automático de **data + programa**, contador de **slots disponíveis** e **curtidas**. Há uma **visão de calendário** com datas especiais/comemorativas e um **fluxo de postagem** com prévia ao vivo. Ao abrir um card, o consultor pode **gerar uma consulta**.

## About the Design Files
Os arquivos deste pacote são **referências de design em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não** código de produção para copiar diretamente. A tarefa é **recriar esses designs no ambiente do codebase alvo** (React, Vue, etc.) usando os padrões e bibliotecas já estabelecidos. Se ainda não houver ambiente, escolha o framework mais adequado (recomendação: React + TypeScript) e implemente lá.

O protótipo `Vitrine Hi-Fi.dc.html` é um "Design Component" (formato de streaming) que roda no browser abrindo o arquivo. Serve como fonte de verdade visual e de interação.

## Fidelity
**High-fidelity (hifi).** Cores, tipografia, espaçamento e interações são finais e devem ser recriados fielmente. Existe também um arquivo de wireframes low-fi (`Vitrine Wireframes.dc.html`) apenas como histórico da exploração — não é a referência final.

## Screens / Views
Navegação por top-nav; troca de view por estado (`view`: `vitrine | detail | calendar | post`).

### 1. Vitrine (feed de cards) — view `vitrine`
- **Purpose**: consultor navega pelas oportunidades ativas, curte e filtra.
- **Layout**: container centralizado `max-width:1180px`, padding `34px 28px 70px`. Hero no topo com kicker em maiúsculas (`#ff5a3c`), título Poppins 800 44px e subtítulo. Tipografia "fantasma" decorativa "2026" atrás do hero (`font-size:150px`, `color:rgba(20,22,26,.035)`). Linha de filtros (chips) + "ordenar: mais slots". Grade de cards `grid-template-columns:repeat(4,1fr); gap:22px`.
- **Card (componente-chave)**:
  - Container branco, `border-radius:20px`, `box-shadow:0 6px 20px -12px rgba(20,22,26,.3)`; hover eleva `translateY(-6px)` + sombra maior (`.card-lift`, transição `.18s cubic-bezier(.2,.7,.3,1)`).
  - Área de imagem `aspect-ratio:3/4`, fundo = gradiente do programa (placeholder para a imagem postada). Texto placeholder "imagem do programa" centralizado (`rgba(255,255,255,.7)`, monospace 11px).
  - **Selo data+programa** (canto SUPERIOR ESQUERDO, `top:11px;left:11px`): fundo `rgba(20,22,26,.55)` + blur, texto branco Poppins 700 11px, dot colorido do programa 7px + `"{data} · {programa}"`.
  - **Selo de slots** (canto INFERIOR DIREITO, `bottom:11px;right:11px` — importante: nunca no topo direito, para não colidir com o selo de data). Poppins 700 10.5px. Três estados: `>=2` → fundo branco/borda/texto pretos, texto "N slots"; `==1` → fundo `#ffe9e2`, texto `#c23a20`, borda `#ff5a3c`, "1 slot"; `==0` → fundo `#eef0f2`, texto `#8a909a`, borda `#dfe2e7`, "esgotado".
  - Corpo (`padding:14px 14px 15px`): título Poppins 700 15px; subtítulo `"{livres} de {total} livres"` 12.5px `#9aa0a8`; linha inferior com botão **curtir** (pill, `♥ {n}`; estado curtido = fundo `#14161a` texto branco; não curtido = branco/borda `#d7dae0`) e, à direita, a tag (`#c1c5cc`).
- **Interação**: clique no card → detail; clique no botão curtir → toggle (com `stopPropagation`).

### 2. Detalhe da oportunidade — view `detail`
- **Purpose**: ver a ação e **gerar consulta**.
- **Layout**: `max-width:920px`. Link "← Voltar à vitrine". Grade `.9fr 1.1fr; gap:34px`.
  - Esquerda: imagem `aspect-ratio:3/4`, `border-radius:22px`, sombra forte; selo data+programa igual ao card.
  - Direita: badge do programa (pill colorida) + chip "Sazonal"; título Poppins 800 34px; parágrafo descritivo `#5a606a` 15.5px; **card de stats** (branco, radius 16px) com "slots livres" (número na cor do programa, Poppins 800 28px), "curtidas", e botão "♥ Curtir" à direita; botão primário largura total **"Gerar consulta →"** (fundo `#14161a`, radius 14px, 16px 700); rodapé com avatar + "Postado por … · Consultora · há 2 dias".
- **Interação**: "Gerar consulta →" deve levar ao fluxo de consulta (a definir no backend).

### 3. Calendário / Datas especiais — view `calendar`
- **Purpose**: ver datas comemorativas e ações por dia.
- **Layout**: `max-width:1180px`. Título "Maio 2026" + navegação ‹ ›. Toggle **Grade / Agenda** (pills). Tipografia fantasma "maio" ao fundo. Grade `1.55fr 1fr; gap:26px`:
  - **Mês** (card branco radius 20px): cabeçalho de dias DOM..SÁB (11px 700 `#c1c5cc`); grade `repeat(7,1fr); gap:8px`. Cada dia = célula `aspect-ratio:1`, radius 12px; dias com evento mostram até 3 dots coloridos por programa; dia selecionado = fundo `#14161a`, número branco. Maio/2026 começa na sexta (5 células vazias iniciais).
  - **Agenda** (coluna direita): título "Sáb, {dia} Mai", subtítulo com contagem; lista de ações daquele dia (thumb com gradiente do programa, título, "N de M livres", selo de slots). Clique num item → detail.
- **Interação**: clicar num dia atualiza a agenda; clicar num item da agenda abre o detalhe.

### 4. Postar nova oportunidade — view `post`
- **Purpose**: criar uma oportunidade com prévia ao vivo.
- **Layout**: `max-width:960px`. Link "← Cancelar". Grade `1.3fr .7fr; gap:38px`.
  - **Formulário** (esquerda): upload de imagem (dropzone tracejada, `aspect-ratio:16/7`; ao enviar mostra a imagem como background e texto "Imagem carregada ✓"); select **Programa**; **Data do evento** (input date); **Slots disponíveis** (input number); **Título/chamada** (input text); botão "Publicar na vitrine".
  - **Prévia** (direita, `position:sticky; top:90px`): card idêntico ao da vitrine que reflete em tempo real programa (cor+nome do selo e gradiente), data (formatada "DD MES"), slots e título; nota "O selo com data e programa é aplicado automaticamente ao publicar."
- **Comportamento**: mudar programa troca cor do selo e gradiente; data reformatada para "DD MES" (MESES = JAN..DEZ); imagem via FileReader → dataURL.

## Interactions & Behavior
- Navegação por top-nav sticky (blur), item ativo com sublinhado (`.navlink.on`).
- Hover de card: `translateY(-6px)` + sombra; transição `.18s`.
- Botão curtir: toggle otimista; contador = base + (curtido ? 1 : 0).
- Filtros da vitrine: Todas / Datas comem. (Sazonal+Comercial) / Talentos (tag Talento) / Sazonais (tag Sazonal).
- Calendário: seleção de dia controla a agenda; toggle Grade/Agenda.
- Postar: prévia reativa a cada campo; upload lê arquivo local (client-side no protótipo).
- `.press` dá feedback `scale(.96)` no active.

## State Management
- `view`: vitrine | detail | calendar | post
- `detailId`: id da oportunidade aberta
- `filter`: índice do filtro ativo
- `likes`: mapa id→bool
- `calMode`: grid | agenda ; `selDay`: dia selecionado
- `post`: { prog, dateISO, slots, title, img }
- Dados reais (oportunidades, programas, datas comemorativas) devem vir de API; no protótipo estão mockados em `DATA` e `PROGRAMS`.

## Design Tokens
- **Fundo app**: `#eceef1` · **superfície**: `#fff`
- **Tinta**: `#14161a` · **texto suave**: `#5a606a` / `#6b7280` · **muted**: `#9aa0a8` / `#c1c5cc`
- **Bordas**: `#d7dae0` (inputs/chips), `#eceef1` / `#f3f4f6` (sutis)
- **Cores de programa (selo/gradiente)**:
  - Novelas `#ff5a3c` — `linear-gradient(150deg,#ff8a3c,#ff3d6e)`
  - Big Brother `#7c3aed` — `linear-gradient(150deg,#8b5cf6,#4f46e5)`
  - SporTV `#1e90ff` — `linear-gradient(150deg,#22d3ee,#2563eb)`
  - Domingão `#f5a623` — `linear-gradient(150deg,#fbbf24,#f97316)`
  - Estreias `#10b981` — `linear-gradient(150deg,#34d399,#059669)`
  - Especiais `#ec4899` — `linear-gradient(150deg,#f472b6,#db2777)`
- **Alerta slot (1 restante)**: bg `#ffe9e2`, fg `#c23a20`, borda `#ff5a3c`
- **Esgotado**: bg `#eef0f2`, fg `#8a909a`, borda `#dfe2e7`
- **Raios**: cards 20px, imagem detalhe 22px, inputs 12px, botões 14px, pills 999px
- **Sombras**: card `0 6px 20px -12px rgba(20,22,26,.3)`; hover `0 22px 40px -18px rgba(20,22,26,.35)`; detalhe `0 26px 50px -24px rgba(20,22,26,.5)`
- **Tipografia**: títulos **Poppins** (500–800); corpo **Manrope** (400–800). Hero 44/800, título detalhe 34/800, título de card 15/700.

## Assets
- Nenhuma imagem real: as áreas de imagem usam gradientes como placeholder para a **imagem postada pelo consultor**. No produto, substituir pelo upload real (thumb pequena/média, sugerido máx 1200px).
- Ícones: usados glifos simples (♥, ‹ ›, ←, +). Substituir por ícones do design system do codebase.

## Files
- `Vitrine Hi-Fi.dc.html` — protótipo hi-fi (fonte de verdade). Template + lógica de estado inclusos no arquivo.
- `Vitrine Wireframes.dc.html` — wireframes low-fi (referência de exploração; não é a versão final).
- `screenshots/01-vitrine.png` — vitrine (feed de cards)
- `screenshots/02-detalhe.png` — detalhe da oportunidade (Gerar consulta)
- `screenshots/03-calendario.png` — calendário / agenda do dia
- `screenshots/04-postar.png` — postar nova oportunidade (com prévia)
