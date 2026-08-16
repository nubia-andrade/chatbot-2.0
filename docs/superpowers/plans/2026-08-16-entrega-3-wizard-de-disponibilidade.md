# CHATBOT 2.0 — Entrega 3: Wizard de disponibilidade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o wizard de seis passos que responde "Posso vender? → Quando posso vender? → Quanto custa?", com um motor único de disponibilidade que ordena as regras já testadas das Entregas 1 e 2.

**Architecture:** As regras não são reescritas — `disponibilidade.ts` é uma função pura que **ordena** `contarOcupacao`, `estaBloqueada`, `dentroDoPrazoMinimo`, `restricaoQueBloqueia`, `concorrenteNaData`, `temSlotRegionalEm`, `pracasLivresEm` e `periodoEspecialEm`, que já existem e já têm teste. A camada `dados/` faz um carregamento por mês; o Server Component carrega, o Client Component só pinta. O wizard é uma rota por passo, com o estado num provider espelhado em `sessionStorage`.

**Tech Stack:** Next.js 16.3.0 · React 19.2.8 · TypeScript 5 · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vitest 4 · Node 22

**Spec:** `docs/superpowers/specs/2026-08-16-entrega-3-wizard-de-disponibilidade-design.md`
**Regras da área:** `docs/regras-acoes-regionais.md`
**Handoff de design:** `design_handoff/design_handoff_disponibilidade_propostas/README.md` (telas `1b` a `1e`)

## Global Constraints

- **Base de testes atual: 211 testes em 17 arquivos.** Cada task diz o total esperado depois dela. Se não bater, pare e descubra por quê antes de seguir.
- **Supabase real e acessível.** `.env.local` preenchido; 15.519 clientes, 246 ações vendidas, programas MAVO, Encontro e É de Casa no banco. **Verifique cada task contra o banco de verdade**, não só com build e teste.
- **Todo texto visível e todo identificador em português**, com acentuação correta. Nunca trocar caractere acentuado por ASCII.
- **Dias da semana:** 0 = domingo … 6 = sábado, convenção de `Date.getUTCDay()`. Toda data é string ISO `AAAA-MM-DD` e todo `Date` é construído como `new Date(\`${dataIso}T00:00:00Z\`)` — nunca no fuso local, ou o dia vira o anterior à noite no Brasil.
- **As 5 praças, com estes códigos exatos:** `SP`, `RJ`, `BH`, `DF`, `PE1`.
- **Os quatro perfis:** `executivo`, `executivo_regional`, `consultor_programa`, `proprietario` — acumuláveis.
- **Regras do Encontro:** slot às **sextas** (dia 5), prazo mínimo regional **7 dias**, bloqueio mensal regional 4 ações. **É de Casa:** **sábados** (dia 6), **10 dias**, 4 ações.
- **Feriado é ilustração, nunca regra.** Ele nomeia a célula e jamais entra em `motivos` nem altera `estado`.
- **Nenhum campo de cliente aceita texto livre.** Cliente vem da carteira, via `CampoDeBuscaDeCliente`.
- **Next.js 16 tem mudanças incompatíveis com o que modelos aprenderam.** Consulte `node_modules/next/dist/docs/` antes de escrever rota, layout ou server action.
- **Nada de segredo no código.** `SUPABASE_SERVICE_ROLE_KEY` só em scripts de linha de comando.
- **Princípios de UX da Entrega 2 continuam valendo:** todo estado tem forma (carregando, vazio, erro, cheio); todo botão que grava desabilita enquanto grava; cor nunca é o único indicador de estado; contraste mínimo 4.5:1.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/dominio/feriados.ts` | Feriados nacionais fixos e móveis — só ilustração |
| `src/lib/dominio/casamento-anunciante.ts` | Casar o texto livre da API com a carteira |
| `src/lib/dominio/custo-da-acao-nacional.ts` | Mídia + direitos + produção do nacional |
| `src/lib/dominio/disponibilidade.ts` | **O motor** — ordena as regras, por dia do mês |
| `src/lib/dominio/consulta.ts` | O que pode virar consulta gravada |
| `supabase/schema-entrega-3.sql` | `consultas`, `consulta_itens`, RLS |
| `src/lib/dados/disponibilidade.ts` | Um carregamento por mês |
| `src/lib/acoes/consultas.ts` | Gravação da consulta (server action) |
| `src/components/consulta/*.tsx` | Stepper, calendário, painel de datas, resumo |
| `src/app/(app)/consulta/*` | As seis rotas e o layout com o provider |

---

### Task 1: Domínio — feriados como ilustração

**Files:**
- Create: `src/lib/dominio/feriados.ts`, `src/lib/dominio/feriados.test.ts`

**Interfaces:**
- Produces:
  - `type Feriado = { data: string; nome: string }`
  - `domingoDePascoa(ano: number): string`
  - `feriadosDoAno(ano: number): Feriado[]`
  - `feriadoEm(dataIso: string): Feriado | null`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/dominio/feriados.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { domingoDePascoa, feriadosDoAno, feriadoEm } from './feriados'

describe('domingoDePascoa', () => {
  // Datas conferíveis em qualquer calendário — se o algoritmo não bater com
  // elas, o algoritmo está errado, não o teste.
  it('acerta a Páscoa de anos conhecidos', () => {
    expect(domingoDePascoa(2025)).toBe('2025-04-20')
    expect(domingoDePascoa(2026)).toBe('2026-04-05')
    expect(domingoDePascoa(2027)).toBe('2027-03-28')
  })
})

describe('feriadosDoAno', () => {
  it('traz os oito fixos', () => {
    const datas = feriadosDoAno(2026).map((f) => f.data)
    for (const fixo of [
      '2026-01-01', '2026-04-21', '2026-05-01', '2026-09-07',
      '2026-10-12', '2026-11-02', '2026-11-15', '2026-12-25',
    ]) {
      expect(datas).toContain(fixo)
    }
  })

  // Os móveis são a razão da função existir: ninguém sabe de cabeça quando
  // cai o Carnaval de 2027, e é o feriado que mais desloca grade comercial.
  it('calcula os móveis a partir da Páscoa', () => {
    const de2026 = feriadosDoAno(2026)
    expect(de2026).toContainEqual({ data: '2026-02-17', nome: 'Carnaval' })
    expect(de2026).toContainEqual({ data: '2026-04-03', nome: 'Sexta-feira Santa' })
    expect(de2026).toContainEqual({ data: '2026-06-04', nome: 'Corpus Christi' })
  })

  it('acerta o Carnaval em anos diferentes', () => {
    expect(feriadosDoAno(2025).find((f) => f.nome === 'Carnaval')?.data).toBe('2025-03-04')
    expect(feriadosDoAno(2027).find((f) => f.nome === 'Carnaval')?.data).toBe('2027-02-09')
  })

  it('vem ordenado por data', () => {
    const datas = feriadosDoAno(2026).map((f) => f.data)
    expect([...datas].sort()).toEqual(datas)
  })
})

describe('feriadoEm', () => {
  it('nomeia a data quando é feriado', () => {
    expect(feriadoEm('2026-12-25')).toEqual({ data: '2026-12-25', nome: 'Natal' })
  })

  it('devolve nulo em dia comum', () => {
    expect(feriadoEm('2026-08-21')).toBeNull()
  })

  it('funciona em qualquer ano, sem tabela fixa', () => {
    expect(feriadoEm('2031-01-01')?.nome).toBe('Confraternização Universal')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./feriados"`.

- [ ] **Step 3: Implementar**

Create `src/lib/dominio/feriados.ts`:

```ts
/**
 * Feriados nacionais — ILUSTRAÇÃO, nunca regra.
 *
 * Decisão da área (spec da Entrega 3): o calendário nomeia o feriado para o
 * executivo se situar no mês, mas ele NÃO altera disponibilidade nem preço.
 * 25/12 só fecha se estiver em `datas_bloqueadas`; só muda de valor se
 * estiver dentro de um período de `datas_especiais`. Um feriado sem cadastro
 * é um dia vendável como outro qualquer.
 *
 * Quem consumir isto: o nome do feriado nunca entra em `motivos` de
 * `DiaDeDisponibilidade` e nunca influencia `estado`.
 *
 * Só os nacionais. Estadual e municipal ficam de fora — são muitos, mudam
 * por praça, e o que decide continua sendo o cadastro.
 */

export type Feriado = {
  data: string
  nome: string
}

/** Dia-mês fixos, no formato `MM-DD`. */
const FIXOS: [string, string][] = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['12-25', 'Natal'],
]

/** Deslocamento em dias a partir do Domingo de Páscoa. */
const MOVEIS: [number, string][] = [
  [-47, 'Carnaval'],
  [-2, 'Sexta-feira Santa'],
  [60, 'Corpus Christi'],
]

const UM_DIA_MS = 24 * 60 * 60 * 1000

function paraIso(momento: number): string {
  return new Date(momento).toISOString().slice(0, 10)
}

function deslocar(dataIso: string, dias: number): string {
  return paraIso(new Date(`${dataIso}T00:00:00Z`).getTime() + dias * UM_DIA_MS)
}

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano).
 * Os três feriados móveis brasileiros derivam dele: Carnaval é 47 dias antes,
 * Sexta-feira Santa 2 dias antes, Corpus Christi 60 dias depois.
 */
export function domingoDePascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1

  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Os onze feriados nacionais do ano, ordenados por data. */
export function feriadosDoAno(ano: number): Feriado[] {
  const pascoa = domingoDePascoa(ano)

  const feriados: Feriado[] = [
    ...FIXOS.map(([diaMes, nome]) => ({ data: `${ano}-${diaMes}`, nome })),
    ...MOVEIS.map(([deslocamento, nome]) => ({ data: deslocar(pascoa, deslocamento), nome })),
  ]

  return feriados.sort((um, outro) => um.data.localeCompare(outro.data))
}

/** O feriado daquela data, ou nulo. Calculado do ano da própria data — não há tabela fixa a manter. */
export function feriadoEm(dataIso: string): Feriado | null {
  const ano = Number(dataIso.slice(0, 4))
  if (!Number.isFinite(ano)) return null
  return feriadosDoAno(ano).find((feriado) => feriado.data === dataIso) ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 211 + 8 = **219 testes**, 18 arquivos.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/feriados.ts src/lib/dominio/feriados.test.ts
git commit -m "feat: feriados nacionais como ilustracao do calendario, nunca como regra"
```

---

### Task 2: Domínio — casar o anunciante da API com a carteira

**Files:**
- Create: `src/lib/dominio/casamento-anunciante.ts`, `src/lib/dominio/casamento-anunciante.test.ts`

**Interfaces:**
- Consumes: `normalizarNome` de `./texto`.
- Produces:
  - `type ClienteClassificado = { nome: string; setor: string | null; industria: string | null }`
  - `type IndiceDeAnunciantes = Map<string, ClienteClassificado | null>` — `null` marca chave ambígua
  - `reduzirNomeDeAnunciante(nome: string | null | undefined): string`
  - `indexarAnunciantes(clientes: ClienteClassificado[]): IndiceDeAnunciantes`
  - `classificarAnunciante(nome: string | null | undefined, indice: IndiceDeAnunciantes): ClienteClassificado | null`

`acoes_vendidas.anunciante` é texto livre digitado do outro lado da API. Sem esta função, a regra de concorrência (R14) não roda no nacional. **Medido contra o banco real:** nome exato acerta 48 de 246 ações (19,5%); o nome reduzido acerta 206 (83,7%).

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/dominio/casamento-anunciante.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  reduzirNomeDeAnunciante,
  indexarAnunciantes,
  classificarAnunciante,
} from './casamento-anunciante'

describe('reduzirNomeDeAnunciante', () => {
  // Os nomes são reais, tirados de `acoes_vendidas` no banco de produção.
  it('tira o asterisco que a API acrescenta', () => {
    expect(reduzirNomeDeAnunciante('AMBEV S.A *')).toBe('AMBEV')
    expect(reduzirNomeDeAnunciante('BOTICARIO *')).toBe('BOTICARIO')
  })

  it('tira as formas societárias', () => {
    expect(reduzirNomeDeAnunciante('VALE SA')).toBe('VALE')
    expect(reduzirNomeDeAnunciante('JBS S/A')).toBe('JBS')
    expect(reduzirNomeDeAnunciante('OTICAS DINIZ LTDA')).toBe('OTICAS DINIZ')
  })

  it('tira o que está entre parênteses', () => {
    expect(reduzirNomeDeAnunciante('BERGAMO COMERCIO LTDA (DUTY COSMETICOS) *')).toBe('BERGAMO')
  })

  it('ignora acento e caixa', () => {
    expect(reduzirNomeDeAnunciante("L'OREAL BRASIL *")).toBe('L OREAL')
    expect(reduzirNomeDeAnunciante('Nestlé')).toBe('NESTLE')
  })

  it('devolve vazio para ausente', () => {
    expect(reduzirNomeDeAnunciante(null)).toBe('')
    expect(reduzirNomeDeAnunciante('   ')).toBe('')
  })

  // Um nome que é SÓ forma societária não sobra nada — e nada nunca casa.
  it('devolve vazio quando não sobra marca nenhuma', () => {
    expect(reduzirNomeDeAnunciante('LTDA SA')).toBe('')
  })
})

describe('indexarAnunciantes e classificarAnunciante', () => {
  const carteira = [
    { nome: 'AMBEV', setor: 'Bebidas', industria: 'Cervejas' },
    { nome: 'Nestlé S/A', setor: 'Alimentos', industria: 'Chocolates' },
    // Duas linhas que reduzem para a mesma chave COM classificação diferente:
    // é o caso ambíguo, que não pode gerar bloqueio.
    { nome: 'ALPHA COMERCIO LTDA', setor: 'Varejo', industria: 'Moda' },
    { nome: 'ALPHA INDUSTRIA SA', setor: 'Química', industria: 'Tintas' },
    // Duas linhas que reduzem igual e CONCORDAM: casamento continua útil.
    { nome: 'BETA LTDA', setor: 'Bancos', industria: 'Financeiro' },
    { nome: 'BETA SA', setor: 'Bancos', industria: 'Financeiro' },
  ]
  const indice = indexarAnunciantes(carteira)

  it('classifica o anunciante da API pelo nome reduzido', () => {
    expect(classificarAnunciante('AMBEV S.A *', indice)).toEqual({
      nome: 'AMBEV',
      setor: 'Bebidas',
      industria: 'Cervejas',
    })
  })

  it('casa apesar da forma societária divergente dos dois lados', () => {
    expect(classificarAnunciante('NESTLE DO BRASIL LTDA', indice)?.industria).toBe('Chocolates')
  })

  // Sem saber QUAL dos dois é, não dá para dizer o setor do concorrente.
  it('devolve nulo quando a chave é ambígua na carteira', () => {
    expect(classificarAnunciante('ALPHA *', indice)).toBeNull()
  })

  it('não considera ambíguo quando os homônimos concordam', () => {
    expect(classificarAnunciante('BETA *', indice)?.setor).toBe('Bancos')
  })

  it('devolve nulo para quem não está na carteira', () => {
    expect(classificarAnunciante('PORTO SEGURO', indice)).toBeNull()
    expect(classificarAnunciante(null, indice)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./casamento-anunciante"`.

- [ ] **Step 3: Implementar**

Create `src/lib/dominio/casamento-anunciante.ts`:

```ts
import { normalizarNome } from './texto'

/**
 * Casa o `anunciante` de `acoes_vendidas` — texto livre digitado do outro
 * lado da API do Globo Take — com um cliente da carteira, para descobrir o
 * setor e a indústria de quem já comprou uma data. Sem isso, a regra de
 * concorrência (R14) não roda no nacional.
 *
 * Medido contra o banco real em 16/08/2026 (246 ações, 15.519 clientes):
 *
 *   nome normalizado (acento e caixa) .... 48 de 246 — 19,5%
 *   nome reduzido (esta função) .......... 206 de 246 — 83,7%
 *
 * A área informou que a base de clientes do Globo Take será ajustada; a
 * cobertura deve subir. Enquanto não sobe, quem não casa NÃO BLOQUEIA a data
 * — só avisa que a concorrência não foi verificada. Bloquear por precaução
 * esconderia disponibilidade real por causa de grafia de cadastro.
 */

export type ClienteClassificado = {
  nome: string
  setor: string | null
  industria: string | null
}

/** `null` no valor marca chave AMBÍGUA: homônimos com classificação divergente. */
export type IndiceDeAnunciantes = Map<string, ClienteClassificado | null>

/**
 * Formas societárias e qualificadores geográficos — ruído puro para
 * identificar de que MARCA se trata. "AMBEV S.A" e "AMBEV" são a mesma
 * empresa; "DO BRASIL" não distingue ninguém.
 */
const RUIDO =
  /\b(S\s*[/.]?\s*A|SA|LTDA|ME|EPP|EIRELI|CIA|COMPANHIA|DO BRASIL|BRASIL|BR|COMERCIO|INDUSTRIA|PARTICIPACOES|HOLDING)\b/g

/**
 * O nome sem o que não identifica a marca: o `*` que a API acrescenta, o
 * conteúdo entre parênteses (costuma ser a marca fantasia, não a razão
 * social que a carteira guarda), a pontuação e as formas societárias.
 *
 * Devolve string vazia quando não sobra nada — e vazio nunca casa com nada,
 * garantido por `classificarAnunciante`.
 */
export function reduzirNomeDeAnunciante(nome: string | null | undefined): string {
  return normalizarNome(nome)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\*/g, ' ')
    .replace(RUIDO, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Índice da carteira por nome reduzido. Chave cujos homônimos DISCORDAM na
 * classificação vira `null`: dois clientes diferentes viraram o mesmo nome
 * curto, e sem saber qual é não dá para afirmar o setor do concorrente.
 * Homônimos que concordam seguem úteis — a resposta é a mesma de qualquer
 * jeito.
 */
export function indexarAnunciantes(clientes: ClienteClassificado[]): IndiceDeAnunciantes {
  const indice: IndiceDeAnunciantes = new Map()

  for (const cliente of clientes) {
    const chave = reduzirNomeDeAnunciante(cliente.nome)
    if (chave === '') continue

    if (!indice.has(chave)) {
      indice.set(chave, cliente)
      continue
    }

    const existente = indice.get(chave)
    if (existente === null) continue
    if (existente!.setor !== cliente.setor || existente!.industria !== cliente.industria) {
      indice.set(chave, null)
    }
  }

  return indice
}

/** O cliente da carteira correspondente, ou `null` — ausente, sem marca, ou ambíguo. */
export function classificarAnunciante(
  nome: string | null | undefined,
  indice: IndiceDeAnunciantes,
): ClienteClassificado | null {
  const chave = reduzirNomeDeAnunciante(nome)
  if (chave === '') return null
  return indice.get(chave) ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 219 + 12 = **231 testes**, 19 arquivos.

- [ ] **Step 5: Conferir a cobertura contra o banco real**

Rode o script de medição já existente e confirme que os números do comentário
batem com a realidade atual:

```powershell
node .superpowers/medir-casamento-anunciantes.mjs
```

Esperado: `casam com a carteira ..... 206` na seção "com nome reduzido". Se a
base do Globo Take já tiver sido ajustada e o número for **maior**, atualize o
comentário do arquivo com o número novo e a data. Se for **menor**, pare e
relate — algo regrediu.

- [ ] **Step 6: Commitar**

```powershell
git add src/lib/dominio/casamento-anunciante.ts src/lib/dominio/casamento-anunciante.test.ts
git commit -m "feat: casamento do anunciante da API com a carteira, de 19,5% para 83,7%"
```

---

### Task 3: Domínio — custo da ação nacional

**Files:**
- Create: `src/lib/dominio/custo-da-acao-nacional.ts`, `src/lib/dominio/custo-da-acao-nacional.test.ts`

**Interfaces:**
- Consumes: `calcularDireitosTv` de `./direitos-e-conexos`.
- Produces:
  - `type CustosNacionais = { custo_midia_tv: number | null; custo_producao_tv: number | null; percentual_simulcast: number | null }`
  - `calcularCustoDaAcaoNacional(custos: CustosNacionais, percentualAcrescimo?: number): number | null`

O regional já tem `custo-da-acao-regional.ts`. O nacional não tinha, porque até
aqui ninguém somava a ação inteira. O resumo precisa.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/dominio/custo-da-acao-nacional.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularCustoDaAcaoNacional } from './custo-da-acao-nacional'

describe('calcularCustoDaAcaoNacional', () => {
  // Caso real do É de Casa, o mesmo de `direitos-e-conexos.test.ts`:
  // mídia 376.000 + simulcast 3% → direitos 58.092.
  const edeCasa = {
    custo_midia_tv: 376000,
    custo_producao_tv: 7910,
    percentual_simulcast: 3,
  }

  it('soma mídia, direitos e produção', () => {
    // 376.000 + 58.092 + 7.910
    expect(calcularCustoDaAcaoNacional(edeCasa)).toBe(442002)
  })

  it('trata produção ausente como zero, sem impedir a conta', () => {
    expect(calcularCustoDaAcaoNacional({ ...edeCasa, custo_producao_tv: null })).toBe(434092)
  })

  // Mídia ausente é "não dá para calcular ainda", não "custa zero" — a mesma
  // convenção de `direitos-e-conexos.ts` e `moeda.ts`.
  it('devolve nulo sem custo de mídia', () => {
    expect(calcularCustoDaAcaoNacional({ ...edeCasa, custo_midia_tv: null })).toBeNull()
  })

  it('sem simulcast, calcula só a parcela de TV', () => {
    // 100.000 + 15.000 + 0
    expect(
      calcularCustoDaAcaoNacional({
        custo_midia_tv: 100000,
        custo_producao_tv: null,
        percentual_simulcast: null,
      }),
    ).toBe(115000)
  })

  // Data especial: o acréscimo incide sobre a MÍDIA, antes dos direitos, que
  // sobem junto. Produção não muda — não é mídia.
  it('aplica o acréscimo do período especial sobre a mídia, antes dos direitos', () => {
    // 100.000 +20% = 120.000; direitos 15% = 18.000; produção 5.000
    expect(
      calcularCustoDaAcaoNacional(
        { custo_midia_tv: 100000, custo_producao_tv: 5000, percentual_simulcast: null },
        20,
      ),
    ).toBe(143000)
  })

  it('acréscimo zero não muda nada', () => {
    expect(calcularCustoDaAcaoNacional(edeCasa, 0)).toBe(442002)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./custo-da-acao-nacional"`.

- [ ] **Step 3: Implementar**

Create `src/lib/dominio/custo-da-acao-nacional.ts`:

```ts
import { calcularDireitosTv } from './direitos-e-conexos'
import { aplicarAcrescimo } from './datas-especiais'

/**
 * Total de UMA ação nacional:
 *
 *   total = mídia de TV (já com o acréscimo de data especial, quando houver)
 *         + direitos e conexos (calculado sobre essa mídia — `direitos-e-conexos.ts`)
 *         + custo de produção de TV
 *
 * Espelha `custo-da-acao-regional.ts`, com a diferença de não haver praças: o
 * nacional é um valor só. Digital fica de fora enquanto a área não confirmar
 * quais programas vendem digital junto — os campos existem no cadastro e
 * entram aqui quando isso for definido.
 */

export type CustosNacionais = {
  custo_midia_tv: number | null
  custo_producao_tv: number | null
  percentual_simulcast: number | null
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * `percentualAcrescimo` vem de um período de `datas_especiais` e incide sobre
 * a MÍDIA, antes dos direitos — que por isso sobem junto, sem precisar saber
 * que existe data especial. Produção não é mídia e não sobe.
 *
 * Devolve `null` quando não há custo de mídia: "não dá para calcular ainda",
 * não "custa zero" — mesma convenção de `direitos-e-conexos.ts`. Um programa
 * sem mídia preenchida não tem ação de R$ 0,00.
 */
export function calcularCustoDaAcaoNacional(
  custos: CustosNacionais,
  percentualAcrescimo: number = 0,
): number | null {
  if (custos.custo_midia_tv === null || custos.custo_midia_tv === undefined) return null

  const midia =
    percentualAcrescimo > 0
      ? aplicarAcrescimo(custos.custo_midia_tv, percentualAcrescimo)
      : custos.custo_midia_tv

  const direitos = calcularDireitosTv(midia, custos.percentual_simulcast) ?? 0

  return arredondar(midia + direitos + (custos.custo_producao_tv ?? 0))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 231 + 6 = **237 testes**, 20 arquivos.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/custo-da-acao-nacional.ts src/lib/dominio/custo-da-acao-nacional.test.ts
git commit -m "feat: custo da acao nacional com acrescimo de data especial sobre a midia"
```

---

### Task 4: Domínio — o motor de disponibilidade (nacional)

**Files:**
- Create: `src/lib/dominio/disponibilidade.ts`, `src/lib/dominio/disponibilidade.test.ts`

**Interfaces:**
- Consumes: `contarOcupacao`/`chaveDeOcupacao` de `./ocupacao`; `MapaDeFormatos` de `./formatos`; `estaBloqueada` de `./bloqueios`; `concorrenteNaData` de `./restricoes`; `periodoEspecialEm` de `./datas-especiais`; `feriadoEm` de `./feriados`; `classificarAnunciante`/`IndiceDeAnunciantes` de `./casamento-anunciante`; `calcularCustoDaAcaoNacional` de `./custo-da-acao-nacional`.
- Produces:
  - `type EstadoDoDia = 'sem_exibicao' | 'fora_do_prazo' | 'bloqueado' | 'concorrencia' | 'esgotado' | 'disponivel'`
  - `type Modalidade = 'nacional' | 'regional'`
  - `type PracaNoDia = { praca_codigo: string; disponivel: boolean; cliente_nome: string | null }`
  - `type DiaDeDisponibilidade` (campos abaixo)
  - `type InsumosDeDisponibilidade` (campos abaixo)
  - `diasDoMes(ano: number, mes: number): string[]`
  - `calcularDisponibilidadeDoMes(insumos: InsumosDeDisponibilidade): DiaDeDisponibilidade[]`

Este é o arquivo mais importante da entrega. Ele **não reimplementa regra
nenhuma** — ordena as que já existem e já têm teste.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/dominio/disponibilidade.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diasDoMes, calcularDisponibilidadeDoMes, type InsumosDeDisponibilidade } from './disponibilidade'
import { montarMapa } from './formatos'
import { indexarAnunciantes } from './casamento-anunciante'

const FORMATOS = montarMapa([
  { formato: 'ACAO DE CONTEUDO', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL', categoria: 'COMERCIAL' },
])

// MAVO: vai ao ar de segunda a sexta (1..5), 2 slots por dia, 3 dias de prazo.
const mavo = {
  id: 'p-1',
  mnemonico: 'MAVO',
  dias_da_semana: [1, 2, 3, 4, 5],
  slots: 2,
  bloqueio_mensal: 0,
  prazo_minimo_dias: 3,
  custo_midia_tv: 100000,
  custo_producao_tv: 5000,
  percentual_simulcast: null,
  aceita_regional: false,
  dia_da_semana_regional: null,
  prazo_minimo_regional_dias: null,
  max_pracas_por_acao: 3,
  custo_producao_regional: null,
  bloqueio_mensal_regional: 0,
}

const carteira = [
  { nome: 'COCA-COLA', setor: 'Bebidas', industria: 'Refrigerantes' },
  { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' },
  { nome: 'NESTLE', setor: 'Alimentos', industria: 'Chocolates' },
]

function insumos(ajustes: Partial<InsumosDeDisponibilidade> = {}): InsumosDeDisponibilidade {
  return {
    ano: 2026,
    mes: 9,
    hojeIso: '2026-08-16',
    modalidade: 'nacional',
    programa: mavo,
    cliente: { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' },
    formatos: FORMATOS,
    acoesVendidas: [],
    acoesRegionais: [],
    bloqueios: [],
    periodosEspeciais: [],
    indiceDeAnunciantes: indexarAnunciantes(carteira),
    precosRegionais: [],
    ...ajustes,
  }
}

function dia(dias: ReturnType<typeof calcularDisponibilidadeDoMes>, data: string) {
  const achado = dias.find((d) => d.data === data)
  if (!achado) throw new Error(`Dia ${data} não veio no resultado`)
  return achado
}

describe('diasDoMes', () => {
  it('gera todos os dias do mês em ISO', () => {
    const dias = diasDoMes(2026, 2)
    expect(dias).toHaveLength(28)
    expect(dias[0]).toBe('2026-02-01')
    expect(dias[27]).toBe('2026-02-28')
  })

  it('acerta mês de 31 dias', () => {
    expect(diasDoMes(2026, 12)).toHaveLength(31)
  })
})

describe('calcularDisponibilidadeDoMes — nacional', () => {
  it('devolve um item por dia do mês', () => {
    expect(calcularDisponibilidadeDoMes(insumos())).toHaveLength(30)
  })

  // R10: dia fora da grade não é "esgotado", é ausência de inventário.
  it('sábado e domingo ficam sem exibição', () => {
    const dias = calcularDisponibilidadeDoMes(insumos())
    expect(dia(dias, '2026-09-05').estado).toBe('sem_exibicao') // sábado
    expect(dia(dias, '2026-09-06').estado).toBe('sem_exibicao') // domingo
    expect(dia(dias, '2026-09-05').total).toBe(0)
  })

  it('dia útil sem venda fica disponível com todos os slots', () => {
    const terca = dia(calcularDisponibilidadeDoMes(insumos()), '2026-09-08')
    expect(terca.estado).toBe('disponivel')
    expect(terca.livres).toBe(2)
    expect(terca.total).toBe(2)
  })

  // R1: só formato de categoria AÇÃO DE CONTEÚDO ocupa slot.
  it('conta só ação de conteúdo como ocupação', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'COMERCIAL', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').livres).toBe(1)
  })

  it('slots todos vendidos deixam o dia esgotado', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('esgotado')
    expect(dia(dias, '2026-09-08').livres).toBe(0)
  })

  // R14: concorrência é calculada, não cadastrada. PEPSI e COCA-COLA
  // compartilham setor e indústria.
  it('concorrente vendido na data fecha a data, e nomeia quem é', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'COCA-COLA *' },
        ],
      }),
    )
    const terca = dia(dias, '2026-09-08')
    expect(terca.estado).toBe('concorrencia')
    expect(terca.motivos.join(' ')).toContain('COCA-COLA')
  })

  it('cliente de outra categoria não gera concorrência', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('disponivel')
  })

  // Anunciante que não casa com a carteira NÃO bloqueia — só avisa.
  it('anunciante desconhecido não bloqueia, mas conta como não verificado', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'PORTO SEGURO' },
        ],
      }),
    )
    const terca = dia(dias, '2026-09-08')
    expect(terca.estado).toBe('disponivel')
    expect(terca.acoes_sem_classificacao).toBe(1)
  })

  // R11: prazo mínimo de 3 dias a partir de 16/08.
  it('data dentro do prazo mínimo fica fora do prazo', () => {
    const dias = calcularDisponibilidadeDoMes(insumos({ ano: 2026, mes: 8 }))
    expect(dia(dias, '2026-08-17').estado).toBe('fora_do_prazo')
    expect(dia(dias, '2026-08-18').estado).toBe('fora_do_prazo')
    expect(dia(dias, '2026-08-19').estado).toBe('disponivel')
  })

  // R12: data bloqueada, com o motivo cadastrado à vista.
  it('data bloqueada fecha, com o motivo', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({ bloqueios: [{ data: '2026-09-08', motivo: 'Reprise' }] }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('bloqueado')
    expect(dia(dias, '2026-09-08').motivos).toContain('Reprise')
  })

  // Os motivos se acumulam; a cor, não. Prazo vem primeiro para não furar a
  // faixa contígua do começo do mês.
  it('data fora do prazo E bloqueada pinta pelo prazo e guarda os dois motivos', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({ ano: 2026, mes: 8, bloqueios: [{ data: '2026-08-17', motivo: 'Reprise' }] }),
    )
    const dezessete = dia(dias, '2026-08-17')
    expect(dezessete.estado).toBe('fora_do_prazo')
    expect(dezessete.motivos).toHaveLength(2)
    expect(dezessete.motivos.join(' ')).toContain('Reprise')
  })

  // R16: teto mensal fecha o mês inteiro.
  it('teto mensal atingido fecha os dias restantes do mês', () => {
    const vendidas = ['2026-09-01', '2026-09-02', '2026-09-03'].map((data) => ({
      programa: 'MAVO - MAIS VOCE',
      data_de_exibicao: data,
      formato: 'ACAO DE CONTEUDO',
      anunciante: 'NESTLE',
    }))
    const dias = calcularDisponibilidadeDoMes(
      insumos({ programa: { ...mavo, bloqueio_mensal: 3 }, acoesVendidas: vendidas }),
    )
    const oito = dia(dias, '2026-09-08')
    expect(oito.estado).toBe('bloqueado')
    expect(oito.motivos.join(' ')).toContain('mês')
  })

  // Feriado é ilustração: nomeia e não interfere.
  it('feriado aparece nomeado sem alterar o estado', () => {
    const dias = calcularDisponibilidadeDoMes(insumos())
    const sete = dia(dias, '2026-09-07') // Independência, uma segunda-feira
    expect(sete.feriado).toBe('Independência')
    expect(sete.estado).toBe('disponivel')
    expect(sete.motivos).toEqual([])
  })

  it('o valor do dia soma mídia, direitos e produção', () => {
    // 100.000 + 15.000 + 5.000
    expect(dia(calcularDisponibilidadeDoMes(insumos()), '2026-09-08').valor_unitario).toBe(120000)
  })

  it('período especial aparece nomeado e sobe o valor', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        periodosEspeciais: [
          { nome: 'Black Friday', data_inicio: '2026-09-07', data_fim: '2026-09-11', percentual_acrescimo: 20 },
        ],
      }),
    )
    const oito = dia(dias, '2026-09-08')
    expect(oito.periodo_especial).toEqual({ nome: 'Black Friday', percentual: 20 })
    // 120.000 +20% na mídia → 120.000 + 18.000 + 5.000
    expect(oito.valor_unitario).toBe(143000)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./disponibilidade"`.

- [ ] **Step 3: Implementar**

Create `src/lib/dominio/disponibilidade.ts`:

```ts
import { type AcaoVendida } from './ocupacao'
import { ocupaSlot, normalizarFormato, type MapaDeFormatos } from './formatos'
import { estaBloqueada, dentroDoPrazoMinimo, type DataBloqueada } from './bloqueios'
import { concorrenteNaData, type Anunciante } from './restricoes'
import { periodoEspecialEm, aplicarAcrescimo, type PeriodoEspecial } from './datas-especiais'
import { feriadoEm } from './feriados'
import { classificarAnunciante, type IndiceDeAnunciantes } from './casamento-anunciante'
import { calcularCustoDaAcaoNacional } from './custo-da-acao-nacional'
import { calcularCustoDaAcaoRegional, type PrecoDaPracaParaCalculo } from './custo-da-acao-regional'
import { PRACAS, temSlotRegionalEm, regionalConsomeSlotNacional, type AcaoRegional } from './regional'
import { extrairMnemonico } from './programas'

/**
 * O MOTOR. Único lugar do sistema que sabe em que ORDEM as regras se aplicam.
 *
 * Não reimplementa regra nenhuma: `contarOcupacao`, `estaBloqueada`,
 * `dentroDoPrazoMinimo`, `concorrenteNaData`, `temSlotRegionalEm`,
 * `periodoEspecialEm` e os cálculos de custo já existem e já têm teste. Esta
 * função os ordena e devolve, por dia do mês, o que a célula do calendário
 * precisa mostrar.
 *
 * É pura: sem banco, sem tela, sem `Date.now()`. `hojeIso` entra por
 * parâmetro — é o que torna o prazo mínimo testável.
 */

export type EstadoDoDia =
  | 'sem_exibicao'
  | 'fora_do_prazo'
  | 'bloqueado'
  | 'concorrencia'
  | 'esgotado'
  | 'disponivel'

export type Modalidade = 'nacional' | 'regional'

export type PracaNoDia = {
  praca_codigo: string
  disponivel: boolean
  cliente_nome: string | null
}

export type DiaDeDisponibilidade = {
  data: string
  estado: EstadoDoDia
  /** Slots livres no nacional; praças livres no regional. */
  livres: number
  /** Slots do dia no nacional; 5 praças no regional. `0` em dia sem exibição. */
  total: number
  /**
   * TODOS os motivos que valem, não só o que deu a cor. Uma data pode estar
   * ao mesmo tempo fora do prazo e bloqueada, e esconder o segundo faria o
   * executivo achar que resolver o primeiro liberaria a venda.
   */
  motivos: string[]
  /** Ilustração pura — nunca entra em `motivos`, nunca altera `estado`. */
  feriado: string | null
  /** Vazio no nacional. */
  pracas: PracaNoDia[]
  valor_unitario: number | null
  periodo_especial: { nome: string; percentual: number } | null
  /** Ações vendidas na data cujo anunciante não casou com a carteira. */
  acoes_sem_classificacao: number
}

/** O que o motor precisa saber do programa — não o cadastro inteiro. */
export type ProgramaParaDisponibilidade = {
  id: string
  mnemonico: string
  dias_da_semana: number[]
  slots: number
  bloqueio_mensal: number
  prazo_minimo_dias: number
  custo_midia_tv: number | null
  custo_producao_tv: number | null
  percentual_simulcast: number | null
  aceita_regional: boolean
  dia_da_semana_regional: number | null
  prazo_minimo_regional_dias: number | null
  max_pracas_por_acao: number
  custo_producao_regional: number | null
  bloqueio_mensal_regional: number
}

export type AcaoVendidaComAnunciante = AcaoVendida & { anunciante: string | null }

export type InsumosDeDisponibilidade = {
  ano: number
  /** 1 = janeiro … 12 = dezembro. */
  mes: number
  hojeIso: string
  modalidade: Modalidade
  programa: ProgramaParaDisponibilidade
  cliente: Anunciante
  formatos: MapaDeFormatos
  acoesVendidas: AcaoVendidaComAnunciante[]
  acoesRegionais: AcaoRegional[]
  bloqueios: DataBloqueada[]
  periodosEspeciais: PeriodoEspecial[]
  indiceDeAnunciantes: IndiceDeAnunciantes
  precosRegionais: PrecoDaPracaParaCalculo[]
}

const UM_DIA_MS = 24 * 60 * 60 * 1000

/** Todos os dias do mês, em ISO. `mes` é 1-based, como as pessoas contam. */
export function diasDoMes(ano: number, mes: number): string[] {
  const dias: string[] = []
  let cursor = Date.UTC(ano, mes - 1, 1)
  while (new Date(cursor).getUTCMonth() === mes - 1) {
    dias.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += UM_DIA_MS
  }
  return dias
}

function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

/** As ações vendidas DESTE programa, casadas por mnemônico ou nome da API. */
function acoesDoPrograma(
  acoes: AcaoVendidaComAnunciante[],
  programa: ProgramaParaDisponibilidade,
): AcaoVendidaComAnunciante[] {
  const alvo = normalizarFormato(programa.mnemonico)
  return acoes.filter((acao) => extrairMnemonico(acao.programa) === alvo)
}

/**
 * R16 — quantas ações já caíram no mês. No nacional, ações de conteúdo
 * vendidas; no regional, ações DISTINTAS (data + cliente), porque uma ação
 * de 3 praças ocupa 3 linhas de `acoes_regionais` mas continua sendo uma
 * ação só para o teto de 4 do Manual de Práticas.
 */
function acoesNoMes(insumos: InsumosDeDisponibilidade, dias: string[]): number {
  const doMes = new Set(dias)

  if (insumos.modalidade === 'regional') {
    const distintas = new Set(
      insumos.acoesRegionais
        .filter((acao) => doMes.has(acao.data_de_exibicao))
        .map((acao) => `${acao.data_de_exibicao}|${acao.cliente_nome}`),
    )
    return distintas.size
  }

  return acoesDoPrograma(insumos.acoesVendidas, insumos.programa).filter(
    (acao) => doMes.has(acao.data_de_exibicao) && ocupaSlot(acao.formato, insumos.formatos),
  ).length
}

export function calcularDisponibilidadeDoMes(
  insumos: InsumosDeDisponibilidade,
): DiaDeDisponibilidade[] {
  const dias = diasDoMes(insumos.ano, insumos.mes)
  const regional = insumos.modalidade === 'regional'
  const programa = insumos.programa

  const doPrograma = acoesDoPrograma(insumos.acoesVendidas, programa)

  const prazo = regional
    ? (programa.prazo_minimo_regional_dias ?? 0)
    : programa.prazo_minimo_dias

  const tetoMensal = regional ? programa.bloqueio_mensal_regional : programa.bloqueio_mensal
  const mesFechado = tetoMensal > 0 && acoesNoMes(insumos, dias) >= tetoMensal

  return dias.map((data) => {
    const feriado = feriadoEm(data)?.nome ?? null
    const motivos: string[] = []

    // 1. Existe inventário neste dia? Se não, não é estado nenhum — é ausência.
    const temInventario = regional
      ? temSlotRegionalEm(
          {
            aceita_regional: programa.aceita_regional,
            dia_da_semana_regional: programa.dia_da_semana_regional,
            max_pracas_por_acao: programa.max_pracas_por_acao,
          },
          data,
        )
      : programa.dias_da_semana.includes(diaDaSemana(data))

    if (!temInventario) {
      return {
        data,
        estado: 'sem_exibicao',
        livres: 0,
        total: 0,
        motivos: [],
        feriado,
        pracas: [],
        valor_unitario: null,
        periodo_especial: null,
        acoes_sem_classificacao: 0,
      }
    }

    // Ocupação — nacional por slots, regional por praças.
    const vendidasNaData = doPrograma.filter((acao) => acao.data_de_exibicao === data)
    const regionaisNaData = insumos.acoesRegionais.filter((acao) => acao.data_de_exibicao === data)

    const porPraca = new Map(regionaisNaData.map((acao) => [acao.praca_codigo, acao.cliente_nome]))
    const pracas: PracaNoDia[] = regional
      ? PRACAS.map((praca) => ({
          praca_codigo: praca,
          disponivel: !porPraca.has(praca),
          cliente_nome: porPraca.get(praca) ?? null,
        }))
      : []

    /**
     * R1 — só formato de categoria AÇÃO DE CONTEÚDO ocupa slot.
     * R15 (provisório) — a ação regional consome também um slot nacional do
     * dia. Uma ação de 3 praças é UMA ação: por isso conta clientes
     * distintos, não linhas de `acoes_regionais`.
     */
    const usadosNacional =
      vendidasNaData.filter((acao) => ocupaSlot(acao.formato, insumos.formatos)).length +
      (regionalConsomeSlotNacional()
        ? new Set(regionaisNaData.map((acao) => acao.cliente_nome)).size
        : 0)

    const total = regional ? PRACAS.length : programa.slots
    const livres = regional
      ? pracas.filter((praca) => praca.disponivel).length
      : Math.max(0, programa.slots - usadosNacional)

    // Preço do dia, com o acréscimo do período especial já aplicado.
    const periodo = periodoEspecialEm(insumos.periodosEspeciais, data)
    const acrescimo = periodo?.percentual_acrescimo ?? 0
    const periodo_especial = periodo ? { nome: periodo.nome, percentual: acrescimo } : null

    const valor_unitario = regional
      ? calcularCustoDaAcaoRegional(
          pracas.filter((praca) => praca.disponivel).map((praca) => praca.praca_codigo),
          acrescimo > 0
            ? insumos.precosRegionais.map((preco) => ({
                ...preco,
                custo_midia_tv: aplicarAcrescimo(preco.custo_midia_tv, acrescimo),
              }))
            : insumos.precosRegionais,
          programa.custo_producao_regional,
        )
      : calcularCustoDaAcaoNacional(
          {
            custo_midia_tv: programa.custo_midia_tv,
            custo_producao_tv: programa.custo_producao_tv,
            percentual_simulcast: programa.percentual_simulcast,
          },
          acrescimo,
        )

    // Concorrência (R14) — só no que casou com a carteira.
    const classificadas = vendidasNaData.map((acao) => ({
      acao,
      cliente: classificarAnunciante(acao.anunciante, insumos.indiceDeAnunciantes),
    }))
    const acoes_sem_classificacao = classificadas.filter((linha) => linha.cliente === null).length

    const concorrente = concorrenteNaData(
      classificadas
        .filter((linha) => linha.cliente !== null)
        .map((linha) => ({
          anunciante: linha.cliente!.nome,
          setor: linha.cliente!.setor,
          industria: linha.cliente!.industria,
        })),
      insumos.cliente,
    )

    // 2. Os motivos, todos, na ordem em que pintam a célula.
    const foraDoPrazo = dentroDoPrazoMinimo(insumos.hojeIso, data, prazo)
    if (foraDoPrazo) {
      motivos.push(`Fora do prazo mínimo de ${prazo} dias para este programa.`)
    }

    const bloqueio = estaBloqueada(insumos.bloqueios, data)
    if (bloqueio) motivos.push(bloqueio.motivo)

    if (mesFechado) {
      motivos.push(`O mês já atingiu o limite de ${tetoMensal} ações deste programa.`)
    }

    if (concorrente) {
      motivos.push(
        `${concorrente.anunciante} já tem ação nesta data, na mesma categoria do cliente.`,
      )
    }

    if (livres === 0) motivos.push('Todos os espaços desta data já foram vendidos.')

    /**
     * A ORDEM. Prazo vem primeiro porque forma uma faixa contígua no começo
     * do calendário, que o executivo lê de uma vez como "daqui não dá mais
     * tempo" — furar essa faixa com uma célula de outra cor faz ele achar
     * que as vizinhas são negociáveis. Os outros motivos continuam em
     * `motivos`, visíveis no detalhe da célula: nada se perde.
     */
    const estado: EstadoDoDia = foraDoPrazo
      ? 'fora_do_prazo'
      : bloqueio || mesFechado
        ? 'bloqueado'
        : concorrente
          ? 'concorrencia'
          : livres === 0
            ? 'esgotado'
            : 'disponivel'

    return {
      data,
      estado,
      livres,
      total,
      motivos,
      feriado,
      pracas,
      valor_unitario,
      periodo_especial,
      acoes_sem_classificacao,
    }
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 237 + 17 = **254 testes**, 21 arquivos.

Se algum teste falhar, **corrija a implementação, não o teste** — os números
vêm das regras reais da área.

- [ ] **Step 5: Conferir que o lint passa limpo**

Run: `npm run lint`
Expected: sem erro, sem aviso de importação não usada.

- [ ] **Step 6: Commitar**

```powershell
git add src/lib/dominio/disponibilidade.ts src/lib/dominio/disponibilidade.test.ts
git commit -m "feat: motor de disponibilidade nacional, ordenando as regras existentes"
```

---

### Task 5: Domínio — disponibilidade regional por praça

**Files:**
- Modify: `src/lib/dominio/disponibilidade.test.ts`

**Interfaces:**
- Consumes: tudo da Task 4. Nenhuma interface nova — o motor já trata a
  modalidade regional; esta task **prova** que trata.

O código regional foi escrito na Task 4 para não deixar o motor pela metade.
Esta task existe porque um caminho sem teste é um caminho que não funciona, e
os casos regionais são os que a área mais vai conferir.

- [ ] **Step 1: Escrever os testes que falham**

Append to `src/lib/dominio/disponibilidade.test.ts`:

```ts
describe('calcularDisponibilidadeDoMes — regional', () => {
  // Encontro: slot só às sextas (5), prazo regional de 7 dias, teto de 4
  // ações no mês, produção regional única por ação.
  const encontro = {
    ...mavo,
    id: 'p-2',
    mnemonico: 'FATI',
    dias_da_semana: [1, 2, 3, 4, 5],
    aceita_regional: true,
    dia_da_semana_regional: 5,
    prazo_minimo_regional_dias: 7,
    max_pracas_por_acao: 3,
    custo_producao_regional: 7797,
    bloqueio_mensal_regional: 4,
  }

  const precos = [
    { praca_codigo: 'SP', custo_midia_tv: 49000, percentual_simulcast: null },
    { praca_codigo: 'RJ', custo_midia_tv: 25000, percentual_simulcast: null },
    { praca_codigo: 'BH', custo_midia_tv: 9000, percentual_simulcast: null },
    { praca_codigo: 'DF', custo_midia_tv: 6000, percentual_simulcast: null },
    { praca_codigo: 'PE1', custo_midia_tv: 7000, percentual_simulcast: null },
  ]

  function regionais(ajustes: Partial<InsumosDeDisponibilidade> = {}) {
    return calcularDisponibilidadeDoMes(
      insumos({
        modalidade: 'regional',
        programa: encontro,
        precosRegionais: precos,
        ...ajustes,
      }),
    )
  }

  // R10: fora da sexta não há "esgotado" — não existe ação regional.
  it('quinta-feira não tem slot regional', () => {
    expect(dia(regionais(), '2026-09-10').estado).toBe('sem_exibicao') // quinta
    expect(dia(regionais(), '2026-09-10').pracas).toEqual([])
  })

  it('sexta sem venda traz as cinco praças livres', () => {
    const sexta = dia(regionais(), '2026-09-11')
    expect(sexta.estado).toBe('disponivel')
    expect(sexta.total).toBe(5)
    expect(sexta.livres).toBe(5)
    expect(sexta.pracas.map((p) => p.praca_codigo)).toEqual(['SP', 'RJ', 'BH', 'DF', 'PE1'])
  })

  // R8: cada praça tem seu próprio slot na data.
  it('vendidas SP, RJ e BH, sobram DF e PE1 na mesma sexta', () => {
    const vendidas = ['SP', 'RJ', 'BH'].map((praca) => ({
      data_de_exibicao: '2026-09-11',
      praca_codigo: praca,
      cliente_nome: 'NESTLE',
    }))
    const sexta = dia(regionais({ acoesRegionais: vendidas }), '2026-09-11')

    expect(sexta.estado).toBe('disponivel')
    expect(sexta.livres).toBe(2)
    expect(sexta.pracas.filter((p) => p.disponivel).map((p) => p.praca_codigo)).toEqual(['DF', 'PE1'])
    expect(sexta.pracas.find((p) => p.praca_codigo === 'SP')?.cliente_nome).toBe('NESTLE')
  })

  it('as cinco praças vendidas esgotam a data', () => {
    const vendidas = ['SP', 'RJ', 'BH', 'DF', 'PE1'].map((praca) => ({
      data_de_exibicao: '2026-09-11',
      praca_codigo: praca,
      cliente_nome: 'NESTLE',
    }))
    expect(dia(regionais({ acoesRegionais: vendidas }), '2026-09-11').estado).toBe('esgotado')
  })

  // R11: o prazo regional é PRÓPRIO — 7 dias no Encontro, não os 3 nacionais.
  it('usa o prazo mínimo regional, não o nacional', () => {
    const agosto = regionais({ ano: 2026, mes: 8 })
    // 21/08 é sexta e está a 5 dias de 16/08: dentro dos 7 do regional.
    expect(dia(agosto, '2026-08-21').estado).toBe('fora_do_prazo')
    // 28/08 é sexta e está a 12 dias: fora do prazo mínimo, logo vendável.
    expect(dia(agosto, '2026-08-28').estado).toBe('disponivel')
  })

  // R16 regional: 4 ações fecham o mês, contando AÇÃO, não linha de praça.
  it('uma ação de 3 praças conta como uma ação para o teto do mês', () => {
    const tresPracasNumaAcao = ['SP', 'RJ', 'BH'].map((praca) => ({
      data_de_exibicao: '2026-09-04',
      praca_codigo: praca,
      cliente_nome: 'NESTLE',
    }))
    // 3 linhas, 1 ação — longe do teto de 4.
    expect(dia(regionais({ acoesRegionais: tresPracasNumaAcao }), '2026-09-11').estado).toBe(
      'disponivel',
    )
  })

  it('quatro ações distintas fecham o mês', () => {
    const quatroAcoes = [
      { data_de_exibicao: '2026-09-04', praca_codigo: 'SP', cliente_nome: 'CLIENTE A' },
      { data_de_exibicao: '2026-09-04', praca_codigo: 'RJ', cliente_nome: 'CLIENTE B' },
      { data_de_exibicao: '2026-09-04', praca_codigo: 'BH', cliente_nome: 'CLIENTE C' },
      { data_de_exibicao: '2026-09-04', praca_codigo: 'DF', cliente_nome: 'CLIENTE D' },
    ]
    const onze = dia(regionais({ acoesRegionais: quatroAcoes }), '2026-09-11')
    expect(onze.estado).toBe('bloqueado')
    expect(onze.motivos.join(' ')).toContain('4 ações')
  })

  it('soma o valor das praças livres mais a produção, uma vez só', () => {
    // 49.000 + 25.000 + 9.000 + 6.000 + 7.000 = 96.000 de mídia
    // direitos 15% de cada = 14.400; produção 7.797 uma vez
    expect(dia(regionais(), '2026-09-11').valor_unitario).toBe(118197)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar ou passar**

Run: `npm test`

O motor já implementa o caminho regional, então parte destes testes pode passar
de primeira. **Isso é esperado e não é problema.** O que importa é o que
falhar: corrija a implementação em `disponibilidade.ts` até todos passarem.
Não ajuste números de teste para caber no código — eles vêm das tabelas de
`docs/regras-acoes-regionais.md`.

- [ ] **Step 3: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 254 + 9 = **263 testes**, 21 arquivos.

- [ ] **Step 4: Commitar**

```powershell
git add src/lib/dominio/disponibilidade.ts src/lib/dominio/disponibilidade.test.ts
git commit -m "feat: disponibilidade regional por praca, com teto mensal por acao"
```

---

### Task 6: Domínio — o que pode virar consulta gravada

**Files:**
- Create: `src/lib/dominio/consulta.ts`, `src/lib/dominio/consulta.test.ts`

**Interfaces:**
- Consumes: `DiaDeDisponibilidade`, `Modalidade` da Task 4.
- Produces:
  - `type ItemDaConsulta = { data: string; quantidade: number; pracas: string[] }`
  - `type ConsultaEmMontagem = { clienteId: string | null; programaId: string | null; modalidade: Modalidade; itens: ItemDaConsulta[] }`
  - `limiteDeAcoesNoDia(dia: DiaDeDisponibilidade, acoesMaximas: number): number`
  - `validarConsulta(consulta: ConsultaEmMontagem, dias: DiaDeDisponibilidade[], acoesMinimas: number, acoesMaximas: number, maxPracas: number): string[]`
  - `totalDaConsulta(consulta: ConsultaEmMontagem, dias: DiaDeDisponibilidade[]): number`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/dominio/consulta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { limiteDeAcoesNoDia, validarConsulta, totalDaConsulta } from './consulta'
import type { DiaDeDisponibilidade } from './disponibilidade'

function diaLivre(data: string, livres: number, valor: number): DiaDeDisponibilidade {
  return {
    data,
    estado: 'disponivel',
    livres,
    total: livres,
    motivos: [],
    feriado: null,
    pracas: [],
    valor_unitario: valor,
    periodo_especial: null,
    acoes_sem_classificacao: 0,
  }
}

const dias = [diaLivre('2026-09-08', 3, 120000), diaLivre('2026-09-09', 1, 120000)]

describe('limiteDeAcoesNoDia', () => {
  // O teto é o menor entre o que o programa permite e o que sobrou no dia.
  it('respeita o menor entre o máximo do programa e os slots livres', () => {
    expect(limiteDeAcoesNoDia(dias[0], 5)).toBe(3)
    expect(limiteDeAcoesNoDia(dias[0], 2)).toBe(2)
    expect(limiteDeAcoesNoDia(dias[1], 5)).toBe(1)
  })

  it('dia indisponível não comporta ação nenhuma', () => {
    expect(limiteDeAcoesNoDia({ ...dias[0], estado: 'esgotado', livres: 0 }, 5)).toBe(0)
  })
})

describe('validarConsulta', () => {
  const base = { clienteId: 'c-1', programaId: 'p-1', modalidade: 'nacional' as const }

  it('aceita consulta bem formada', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-08', quantidade: 2, pracas: [] }] }, dias, 1, 5, 3),
    ).toEqual([])
  })

  it('exige cliente e programa', () => {
    const erros = validarConsulta(
      { clienteId: null, programaId: null, modalidade: 'nacional', itens: [] },
      dias, 1, 5, 3,
    )
    expect(erros).toContain('Escolha um cliente para consultar.')
    expect(erros).toContain('Escolha um programa para consultar.')
  })

  it('exige ao menos uma data', () => {
    expect(validarConsulta({ ...base, itens: [] }, dias, 1, 5, 3)).toContain(
      'Selecione ao menos uma data.',
    )
  })

  it('recusa data que não está disponível', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-12', quantidade: 1, pracas: [] }] }, dias, 1, 5, 3),
    ).toContain('A data 2026-09-12 não está disponível.')
  })

  it('recusa quantidade acima do que sobrou no dia', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-09', quantidade: 2, pracas: [] }] }, dias, 1, 5, 3),
    ).toContain('A data 2026-09-09 comporta no máximo 1 ação.')
  })

  it('recusa quantidade abaixo do mínimo do programa', () => {
    expect(
      validarConsulta({ ...base, itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }] }, dias, 2, 5, 3),
    ).toContain('A data 2026-09-08 exige ao menos 2 ações.')
  })

  // R9: no regional, o teto de praças por ação vale na consulta também.
  it('recusa mais praças que o permitido por ação', () => {
    const erros = validarConsulta(
      {
        ...base,
        modalidade: 'regional',
        itens: [{ data: '2026-09-08', quantidade: 1, pracas: ['SP', 'RJ', 'BH', 'DF'] }],
      },
      dias, 1, 5, 3,
    )
    expect(erros).toContain('A data 2026-09-08 pode ter no máximo 3 praças.')
  })

  it('no regional exige ao menos uma praça por data', () => {
    expect(
      validarConsulta(
        { ...base, modalidade: 'regional', itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }] },
        dias, 1, 5, 3,
      ),
    ).toContain('Selecione ao menos uma praça na data 2026-09-08.')
  })
})

describe('totalDaConsulta', () => {
  it('soma valor unitário vezes quantidade em cada data', () => {
    expect(
      totalDaConsulta(
        {
          clienteId: 'c-1',
          programaId: 'p-1',
          modalidade: 'nacional',
          itens: [
            { data: '2026-09-08', quantidade: 2, pracas: [] },
            { data: '2026-09-09', quantidade: 1, pracas: [] },
          ],
        },
        dias,
      ),
    ).toBe(360000)
  })

  it('data sem valor apurado contribui zero, sem quebrar o total', () => {
    expect(
      totalDaConsulta(
        {
          clienteId: 'c-1',
          programaId: 'p-1',
          modalidade: 'nacional',
          itens: [{ data: '2026-09-08', quantidade: 1, pracas: [] }],
        },
        [{ ...dias[0], valor_unitario: null }],
      ),
    ).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./consulta"`.

- [ ] **Step 3: Implementar**

Create `src/lib/dominio/consulta.ts`:

```ts
import type { DiaDeDisponibilidade, Modalidade } from './disponibilidade'

/**
 * O que pode virar uma consulta gravada. Roda no navegador, para habilitar o
 * botão e mostrar o erro na hora, e DE NOVO no servidor antes de gravar —
 * validação de tela é conveniência, a que vale é a do servidor.
 */

export type ItemDaConsulta = {
  data: string
  quantidade: number
  /** Vazio no nacional. */
  pracas: string[]
}

export type ConsultaEmMontagem = {
  clienteId: string | null
  programaId: string | null
  modalidade: Modalidade
  itens: ItemDaConsulta[]
}

/** Duas casas decimais — dinheiro não carrega resto de ponto flutuante. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

/**
 * Quantas ações cabem numa data: o menor entre o que o programa permite por
 * dia e o que ainda sobrou. Dia indisponível não comporta nenhuma, qualquer
 * que seja o teto do cadastro.
 */
export function limiteDeAcoesNoDia(dia: DiaDeDisponibilidade, acoesMaximas: number): number {
  if (dia.estado !== 'disponivel') return 0
  return Math.min(acoesMaximas, dia.livres)
}

export function validarConsulta(
  consulta: ConsultaEmMontagem,
  dias: DiaDeDisponibilidade[],
  acoesMinimas: number,
  acoesMaximas: number,
  maxPracas: number,
): string[] {
  const erros: string[] = []

  if (!consulta.clienteId) erros.push('Escolha um cliente para consultar.')
  if (!consulta.programaId) erros.push('Escolha um programa para consultar.')
  if (consulta.itens.length === 0) erros.push('Selecione ao menos uma data.')

  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  for (const item of consulta.itens) {
    const dia = porData.get(item.data)

    if (!dia || dia.estado !== 'disponivel') {
      erros.push(`A data ${item.data} não está disponível.`)
      continue
    }

    const limite = limiteDeAcoesNoDia(dia, acoesMaximas)
    if (item.quantidade > limite) {
      erros.push(`A data ${item.data} comporta no máximo ${limite} ação${limite > 1 ? 'ões' : ''}.`)
    }
    if (item.quantidade < acoesMinimas) {
      erros.push(`A data ${item.data} exige ao menos ${acoesMinimas} ações.`)
    }

    if (consulta.modalidade === 'regional') {
      if (item.pracas.length === 0) {
        erros.push(`Selecione ao menos uma praça na data ${item.data}.`)
      }
      if (item.pracas.length > maxPracas) {
        erros.push(`A data ${item.data} pode ter no máximo ${maxPracas} praças.`)
      }
    }
  }

  return erros
}

/**
 * Total da consulta. Data cujo valor não pôde ser apurado (`valor_unitario`
 * nulo — programa sem custo de mídia cadastrado) contribui zero, para o total
 * nunca virar `NaN` na tela; o resumo mostra o aviso separadamente.
 */
export function totalDaConsulta(
  consulta: ConsultaEmMontagem,
  dias: DiaDeDisponibilidade[],
): number {
  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  return arredondar(
    consulta.itens.reduce((total, item) => {
      const unitario = porData.get(item.data)?.valor_unitario ?? 0
      return total + unitario * item.quantidade
    }, 0),
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 263 + 12 = **275 testes**, 22 arquivos.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/consulta.ts src/lib/dominio/consulta.test.ts
git commit -m "feat: validacao e total da consulta em montagem"
```

---

### Task 7: Migração do banco — consultas gravadas

**Files:**
- Create: `supabase/schema-entrega-3.sql`
- Modify: `README.md`

**Interfaces:**
- Produces: tabelas `consultas` e `consulta_itens`, com RLS.

- [ ] **Step 1: Escrever `supabase/schema-entrega-3.sql`**

```sql
-- CHATBOT 2.0 — Entrega 3: consultas gravadas.
--
-- Rode no SQL Editor do Supabase DEPOIS de toda a sequência da Entrega 2.
-- Pode rodar quantas vezes quiser: tudo usa `if not exists` / `drop policy if
-- exists`.
--
-- Ordem obrigatória:
--   1. supabase/schema.sql
--   2. supabase/schema-entrega-2.sql
--   3. supabase/schema-entrega-2-correcoes.sql
--   4. supabase/schema-entrega-2-custos.sql
--   5. supabase/schema-entrega-2-producao-regional.sql
--   6. supabase/schema-datas-especiais.sql
--   7. supabase/schema-datas-especiais-dias.sql
--   8. supabase/schema-clientes-regional.sql
--   9. supabase/schema-entrega-3.sql   <- este

-- ---------------------------------------------------------------------------
-- Uma consulta é o RETRATO do que foi validado num instante, não um ponteiro
-- para o estado atual. Preço muda, programa é renomeado, cliente é
-- reclassificado — a consulta de agosto precisa continuar dizendo em novembro
-- o que dizia em agosto. Por isso `cliente_nome` convive com `cliente_id`, do
-- mesmo jeito que `acoes_regionais` já faz.
-- ---------------------------------------------------------------------------
create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,

  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  cliente_setor text,
  cliente_industria text,

  programa_id uuid references programas (id),
  programa_nome text not null,

  modalidade text not null check (modalidade in ('nacional', 'regional')),
  valor_total numeric(14, 2) not null default 0,

  -- O que NÃO pôde ser verificado: hoje, ações cujo anunciante não casou com
  -- a carteira. jsonb porque a lista vai crescer e ninguém consulta por ela —
  -- só a lê junto da consulta.
  avisos jsonb not null default '[]'::jsonb,

  criado_em timestamptz not null default now()
);

create index if not exists consultas_usuario_idx on consultas (usuario_id, criado_em desc);

create table if not exists consulta_itens (
  id uuid primary key default gen_random_uuid(),
  consulta_id uuid not null references consultas (id) on delete cascade,
  data date not null,
  quantidade integer not null check (quantidade >= 1),
  -- Vazio no nacional; até `max_pracas_por_acao` códigos no regional.
  pracas text[] not null default '{}',
  valor_unitario numeric(14, 2),
  valor_total numeric(14, 2) not null default 0,
  periodo_especial_nome text,
  periodo_especial_percentual numeric(5, 2),
  unique (consulta_id, data)
);

create index if not exists consulta_itens_consulta_idx on consulta_itens (consulta_id);

-- ---------------------------------------------------------------------------
-- RLS — o executivo vê as PRÓPRIAS consultas; o proprietário vê todas.
-- Ninguém edita consulta gravada: um retrato que se altera não é retrato.
-- ---------------------------------------------------------------------------
alter table consultas enable row level security;
alter table consulta_itens enable row level security;

drop policy if exists "consulta propria" on consultas;
create policy "consulta propria" on consultas
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "grava consulta propria" on consultas;
create policy "grava consulta propria" on consultas
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists "item de consulta propria" on consulta_itens;
create policy "item de consulta propria" on consulta_itens
  for select to authenticated using (
    exists (
      select 1 from consultas c
      where c.id = consulta_id and (c.usuario_id = auth.uid() or e_proprietario())
    )
  );

drop policy if exists "grava item de consulta propria" on consulta_itens;
create policy "grava item de consulta propria" on consulta_itens
  for insert to authenticated with check (
    exists (select 1 from consultas c where c.id = consulta_id and c.usuario_id = auth.uid())
  );
```

- [ ] **Step 2: Aplicar no Supabase e conferir**

Rode o arquivo no **SQL Editor**. Depois escreva
`.superpowers/conferir-entrega-3.mjs` (descartável, no padrão dos scripts que
já existem ali) que confirme:

1. As duas tabelas existem.
2. Um insert em `consultas` com `usuario_id` de outro usuário é **recusado**
   pelo RLS quando feito com a chave anônima autenticada.
3. `consulta_itens` recusa `quantidade = 0`.

Cole a saída no relatório da task.

- [ ] **Step 3: Documentar no README**

Acrescente `schema-entrega-3.sql` à ordem de instalação, como nono e último
arquivo, com uma linha dizendo o que ele cria.

- [ ] **Step 4: Commitar**

```powershell
git add supabase/schema-entrega-3.sql README.md
git commit -m "feat: tabelas de consulta gravada com RLS por usuario"
```

---

### Task 8: Camada de dados — um carregamento por mês

**Files:**
- Create: `src/lib/dados/disponibilidade.ts`
- Create: `src/lib/acoes/consultas.ts`

**Interfaces:**
- Consumes: `InsumosDeDisponibilidade`, `calcularDisponibilidadeDoMes` da Task 4; `ConsultaEmMontagem`, `validarConsulta`, `totalDaConsulta` da Task 6; `obterSessao` de `@/lib/sessao-servidor`; `podeConsultarRegional` de `@/lib/dominio/perfis`.
- Produces:
  - `carregarDisponibilidade(params: { programaId: string; clienteId: string; modalidade: Modalidade; ano: number; mes: number }): Promise<{ dias: DiaDeDisponibilidade[]; programa: Programa; erro: string | null }>`
  - `gravarConsulta(consulta: ConsultaEmMontagem): Promise<{ id: string | null; erros: string[] }>`

- [ ] **Step 1: Escrever `carregarDisponibilidade`**

Create `src/lib/dados/disponibilidade.ts`. É a única função que vai ao banco
para o calendário, e faz **um** carregamento por mês — não uma consulta por
célula. Ela deve:

1. Chamar `obterPrograma(programaId)` (já existe, envolvido em `cache()`).
2. Carregar em paralelo, com `Promise.all`:
   - o cliente por `id` em `clientes` (nome, setor, industria, apto_regional);
   - `acoes_vendidas` do mês — `gte`/`lte` sobre `data_de_exibicao`, trazendo
     `programa, data_de_exibicao, formato, anunciante`;
   - `formatos` inteiro, para `montarMapa`;
   - `listarDatasBloqueadas(programaId)`;
   - `listarDatasEspeciais(programaId)`;
   - `listarAcoesRegionais(programaId, primeiroDia, ultimoDia)` (já existe em
     `src/lib/dados/regional.ts`);
   - `listarPrecos(programaId)` (idem);
   - `clientes` com `nome, setor, industria` para `indexarAnunciantes` — use
     `lerPaginado` de `src/lib/dados/paginacao.ts`, porque são 15.519 linhas e
     o PostgREST corta em 1000.
3. Montar `InsumosDeDisponibilidade` e devolver `calcularDisponibilidadeDoMes`.

Devolve `{ dias: [], programa: null, erro: 'mensagem' }` quando o programa ou o
cliente não existe — a tela precisa de uma frase, não de uma exceção.

- [ ] **Step 2: Escrever `gravarConsulta`**

Create `src/lib/acoes/consultas.ts`, com `'use server'` no topo. Deve:

1. Chamar `obterSessao()`. Sem sessão, devolver
   `{ id: null, erros: ['Sessão expirada. Entre de novo.'] }`.
2. **Recusar modalidade regional quando a sessão não tem
   `podeConsultarRegional(sessao.perfis)`** — esconder a opção na tela é
   conveniência; a proteção real é esta linha e o RLS.
3. Recarregar a disponibilidade pelo servidor (`carregarDisponibilidade`) e
   rodar `validarConsulta` **de novo** sobre os dias recém-calculados. O que o
   navegador mandou não é confiável, e entre abrir o calendário e clicar em
   gravar alguém pode ter vendido a data.
4. Gravar `consultas` e depois `consulta_itens` num segundo insert em lote,
   com o `id` devolvido.
5. Devolver `{ id, erros: [] }` ou `{ id: null, erros }`.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: sem erro de tipo.

- [ ] **Step 4: Verificar contra o banco real**

Escreva `.superpowers/conferir-disponibilidade.mjs` que chame a leitura para o
**Encontro**, modalidade regional, no mês corrente, e imprima os dias com slot
e o estado de cada praça. Confira à mão contra o que a aba Regional do programa
mostra — os dois têm que concordar. Cole a saída no relatório.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dados/disponibilidade.ts src/lib/acoes/consultas.ts
git commit -m "feat: leitura de disponibilidade em um carregamento por mes e gravacao da consulta"
```

---

### Task 9: Shell do wizard — rotas, stepper e estado

**Files:**
- Create: `src/app/(app)/consulta/layout.tsx`, `src/components/consulta/ProvedorDaConsulta.tsx`, `src/components/consulta/Stepper.tsx`, `src/components/consulta/AcoesDoPasso.tsx`
- Delete: `src/app/(app)/consulta/page.tsx` (vira redirecionamento para o passo 1)

**Interfaces:**
- Consumes: `Modalidade` da Task 4; `ItemDaConsulta` da Task 6; `Cliente` de `@/lib/dados/busca-clientes`.
- Produces:
  - `type EstadoDaConsulta = { cliente: Cliente | null; programaId: string | null; programaNome: string | null; modalidade: Modalidade; ano: number; mes: number; itens: ItemDaConsulta[] }`
  - `<ProvedorDaConsulta>{children}</ProvedorDaConsulta>`
  - `useConsulta(): { estado: EstadoDaConsulta; atualizar: (parcial: Partial<EstadoDaConsulta>) => void; limpar: () => void }`
  - `const PASSOS: { slug: string; rotulo: string }[]` — 7 itens
  - `primeiroPassoPendente(estado: EstadoDaConsulta): string`
  - `<Stepper passoAtual={string} estado={EstadoDaConsulta} />`
  - `<AcoesDoPasso voltarPara={string | null} avancarPara={string} avancarRotulo={string} habilitado={boolean} />`

- [ ] **Step 1: `ProvedorDaConsulta`**

Client Component com `createContext`. O estado nasce lendo `sessionStorage`
(chave `chatbot2:consulta`) e grava a cada mudança. `sessionStorage` e não
`localStorage`: a consulta pertence à aba, e duas abas com consultas diferentes
é um uso legítimo que `localStorage` embaralharia.

Leitura de `sessionStorage` só depois da montagem (`useEffect`), nunca no
primeiro render — o servidor não tem `sessionStorage` e a hidratação
divergiria.

`ano` e `mes` nascem do mês corrente.

- [ ] **Step 2: `primeiroPassoPendente` e as guardas**

```ts
export const PASSOS = [
  { slug: 'cliente', rotulo: 'Cliente' },
  { slug: 'setor', rotulo: 'Setor' },
  { slug: 'programa', rotulo: 'Programa' },
  { slug: 'calendario', rotulo: 'Calendário' },
  { slug: 'datas', rotulo: 'Datas' },
  { slug: 'resumo', rotulo: 'Resumo' },
  { slug: 'proposta', rotulo: 'Proposta' },
]

/** O passo mais adiantado que o estado atual justifica. */
export function primeiroPassoPendente(estado: EstadoDaConsulta): string {
  if (!estado.cliente) return 'cliente'
  if (!estado.programaId) return 'programa'
  if (estado.itens.length === 0) return 'calendario'
  return 'resumo'
}
```

Cada página de passo chama isso na montagem e, se o passo pedido está adiante
do pendente, redireciona com `router.replace`. Entrar por
`/consulta/calendario` sem cliente devolve ao passo 1 em vez de quebrar.

- [ ] **Step 3: `Stepper`**

As 7 pílulas do handoff. Passo concluído vira "✓ Cliente" com `#16A34A` sobre
`#EAF7EF`; o ativo usa o gradiente da marca com texto branco; os inativos,
fundo `#F5F4F8` e texto `#B4AEC0`. **Proposta aparece sempre desabilitada**,
com `title="Disponível na próxima entrega"` — mesma decisão que a Entrega 2
tomou com a aba Modelo de propostas.

Passo já concluído é clicável, para voltar. Passo à frente do pendente, não.

- [ ] **Step 4: `AcoesDoPasso`**

A dupla de botões do rodapé: "← Voltar" secundário e o primário com o gradiente
da marca. O primário fica desabilitado quando `habilitado` é falso, e o motivo
aparece ao lado — botão desabilitado sem explicação é o pior estado possível.

- [ ] **Step 5: Layout e redirecionamento**

`src/app/(app)/consulta/layout.tsx` envolve tudo no provider e desenha o
cabeçalho ("Nova consulta" + "Etapa N de 7") e o stepper.
`src/app/(app)/consulta/page.tsx` passa a redirecionar para
`/consulta/cliente`.

- [ ] **Step 6: Verificar e commitar**

Run: `npm run build` e `npm run lint`
Expected: sem erro.

Suba com `npm run dev`, abra `/consulta` e confirme: redireciona para
`/consulta/cliente`; o stepper mostra 7 pílulas com Proposta apagada; entrar
direto por `/consulta/resumo` devolve ao passo 1.

```powershell
git add "src/app/(app)/consulta" src/components/consulta
git commit -m "feat: shell do wizard com stepper de 7 passos e estado por aba"
```

---

### Task 10: Passos 1 e 2 — cliente e classificação

**Files:**
- Create: `src/app/(app)/consulta/cliente/page.tsx`, `src/app/(app)/consulta/setor/page.tsx`
- Create: `src/components/consulta/CartaoDoCliente.tsx`
- Create: `src/lib/dados/classificacao.ts`

**Interfaces:**
- Consumes: `CampoDeBuscaDeCliente` de `@/components/comum`; `useConsulta` da Task 9; `podeComprarRegional` de `@/lib/dominio/elegibilidade-regional`.
- Produces:
  - `programasComRestricaoPara(clienteId: string): Promise<{ programa_id: string; programa_nome: string; motivo: string }[]>`
  - `<CartaoDoCliente cliente={Cliente} aptoRegional={boolean} />`

- [ ] **Step 1: Passo 1 — busca de cliente**

Título "Para quem você está vendendo?" em Space Grotesk 26px/700. O campo de
busca de 58px com borda `2px #A031F5` e sombra roxa suave, envolvendo
`CampoDeBuscaDeCliente`, que já existe e **nunca aceita texto livre**.

Escolher um cliente grava no provider e avança para `/consulta/setor`.

Estado vazio antes de digitar: "Busque pelo nome ou CNPJ do anunciante. A
classificação vem da carteira."

- [ ] **Step 2: `programasComRestricaoPara`**

Carrega `restricoes_anunciante` com o nome do programa e devolve as que casam
com o cliente, usando `restricaoQueBloqueia` — que já existe e já trata a
correspondência do mais específico para o mais genérico. Serve aos dois passos:
o 2 lista, o 3 esmaece.

- [ ] **Step 3: Passo 2 — classificação**

Só leitura, conforme a spec. `CartaoDoCliente` com faixa superior no gradiente
da marca (nome 20px/800 branco + CNPJ) e, abaixo, grade de três colunas: Setor,
Indústria e "Ações regionais" (Elegível / Não elegível, vindo de
`podeComprarRegional`).

Em seguida, "Regras que valem para esta consulta": a linha vermelha
(`#FDECEF`, borda `#FDE0E6`, texto `#8B1030`) para cada programa com restrição
cadastrada, e a linha neutra dizendo por qual categoria o cliente disputa
exclusividade por data.

**Cliente sem setor ou indústria** recebe aviso âmbar explícito: "Este cliente
não tem setor e indústria na carteira. A verificação de concorrência não vai
rodar para ele — confirme a classificação antes de fechar." A classificação
**não é editável aqui**: ela vem da carteira e só muda na carteira.

- [ ] **Step 4: Verificar contra o banco real**

Suba com `npm run dev` e confirme com clientes reais: um cliente apto a
regional aparece como elegível; um cliente sem setor mostra o aviso âmbar; um
cliente com restrição cadastrada no MAVO (a Entrega 2 cadastrou três) aparece
com a linha vermelha nomeando o programa. Cole no relatório.

- [ ] **Step 5: Commitar**

```powershell
git add "src/app/(app)/consulta/cliente" "src/app/(app)/consulta/setor" src/components/consulta src/lib/dados/classificacao.ts
git commit -m "feat: passos de cliente e classificacao, com as regras que vao pesar"
```

---

### Task 11: Passo 3 — programa e modalidade

**Files:**
- Create: `src/app/(app)/consulta/programa/page.tsx`, `src/components/consulta/CartaoDeProgramaConsultavel.tsx`

**Interfaces:**
- Consumes: `listarProgramas` de `@/lib/dados/programas`; `programasComRestricaoPara` da Task 10; `podeConsultarRegional` de `@/lib/dominio/perfis`; `podeComprarRegional` de `@/lib/dominio/elegibilidade-regional`; `obterSessao`.
- Produces: `<CartaoDeProgramaConsultavel programa={Programa} restricao={string | null} regionalDisponivel={boolean} motivoRegionalIndisponivel={string | null} />`

- [ ] **Step 1: A grade de cartões**

Título "O que você está vendendo?". Grade
`repeat(auto-fill, minmax(280px, 1fr))` com gap 16px. Só programas com
`estado = 'ativo'` e `disponivel_para_proposta`.

Cada cartão: capa de 104px com a imagem do programa (ou o gradiente da marca,
quando não houver) e o nome em 18px/800 branco; corpo com linhas label/valor —
**Canal**, **Vai ao ar** (dias da semana por extenso), **Ações por dia**
(`slots`) e **Antecedência mínima** (`prazo_minimo_dias`, o valor em `#F59E0B`,
como o handoff pede).

- [ ] **Step 2: Programa vetado por R13**

Cartão com restrição contra o cliente fica **esmaecido (`opacity: .55`), não
clicável, com o motivo à vista** numa faixa `#FDECEF`: "Indisponível para este
cliente — Apresentadora não faz bebidas alcoólicas".

Sumir da lista deixaria o executivo sem entender a ausência; deixar escolher e
negar dois passos depois seria pior.

- [ ] **Step 3: As duas modalidades**

Programa com `aceita_regional` mostra dois botões no rodapé do cartão:
**Nacional** e **Regional**. Regional só é oferecido quando o cliente é
`apto_regional` **e** a sessão tem `podeConsultarRegional`.

Quando não é oferecido, o cartão diz **qual** dos dois faltou — falta de
elegibilidade do cliente e falta de perfil são problemas diferentes, resolvidos
por pessoas diferentes:

- sem perfil: "Consulta regional exige o perfil de executivo regional."
- cliente inelegível: "Este cliente não está habilitado para ações regionais."

Programa sem `aceita_regional` mostra um botão só, "Ver calendário →".

Escolher grava `programaId`, `programaNome` e `modalidade` no provider e avança
para `/consulta/calendario`.

- [ ] **Step 4: Verificar contra o banco real**

Confirme com uma conta que tem `executivo_regional` e outra que não tem: a
segunda não vê o botão Regional no Encontro, e vê o motivo. Confirme que um
cliente não apto também esconde o botão, com a outra frase. Cole no relatório.

- [ ] **Step 5: Commitar**

```powershell
git add "src/app/(app)/consulta/programa" src/components/consulta
git commit -m "feat: escolha de programa e modalidade, com veto de anunciante a vista"
```

---

### Task 12: Passo 4 — o calendário

**Files:**
- Create: `src/app/(app)/consulta/calendario/page.tsx`, `src/components/consulta/GradeDoMes.tsx`, `src/components/consulta/CelulaDoDia.tsx`, `src/components/consulta/LegendaDeEstados.tsx`

**Interfaces:**
- Consumes: `carregarDisponibilidade` da Task 8; `DiaDeDisponibilidade`, `EstadoDoDia` da Task 4; `limiteDeAcoesNoDia` da Task 6.
- Produces:
  - `const CORES_POR_ESTADO: Record<EstadoDoDia, { dot: string; fundo: string; rotulo: string }>`
  - `<GradeDoMes dias={DiaDeDisponibilidade[]} ano={number} mes={number} selecionadas={string[]} aoAlternar={(data: string) => void} />`

A tela central do handoff (`1e`).

- [ ] **Step 1: `CORES_POR_ESTADO`**

Um objeto só, com os tokens do handoff, para nenhum componente inventar cor:

```ts
export const CORES_POR_ESTADO: Record<EstadoDoDia, { dot: string; fundo: string; rotulo: string }> = {
  disponivel:   { dot: '#16A34A', fundo: '#EAF7EF', rotulo: 'Disponível' },
  concorrencia: { dot: '#E11D48', fundo: '#FDECEF', rotulo: 'Indisponível por concorrência' },
  fora_do_prazo:{ dot: '#F59E0B', fundo: '#FEF4E6', rotulo: 'Fora do prazo mínimo' },
  bloqueado:    { dot: '#1E1B2E', fundo: '#E9E7EE', rotulo: 'Bloqueado pelo programa' },
  esgotado:     { dot: '#1E1B2E', fundo: '#E9E7EE', rotulo: 'Esgotado' },
  sem_exibicao: { dot: 'transparent', fundo: 'transparent', rotulo: 'Sem exibição' },
}
```

- [ ] **Step 2: `CelulaDoDia`**

Altura mínima de 82px, raio 11px. Dentro: número do dia em Space Grotesk 14px,
dot de estado no canto, "N livres" na cor do estado e "usados/total" abaixo.

**O feriado aparece como legenda discreta** (10px, `var(--texto-3)`), no mesmo
lugar em qualquer estado, e **nunca** entre os motivos. Quem lê "Natal" numa
célula verde precisa entender que o programa vende naquele dia.

Célula com mais de um motivo ganha um marcador de "há mais de um motivo"; o
`title` traz todos, um por linha.

Dia `sem_exibicao`: célula apagada, sem dot, sem números, `aria-disabled`.

Só `disponivel` é clicável. As demais usam `cursor: not-allowed` e
`aria-disabled="true"`. Selecionada recebe borda `2px solid #7A2FF2` e o badge
de check circular de 15px.

No **regional**, a célula com slot mostra as cinco praças em miniatura — uma
faixa de cinco quadradinhos com a sigla, verde quando livre e escuro quando
vendida, com o nome do cliente no `title`.

- [ ] **Step 3: `GradeDoMes` e a navegação**

Cabeçalho Dom–Sáb, 7 colunas, gap 6px, e as células vazias antes do dia 1 para
alinhar a primeira semana. Navegação ‹ Mês Ano › muda `ano`/`mes` no provider e
recarrega.

Acima da grade, a nota "Disponibilidade elegível para **{cliente}**" e a
`LegendaDeEstados` com os cinco estados — dot colorido **e** rótulo em texto,
porque cor nunca é o único indicador.

- [ ] **Step 4: Os quatro estados da tela**

Carregando: esqueleto da grade, não spinner solto. Erro: a frase que
`carregarDisponibilidade` devolveu, com botão de tentar de novo. Mês inteiro
sem exibição: aviso explicando que o programa não vai ao ar naquele mês.

- [ ] **Step 5: Verificar contra o banco real**

Com o **Encontro** em modalidade regional, confirme na tela: as sextas trazem
as cinco praças; os outros dias ficam apagados; as datas dentro dos 7 dias
aparecem amarelas. Compare com a `MatrizDePracas` da aba Regional — as duas têm
que concordar. Cole capturas ou a descrição no relatório.

- [ ] **Step 6: Commitar**

```powershell
git add "src/app/(app)/consulta/calendario" src/components/consulta
git commit -m "feat: calendario de disponibilidade com pracas na celula e feriado como legenda"
```

---

### Task 13: Passo 5 — datas, quantidades e praças

**Files:**
- Create: `src/app/(app)/consulta/datas/page.tsx`, `src/components/consulta/PainelDeDatas.tsx`, `src/components/consulta/SeletorDePracas.tsx`

**Interfaces:**
- Consumes: `limiteDeAcoesNoDia`, `validarConsulta`, `totalDaConsulta` da Task 6; `formatarMoeda` de `@/lib/dominio/moeda`.
- Produces: `<PainelDeDatas dias={DiaDeDisponibilidade[]} programa={Programa} />`

- [ ] **Step 1: A lista de datas escolhidas**

Cada data selecionada vira uma linha com dot verde, a data por extenso
("Sexta, 11 de setembro"), o contador de ações e o subtotal em
`formatarMoeda`. Botão × remove a data e devolve os slots.

O contador vai de `acoes_minimas` até `limiteDeAcoesNoDia(dia, acoes_maximas)`
— o menor entre o que o programa permite e o que sobrou no dia. Chegar ao teto
desabilita o "+" e explica: "Esta data só tem 1 espaço livre."

- [ ] **Step 2: `SeletorDePracas` (só no regional)**

Cada data mostra as cinco praças como botões alternáveis. Praça já vendida vem
desabilitada, com o nome do cliente no `title`. Passar de
`max_pracas_por_acao` desabilita as demais e mostra "Uma ação pode ter no
máximo 3 praças."

- [ ] **Step 3: Rodapé com o total e a validação**

`totalDaConsulta` em roxo `#7A2FF2`, Space Grotesk. Os erros de
`validarConsulta` aparecem em lista acima do botão, e o botão "Ver resumo →"
só habilita quando a lista está vazia.

Estado vazio: "Nenhuma data selecionada. Volte ao calendário e escolha as datas
disponíveis." com botão de voltar.

- [ ] **Step 4: Verificar e commitar**

Confirme na tela: remover uma data devolve o slot; pedir 4 praças é recusado;
pedir mais ações do que o dia comporta é recusado.

```powershell
git add "src/app/(app)/consulta/datas" src/components/consulta
git commit -m "feat: painel de datas com quantidade por dia e pracas por acao"
```

---

### Task 14: Passo 6 — resumo e gravação

**Files:**
- Create: `src/app/(app)/consulta/resumo/page.tsx`, `src/components/consulta/ResumoDaConsulta.tsx`

**Interfaces:**
- Consumes: `gravarConsulta` da Task 8; `totalDaConsulta` da Task 6; `BotaoDeGravacao` de `@/components/comum`.
- Produces: `<ResumoDaConsulta />`

- [ ] **Step 1: O detalhamento**

Uma seção por data: mídia, direitos e conexos e produção discriminados — nunca
só o total. No regional, uma linha por praça comprada. Os valores vêm de
`calcularCustoDaAcaoRegional` e `calcularCustoDaAcaoNacional`, que já são o
cálculo oficial e **não se duplicam aqui**.

Período especial aparece **nomeado, com o acréscimo visível**: "Black Friday ·
+20% sobre a mídia" — nunca embutido no número, ou ninguém entende por que o
valor subiu.

- [ ] **Step 2: Os avisos**

O aviso âmbar obrigatório do handoff, em `#FEF4E6`: "A proposta valida a
disponibilidade neste momento — não confirma reserva do inventário."

E, quando houver datas com `acoes_sem_classificacao > 0`: "Em 2 datas há ações
cujo anunciante não foi identificado na carteira — a concorrência não pôde ser
verificada nelas." Esse texto vai também para a coluna `avisos` da consulta.

- [ ] **Step 3: A gravação**

Chegar a esta tela grava a consulta, uma vez só. Use `BotaoDeGravacao`, que já
desabilita durante a escrita, para o botão de confirmação; gravação
automática ao montar precisa de guarda contra a dupla montagem do modo estrito
do React em desenvolvimento — grave com um `useRef` de controle, não com
`useEffect` solto.

Sucesso mostra confirmação visível com o identificador da consulta. Erro mostra
as frases devolvidas por `gravarConsulta` **sem perder a tela** — o executivo
não pode perder seis passos por uma falha de rede.

- [ ] **Step 4: O botão da Entrega 4**

**Gerar proposta** aparece com o gradiente da marca, 50px, **desabilitado**, com
"Disponível na próxima entrega" ao lado.

- [ ] **Step 5: Verificar contra o banco real**

Percorra o wizard inteiro, do passo 1 ao 6, com um cliente real no Encontro,
modalidade regional, escolhendo duas sextas. Depois confirme direto no banco:

```sql
select c.cliente_nome, c.programa_nome, c.modalidade, c.valor_total, c.avisos,
       i.data, i.quantidade, i.pracas, i.valor_total
from consultas c join consulta_itens i on i.consulta_id = c.id
order by c.criado_em desc limit 10;
```

Cole a saída no relatório. Confira que `valor_total` da consulta é a soma dos
itens.

- [ ] **Step 6: Verificação final e commit**

```powershell
npm test
npm run build
npm run lint
git add "src/app/(app)/consulta/resumo" src/components/consulta
git commit -m "feat: resumo com valor discriminado e gravacao do retrato da consulta"
```

---

## Verificação final da entrega

1. `npm test` — **275 testes** passando, 22 arquivos.
2. `npm run build` e `npm run lint` sem erro.
3. O wizard percorre os seis passos; o voltar do navegador funciona; F5 no
   passo 4 não perde os três anteriores.
4. Entrar por `/consulta/calendario` sem cliente devolve ao passo 1.
5. Nenhum campo de cliente aceita nome digitado.
6. Programa com restrição contra o cliente aparece esmaecido, com o motivo.
7. Regional só aparece para cliente apto e executivo com perfil regional, e é
   recusado no servidor quando forçado sem perfil.
8. No Encontro, sexta com SP, RJ e BH vendidos: DF e PE1 livres. Quinta: sem
   disponibilidade regional alguma.
9. Data dentro do prazo aparece amarela; data também bloqueada mostra os dois
   motivos, sem furar a faixa amarela.
10. Mês com o teto atingido fecha, com o motivo por extenso.
11. Feriado aparece nomeado e **não** altera o estado: 25/12 sem cadastro segue
    verde e vendável.
12. Data com concorrente aparece vermelha, nomeando-o; data com anunciante não
    identificado segue disponível, com o aviso.
13. O resumo discrimina mídia, direitos e produção, e nomeia o período especial
    com o percentual.
14. Chegar ao resumo grava `consultas` e `consulta_itens` — verificado no banco.
15. O aviso de que não há reserva está visível no resumo.

## Pendências que continuam abertas

Registradas na spec, não bloqueiam esta entrega: se a ação regional consome o
slot nacional (R15 segue conservador, em `regionalConsomeSlotNacional`); os
valores por praça ("checar com Pricing"); as regras do Altas Horas; o que é o
"pré-projeto"; se praças da mesma ação podem ter anunciantes diferentes; e o
ajuste da base de clientes do Globo Take, que deve elevar a cobertura do
casamento de anunciantes acima dos 83,7% medidos hoje.

**Uma suposição desta entrega que vale confirmar com a área:** o teto mensal do
regional (4 ações) conta **ações distintas**, não linhas de praça — uma ação de
3 praças conta 1, não 3. É a leitura que faz o teto do Manual de Práticas ter
sentido, mas não está escrita em lugar nenhum. Está isolada em `acoesNoMes`,
em `disponibilidade.ts`, e se inverte ali.
