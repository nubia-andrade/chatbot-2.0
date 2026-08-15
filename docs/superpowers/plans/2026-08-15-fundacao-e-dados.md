# CHATBOT 2.0 — Entrega 1: Fundação e Dados — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o alicerce do CHATBOT 2.0 — projeto Next.js rodando, login real, cadastro de programas com suas regras comerciais, e a importação das vendas da API do Globo Take para o Supabase.

**Architecture:** Next.js 16 (App Router) com as regras de negócio isoladas em `src/lib/dominio` — funções puras, sem banco e sem tela, cobertas por Vitest. A leitura do Supabase fica em `src/lib/dados`, a escrita em `src/lib/acoes`. Os dados de venda chegam por um importador que roda na máquina do administrador (onde o SSO corporativo funciona) e grava um snapshot no Supabase; o aplicativo nunca fala com a API diretamente.

**Tech Stack:** Next.js 16.3.0 · React 19.2.8 · TypeScript 5 · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vitest 4 · Node 22

**Spec:** `docs/superpowers/specs/2026-08-15-fundacao-e-dados-design.md`

## Global Constraints

- **Nome do pacote npm:** `chatbot-2.0`. **Nome do produto** em telas, README e Vercel: **CHATBOT 2.0**.
- **Idioma do código:** identificadores, arquivos e mensagens em português, seguindo o padrão do `cache-hub` (`../Projetos Apps/cache-hub`). Acentuação correta obrigatória em todo texto visível.
- **Versões fixas:** `next@16.3.0`, `react@19.2.8`, `react-dom@19.2.8`, `eslint-config-next@16.3.0`. Demais dependências por faixa, como no cache-hub.
- **Next.js 16 tem mudanças incompatíveis com o que modelos de linguagem aprenderam.** Antes de escrever qualquer código de rota, layout ou server action, leia os guias em `node_modules/next/dist/docs/`. O `next dev` escreve um bloco `nextjs-agent-rules` no `AGENTS.md` — commite-o junto com o trabalho.
- **Categorias de formato (exatas, com acento):** `AÇÃO DE CONTEÚDO`, `COMERCIAL`, `CONTEÚDO NO BREAK`, `INSERT`, `VINHETA`, `CHAMADA`.
- **Regra R1:** só formato de categoria `AÇÃO DE CONTEÚDO` ocupa slot. Cada linha da API é uma ação; não há coluna de quantidade.
- **Regra R2:** formato vazio, `-` ou ausente da tabela resolve para `AÇÃO DE CONTEÚDO` (viés conservador).
- **Regra R3:** descartar `data_de_exibicao` anterior à data corrente.
- **Regra R4:** descartar `data_de_exibicao = 01/01/2999` (sentinela de "sem data"), sem aviso na interface.
- **Regra R5:** a categoria é resolvida na leitura, nunca gravada em `acoes_vendidas`.
- **Regra R6:** junção de programa pelo mnemônico anterior ao primeiro ` - `; sem mnemônico, por `programa_apelidos`.
- **Nada de `dados/` vai para o git.** As planilhas contêm CNPJ e e-mails nominais.
- **API do Globo Take:** `https://globotake.g.globo/api/v1/programsActionsPowerBi` — exige SSO corporativo; chamada anônima devolve HTML de login com HTTP 200.
- **Amostra de referência para testes:** `dados/amostra-globotake.xlsx`, 302 registros, 26 colunas.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/dominio/formatos.ts` | normalizar formato, resolver categoria, decidir se ocupa slot (R1, R2) |
| `src/lib/dominio/programas.ts` | extrair mnemônico e casar texto da API com programa (R6) |
| `src/lib/dominio/ocupacao.ts` | contar ações de conteúdo por programa e data (R1) |
| `src/lib/dominio/ingestao.ts` | converter data, filtrar (R3, R4), projetar colunas, achar formato novo |
| `src/lib/dominio/cadastro.ts` | validar o cadastro de programa (R7) |
| `src/lib/supabase/*.ts` | conexão navegador e servidor |
| `src/lib/dados/*.ts` | leitura das tabelas |
| `src/lib/acoes/*.ts` | escrita (server actions) |
| `src/app/globals.css` | tokens de design do handoff |
| `src/app/login/page.tsx` | tela 1a |
| `src/app/(app)/layout.tsx` | shell com sidebar e guarda de rota |
| `src/components/**` | peças visuais por feature |
| `supabase/schema.sql` | tabelas, índices e RLS |
| `supabase/seed.sql` | **gerado** — carga de formatos e clientes |
| `scripts/gerar-seed.mjs` | lê as planilhas e gera o `seed.sql` |
| `scripts/importar.mjs` | busca a API e grava o snapshot |

---

### Task 1: Esqueleto do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.mts`, `.gitignore`, `.env.local.example`, `README.md`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: nada.
- Produces: projeto que responde a `npm run dev`, `npm test` e `npm run build`; tokens CSS que todas as telas consomem.

- [ ] **Step 1: Gerar o esqueleto numa pasta temporária**

`create-next-app` valida o nome da pasta como nome de pacote npm, e `CHATBOT 2.0` tem espaço e maiúsculas — geraria erro. Por isso o esqueleto nasce fora e é copiado.

```powershell
cd $env:TEMP
npx --yes create-next-app@16.3.0 chatbot-esqueleto --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --yes
```

- [ ] **Step 2: Copiar para a pasta do projeto**

```powershell
$origem = "$env:TEMP\chatbot-esqueleto"
$destino = "C:\Users\nandrad\OneDrive - Globo Comunicação e Participações sa\Área de Trabalho\Apps\CHATBOT 2.0"
Copy-Item "$origem\*" $destino -Recurse -Force
Remove-Item $origem -Recurse -Force
```

- [ ] **Step 3: Ajustar o `package.json`**

Substituir o arquivo por:

```json
{
  "name": "chatbot-2.0",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:assistir": "vitest",
    "seed:gerar": "node scripts/gerar-seed.mjs",
    "importar": "node --experimental-strip-types scripts/importar.mjs"
  },
  "dependencies": {
    "@supabase/ssr": "^0.12.4",
    "@supabase/supabase-js": "^2.112.2",
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.0",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.10",
    "xlsx": "^0.18.5"
  }
}
```

- [ ] **Step 4: Criar `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 5: Criar o `.gitignore`**

```gitignore
node_modules/
.next/
out/
build/
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts

# Planilhas de trabalho: contêm CNPJ e e-mails nominais. Nunca versionar.
dados/

# Artefatos do Office e do OneDrive
~$*
*.tmp
```

- [ ] **Step 6: Criar `.env.local.example`**

```dotenv
# Copie este arquivo para .env.local e preencha com as chaves do seu projeto
# no Supabase: Project Settings > API.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Usada só pelos scripts de linha de comando (seed e importação), nunca no
# navegador e nunca no Vercel. Supabase: Project Settings > API > service_role.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 7: Escrever os tokens de design em `src/app/globals.css`**

Valores retirados do handoff (`design_handoff/README.md`).

```css
@import "tailwindcss";

:root {
  --marca: linear-gradient(135deg, #FF2D55 0%, #A031F5 52%, #2D6BFF 100%);
  --tile-a: linear-gradient(160deg, #FFD23F, #FF5E3A);
  --tile-b: linear-gradient(160deg, #12D8FA, #2D6BFF);
  --tile-c: linear-gradient(160deg, #F857A6, #7A2FF2);

  --roxo: #7A2FF2;
  --roxo-hover: #5E22C4;
  --texto: #1A1626;
  --texto-2: #6B6577;
  --texto-3: #8A8497;
  --placeholder: #B4AEC0;

  --canvas: #E7E5EE;
  --superficie: #FFFFFF;
  --superficie-suave: #FAF9FC;
  --borda: #ECEAF1;
  --borda-forte: #E2DFEA;

  --disponivel: #16A34A;
  --disponivel-fundo: #EAF7EF;
  --concorrencia: #E11D48;
  --concorrencia-fundo: #FDECEF;
  --prazo: #F59E0B;
  --prazo-fundo: #FEF4E6;
  --reservado: #64748B;
  --reservado-fundo: #EEF1F5;
  --esgotado: #1E1B2E;
  --esgotado-fundo: #E9E7EE;

  --raio-janela: 16px;
  --raio-card: 12px;
  --raio-campo: 11px;
  --sombra-janela: 0 18px 50px rgba(60, 30, 110, .14);
  --sombra-botao: 0 12px 26px rgba(122, 47, 242, .3);
}

body {
  background: var(--canvas);
  color: var(--texto);
  font-family: var(--fonte-corpo), system-ui, sans-serif;
}
```

- [ ] **Step 8: Escrever `src/app/layout.tsx` com as fontes do handoff**

```tsx
import type { Metadata } from 'next'
import { Space_Grotesk, Manrope } from 'next/font/google'
import './globals.css'

const tituloFonte = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-titulo',
})

const corpoFonte = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--fonte-corpo',
})

export const metadata: Metadata = {
  title: 'CHATBOT 2.0',
  description: 'Consulta de disponibilidade e geração de propostas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${tituloFonte.variable} ${corpoFonte.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 9: Escrever `src/app/page.tsx` como redirecionamento**

```tsx
import { redirect } from 'next/navigation'

export default function Raiz() {
  redirect('/login')
}
```

- [ ] **Step 10: Instalar e verificar**

```powershell
npm install
npm run dev
```

Esperado: servidor em <http://localhost:3000>, redirecionando para `/login` (que ainda dará 404 — a tela nasce na Task 8). Pare com `Ctrl + C`.

- [ ] **Step 11: Mover as planilhas para `dados/` e o handoff para `design_handoff/`**

```powershell
New-Item -ItemType Directory -Force -Path dados, design_handoff | Out-Null
Move-Item "Carteira.xlsx","Formatos.xlsx","Formatos.backup.xlsx","amostra-globotake.xlsx","formatos-para-classificar.csv" dados\ -Force
Expand-Archive "Wireframes GloboAds App.zip" -DestinationPath design_handoff -Force
Move-Item "Wireframes GloboAds App.zip" dados\ -Force
```

- [ ] **Step 12: Iniciar o repositório e commitar**

```powershell
git init -b main
git add -A
git commit -m "feat: esqueleto do projeto CHATBOT 2.0 com tokens do handoff"
```

Confira antes de commitar que `git status` **não** lista nada de `dados/`.

---

### Task 2: Domínio — formatos e categorias

**Files:**
- Create: `src/lib/dominio/formatos.ts`
- Test: `src/lib/dominio/formatos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Categoria = 'AÇÃO DE CONTEÚDO' | 'COMERCIAL' | 'CONTEÚDO NO BREAK' | 'INSERT' | 'VINHETA' | 'CHAMADA'`
  - `type MapaDeFormatos = Map<string, Categoria>`
  - `normalizarFormato(texto: string | null | undefined): string`
  - `categoriaDoFormato(formato: string | null | undefined, mapa: MapaDeFormatos): Categoria`
  - `ocupaSlot(formato: string | null | undefined, mapa: MapaDeFormatos): boolean`
  - `montarMapa(linhas: { formato: string; categoria: string }[]): MapaDeFormatos`

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `src/lib/dominio/formatos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarMapa, normalizarFormato, categoriaDoFormato, ocupaSlot } from './formatos'

const mapa = montarMapa([
  { formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL BREAK', categoria: 'COMERCIAL' },
  { formato: 'QR CODE', categoria: 'INSERT' },
  { formato: 'COMERCIAL CONTEÚDO NO BREAK  DET PRIMEIRÍSSIMA', categoria: 'CONTEÚDO NO BREAK' },
])

describe('normalizarFormato', () => {
  it('coloca em maiúsculas, apara e colapsa espaços repetidos', () => {
    expect(normalizarFormato('  ação plena ')).toBe('AÇÃO PLENA')
    expect(normalizarFormato('COMERCIAL  BREAK')).toBe('COMERCIAL BREAK')
  })

  it('devolve string vazia para nulo e indefinido', () => {
    expect(normalizarFormato(null)).toBe('')
    expect(normalizarFormato(undefined)).toBe('')
  })
})

describe('categoriaDoFormato', () => {
  it('encontra a categoria cadastrada', () => {
    expect(categoriaDoFormato('AÇÃO PLENA', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('QR CODE', mapa)).toBe('INSERT')
  })

  it('casa mesmo com espaços duplicados no cadastro', () => {
    expect(categoriaDoFormato('COMERCIAL CONTEÚDO NO BREAK DET PRIMEIRÍSSIMA', mapa))
      .toBe('CONTEÚDO NO BREAK')
  })

  // R2: viés conservador — o desconhecido ocupa slot
  it('resolve vazio, traço e desconhecido para AÇÃO DE CONTEÚDO', () => {
    expect(categoriaDoFormato('', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('-', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato(null, mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('FORMATO QUE AINDA NÃO EXISTE', mapa)).toBe('AÇÃO DE CONTEÚDO')
  })
})

describe('ocupaSlot', () => {
  // R1: só ação de conteúdo consome slot
  it('só é verdadeiro para AÇÃO DE CONTEÚDO', () => {
    expect(ocupaSlot('AÇÃO PLENA', mapa)).toBe(true)
    expect(ocupaSlot('COMERCIAL BREAK', mapa)).toBe(false)
    expect(ocupaSlot('QR CODE', mapa)).toBe(false)
  })

  it('é verdadeiro para formato desconhecido', () => {
    expect(ocupaSlot('-', mapa)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./formatos"`.

- [ ] **Step 3: Implementar `src/lib/dominio/formatos.ts`**

```ts
export type Categoria =
  | 'AÇÃO DE CONTEÚDO'
  | 'COMERCIAL'
  | 'CONTEÚDO NO BREAK'
  | 'INSERT'
  | 'VINHETA'
  | 'CHAMADA'

export type MapaDeFormatos = Map<string, Categoria>

/**
 * R2 — o viés é conservador de propósito: ação sem formato definido é lançada
 * com muita antecedência e pode virar ação de conteúdo. Errar para este lado
 * evita anunciar disponibilidade que não existe.
 */
export const CATEGORIA_PADRAO: Categoria = 'AÇÃO DE CONTEÚDO'

export function normalizarFormato(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return ''
  return texto.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function montarMapa(linhas: { formato: string; categoria: string }[]): MapaDeFormatos {
  const mapa: MapaDeFormatos = new Map()
  for (const linha of linhas) {
    mapa.set(normalizarFormato(linha.formato), linha.categoria as Categoria)
  }
  return mapa
}

export function categoriaDoFormato(
  formato: string | null | undefined,
  mapa: MapaDeFormatos,
): Categoria {
  const chave = normalizarFormato(formato)
  if (chave === '' || chave === '-') return CATEGORIA_PADRAO
  return mapa.get(chave) ?? CATEGORIA_PADRAO
}

// R1 — só ação de conteúdo consome slot. Comercial, insert, vinheta, chamada e
// conteúdo no break existem na base mas são invisíveis à disponibilidade.
export function ocupaSlot(formato: string | null | undefined, mapa: MapaDeFormatos): boolean {
  return categoriaDoFormato(formato, mapa) === 'AÇÃO DE CONTEÚDO'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/formatos.ts src/lib/dominio/formatos.test.ts
git commit -m "feat: resolucao de formato em categoria com regra conservadora"
```

---

### Task 3: Domínio — junção de programas

**Files:**
- Create: `src/lib/dominio/programas.ts`
- Test: `src/lib/dominio/programas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `extrairMnemonico(textoDaApi: string | null | undefined): string | null`
  - `type IndiceDeProgramas = { porMnemonico: Map<string, string>; porApelido: Map<string, string> }`
  - `montarIndice(programas: { id: string; mnemonico: string }[], apelidos: { programa_id: string; texto: string }[]): IndiceDeProgramas`
  - `encontrarProgramaId(textoDaApi: string | null | undefined, indice: IndiceDeProgramas): string | null`

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `src/lib/dominio/programas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extrairMnemonico, montarIndice, encontrarProgramaId } from './programas'

const indice = montarIndice(
  [
    { id: 'p-mavo', mnemonico: 'MAVO' },
    { id: 'p-domi', mnemonico: 'DOMI' },
    { id: 'p-sfn', mnemonico: 'SFN' },
    { id: 'p-viver', mnemonico: 'VIVSER' },
  ],
  [{ programa_id: 'p-viver', texto: 'VIVER SERTANEJO' }],
)

describe('extrairMnemonico', () => {
  it('pega o trecho antes do primeiro hífen', () => {
    expect(extrairMnemonico('MAVO - MAIS VOCE')).toBe('MAVO')
    expect(extrairMnemonico('N20H - NOVELA III')).toBe('N20H')
  })

  it('ignora hifens posteriores e espaços extras', () => {
    expect(extrairMnemonico('SFN -  SPATEN FIGHT NIGHT - DUMMY')).toBe('SFN')
  })

  it('aceita mnemônico com espaço interno', () => {
    expect(extrairMnemonico('SÃO JULHÃO - MELHORES MOMENTOS')).toBe('SÃO JULHÃO')
  })

  it('devolve nulo quando não há hífen separador', () => {
    expect(extrairMnemonico('VIVER SERTANEJO')).toBeNull()
    expect(extrairMnemonico('')).toBeNull()
    expect(extrairMnemonico(null)).toBeNull()
  })
})

describe('encontrarProgramaId', () => {
  it('casa pelo mnemônico', () => {
    expect(encontrarProgramaId('MAVO - MAIS VOCE', indice)).toBe('p-mavo')
    expect(encontrarProgramaId('DOMI - DOMINGAO', indice)).toBe('p-domi')
  })

  // R6: os 4 programas que chegam sem mnemônico dependem do apelido
  it('cai para o apelido quando não há mnemônico', () => {
    expect(encontrarProgramaId('VIVER SERTANEJO', indice)).toBe('p-viver')
  })

  it('devolve nulo para programa não cadastrado', () => {
    expect(encontrarProgramaId('BREAK DE TERRITÓRIOS', indice)).toBeNull()
    expect(encontrarProgramaId('XPTO - INEXISTENTE', indice)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./programas"`.

- [ ] **Step 3: Implementar `src/lib/dominio/programas.ts`**

```ts
import { normalizarFormato as normalizarTexto } from './formatos'

export type IndiceDeProgramas = {
  porMnemonico: Map<string, string>
  porApelido: Map<string, string>
}

/**
 * R6 — o campo `programa` da API chega como `MNEMONICO - NOME`
 * (ex.: `MAVO - MAIS VOCE`). Quatro dos 23 programas chegam sem mnemônico e
 * dependem de apelido cadastrado.
 */
export function extrairMnemonico(textoDaApi: string | null | undefined): string | null {
  const texto = normalizarTexto(textoDaApi)
  const posicao = texto.indexOf(' - ')
  if (posicao <= 0) return null
  return texto.slice(0, posicao).trim()
}

export function montarIndice(
  programas: { id: string; mnemonico: string }[],
  apelidos: { programa_id: string; texto: string }[],
): IndiceDeProgramas {
  const porMnemonico = new Map<string, string>()
  for (const programa of programas) {
    porMnemonico.set(normalizarTexto(programa.mnemonico), programa.id)
  }
  const porApelido = new Map<string, string>()
  for (const apelido of apelidos) {
    porApelido.set(normalizarTexto(apelido.texto), apelido.programa_id)
  }
  return { porMnemonico, porApelido }
}

export function encontrarProgramaId(
  textoDaApi: string | null | undefined,
  indice: IndiceDeProgramas,
): string | null {
  const mnemonico = extrairMnemonico(textoDaApi)
  if (mnemonico !== null) {
    const achado = indice.porMnemonico.get(mnemonico)
    if (achado !== undefined) return achado
  }
  return indice.porApelido.get(normalizarTexto(textoDaApi)) ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 14 testes no total.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/programas.ts src/lib/dominio/programas.test.ts
git commit -m "feat: juncao de programa por mnemonico e apelido"
```

---

### Task 4: Domínio — ocupação de slots

**Files:**
- Create: `src/lib/dominio/ocupacao.ts`
- Test: `src/lib/dominio/ocupacao.test.ts`

**Interfaces:**
- Consumes: `MapaDeFormatos` e `ocupaSlot` da Task 2.
- Produces:
  - `type AcaoVendida = { programa: string; data_de_exibicao: string; formato: string }`
  - `chaveDeOcupacao(programa: string, data: string): string`
  - `contarOcupacao(acoes: AcaoVendida[], mapa: MapaDeFormatos): Map<string, number>`
  - `ocupacaoEm(acoes: AcaoVendida[], mapa: MapaDeFormatos, programa: string, data: string): number`

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `src/lib/dominio/ocupacao.test.ts`. Os dados reproduzem o caso real: em `16/08/2026` o Domingão tem 6 vendas, das quais 5 são ação de conteúdo.

```ts
import { describe, it, expect } from 'vitest'
import { montarMapa } from './formatos'
import { contarOcupacao, ocupacaoEm, chaveDeOcupacao } from './ocupacao'

const mapa = montarMapa([
  { formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'AÇÃO ESPECIAL', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL BREAK', categoria: 'COMERCIAL' },
  { formato: 'VINHETA TOP DE 5', categoria: 'VINHETA' },
])

const acoes = [
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO ESPECIAL' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'AÇÃO ESPECIAL' },
  { programa: 'DOMI - DOMINGAO', data_de_exibicao: '2026-08-16', formato: 'COMERCIAL BREAK' },
  { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-08-16', formato: 'AÇÃO PLENA' },
  { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-08-17', formato: 'VINHETA TOP DE 5' },
]

describe('contarOcupacao', () => {
  // R1: as 6 vendas do Domingão viram 5 slots — o comercial break não conta
  it('conta apenas ações de conteúdo', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.get(chaveDeOcupacao('DOMI - DOMINGAO', '2026-08-16'))).toBe(5)
  })

  it('separa por programa e por data', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.get(chaveDeOcupacao('MAVO - MAIS VOCE', '2026-08-16'))).toBe(1)
  })

  it('não cria entrada para data só com formato que não ocupa slot', () => {
    const contagem = contarOcupacao(acoes, mapa)
    expect(contagem.has(chaveDeOcupacao('MAVO - MAIS VOCE', '2026-08-17'))).toBe(false)
  })
})

describe('ocupacaoEm', () => {
  it('devolve a contagem da data pedida', () => {
    expect(ocupacaoEm(acoes, mapa, 'DOMI - DOMINGAO', '2026-08-16')).toBe(5)
  })

  it('devolve zero para data sem venda', () => {
    expect(ocupacaoEm(acoes, mapa, 'DOMI - DOMINGAO', '2026-12-25')).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./ocupacao"`.

- [ ] **Step 3: Implementar `src/lib/dominio/ocupacao.ts`**

```ts
import { ocupaSlot, type MapaDeFormatos } from './formatos'

export type AcaoVendida = {
  programa: string
  data_de_exibicao: string
  formato: string
}

export function chaveDeOcupacao(programa: string, data: string): string {
  return `${programa}|${data}`
}

/**
 * R1 — cada linha da API é uma ação; não existe coluna de quantidade.
 * A contagem considera apenas formatos de categoria AÇÃO DE CONTEÚDO.
 */
export function contarOcupacao(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const acao of acoes) {
    if (!ocupaSlot(acao.formato, mapa)) continue
    const chave = chaveDeOcupacao(acao.programa, acao.data_de_exibicao)
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  return contagem
}

export function ocupacaoEm(
  acoes: AcaoVendida[],
  mapa: MapaDeFormatos,
  programa: string,
  data: string,
): number {
  return contarOcupacao(acoes, mapa).get(chaveDeOcupacao(programa, data)) ?? 0
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 19 testes no total.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/ocupacao.ts src/lib/dominio/ocupacao.test.ts
git commit -m "feat: contagem de slots ocupados por programa e data"
```

---

### Task 5: Domínio — filtros e projeção da ingestão

**Files:**
- Create: `src/lib/dominio/ingestao.ts`
- Test: `src/lib/dominio/ingestao.test.ts`

**Interfaces:**
- Consumes: `MapaDeFormatos`, `normalizarFormato` da Task 2.
- Produces:
  - `const DATA_SEM_DEFINICAO = '2999-01-01'`
  - `converterData(texto: string | null | undefined): string | null`
  - `type RegistroBruto = Record<string, unknown>`
  - `type AcaoImportada = { numero_da_entrega: string; programa: string; data_de_exibicao: string; anunciante: string; marca: string; formato: string; tipo_da_entrega: string; status_aprovacao: string }`
  - `deveImportar(bruto: RegistroBruto, hoje: string): boolean`
  - `projetar(bruto: RegistroBruto): AcaoImportada`
  - `formatosNovos(acoes: AcaoImportada[], mapa: MapaDeFormatos): string[]`

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `src/lib/dominio/ingestao.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarMapa } from './formatos'
import { converterData, deveImportar, projetar, formatosNovos } from './ingestao'

const HOJE = '2026-08-15'

function bruto(sobrescritas: Record<string, unknown> = {}) {
  return {
    numero_da_entrega: 9163,
    programa: 'DOMI - DOMINGAO',
    nome_da_obra: 'Domingão',
    data_de_exibicao: '16/08/2026',
    anunciante: 'VALE SA',
    marca: 'VALE',
    formatos: 'AÇÃO PLENA',
    tipo_da_entrega: 'Avulsa',
    status_aprovacao: 'Aprovado',
    custo_de_producao: 461000,
    elenco: 'FULANO DE TAL',
    observacoes_financeiras: 'Total Produção: R$ 1.844.000,00',
    ...sobrescritas,
  }
}

describe('converterData', () => {
  it('converte dd/mm/aaaa para o formato do banco', () => {
    expect(converterData('16/08/2026')).toBe('2026-08-16')
    expect(converterData('01/01/2999')).toBe('2999-01-01')
  })

  it('devolve nulo para entrada inválida', () => {
    expect(converterData('')).toBeNull()
    expect(converterData('-')).toBeNull()
    expect(converterData(null)).toBeNull()
    expect(converterData('32/13/2026')).toBeNull()
  })
})

describe('deveImportar', () => {
  it('aceita exibição futura', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '16/08/2026' }), HOJE)).toBe(true)
  })

  it('aceita o próprio dia de hoje', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '15/08/2026' }), HOJE)).toBe(true)
  })

  // R3: o passado não interessa
  it('recusa exibição passada', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '14/08/2026' }), HOJE)).toBe(false)
  })

  // R4: sentinela de ação sem data definida
  it('recusa a data sentinela 01/01/2999', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '01/01/2999' }), HOJE)).toBe(false)
  })

  it('recusa data inválida', () => {
    expect(deveImportar(bruto({ data_de_exibicao: '-' }), HOJE)).toBe(false)
  })
})

describe('projetar', () => {
  it('mantém só as colunas que importam à disponibilidade', () => {
    expect(projetar(bruto())).toEqual({
      numero_da_entrega: '9163',
      programa: 'DOMI - DOMINGAO',
      data_de_exibicao: '2026-08-16',
      anunciante: 'VALE SA',
      marca: 'VALE',
      formato: 'AÇÃO PLENA',
      tipo_da_entrega: 'Avulsa',
      status_aprovacao: 'Aprovado',
    })
  })

  // R5: a categoria não é gravada, é resolvida na leitura
  it('não grava categoria nem campos de produção e financeiro', () => {
    const projetado = projetar(bruto()) as Record<string, unknown>
    expect(projetado.categoria).toBeUndefined()
    expect(projetado.custo_de_producao).toBeUndefined()
    expect(projetado.elenco).toBeUndefined()
    expect(projetado.observacoes_financeiras).toBeUndefined()
  })
})

describe('formatosNovos', () => {
  const mapa = montarMapa([{ formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' }])

  it('lista formato ausente do cadastro, sem repetir', () => {
    const acoes = [
      projetar(bruto({ formatos: 'AÇÃO PLENA' })),
      projetar(bruto({ formatos: 'FORMATO NOVO' })),
      projetar(bruto({ formatos: 'formato novo' })),
    ]
    expect(formatosNovos(acoes, mapa)).toEqual(['FORMATO NOVO'])
  })

  it('não acusa vazio nem traço', () => {
    const acoes = [projetar(bruto({ formatos: '-' })), projetar(bruto({ formatos: '' }))]
    expect(formatosNovos(acoes, mapa)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./ingestao"`.

- [ ] **Step 3: Implementar `src/lib/dominio/ingestao.ts`**

```ts
import { normalizarFormato, type MapaDeFormatos } from './formatos'

// R4 — sentinela usado na origem para ação ainda sem data definida.
export const DATA_SEM_DEFINICAO = '2999-01-01'

export type RegistroBruto = Record<string, unknown>

export type AcaoImportada = {
  numero_da_entrega: string
  programa: string
  data_de_exibicao: string
  anunciante: string
  marca: string
  formato: string
  tipo_da_entrega: string
  status_aprovacao: string
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

export function converterData(entrada: string | null | undefined): string | null {
  const bruto = texto(entrada)
  const partes = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (partes === null) return null
  const [, dia, mes, ano] = partes
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return null
  // Rejeita datas que o construtor normaliza silenciosamente, como 31/02.
  if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() + 1 !== Number(mes)) return null
  return `${ano}-${mes}-${dia}`
}

/**
 * R3 — só o futuro interessa; R4 — a sentinela fica de fora, por decisão da
 * área, sem aviso na interface.
 */
export function deveImportar(bruto: RegistroBruto, hoje: string): boolean {
  const data = converterData(texto(bruto.data_de_exibicao))
  if (data === null) return false
  if (data === DATA_SEM_DEFINICAO) return false
  return data >= hoje
}

/**
 * R5 — grava o formato como veio; a categoria é resolvida na leitura, para que
 * reclassificar um formato ajuste todo o histórico sem reimportar nada.
 */
export function projetar(bruto: RegistroBruto): AcaoImportada {
  return {
    numero_da_entrega: texto(bruto.numero_da_entrega),
    programa: texto(bruto.programa),
    data_de_exibicao: converterData(texto(bruto.data_de_exibicao)) ?? '',
    anunciante: texto(bruto.anunciante),
    marca: texto(bruto.marca),
    formato: texto(bruto.formatos),
    tipo_da_entrega: texto(bruto.tipo_da_entrega),
    status_aprovacao: texto(bruto.status_aprovacao),
  }
}

/**
 * Sem este alerta, um formato criado na origem entraria mudo, seria tratado
 * como ação de conteúdo por R2 e distorceria a ocupação sem ninguém perceber.
 */
export function formatosNovos(acoes: AcaoImportada[], mapa: MapaDeFormatos): string[] {
  const novos = new Set<string>()
  for (const acao of acoes) {
    const chave = normalizarFormato(acao.formato)
    if (chave === '' || chave === '-') continue
    if (!mapa.has(chave)) novos.add(chave)
  }
  return [...novos].sort()
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 30 testes no total.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/ingestao.ts src/lib/dominio/ingestao.test.ts
git commit -m "feat: filtros de data e projecao de colunas da ingestao"
```

---

### Task 6: Domínio — validação do cadastro de programa

**Files:**
- Create: `src/lib/dominio/cadastro.ts`
- Test: `src/lib/dominio/cadastro.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type EstadoDoPrograma = 'ativo' | 'inativo' | 'em_configuracao'`
  - `type Programa` (todos os 19 campos do cadastro)
  - `validarPrograma(programa: Partial<Programa>): string[]`
  - `vaiAoArEm(programa: Pick<Programa, 'dias_da_semana'>, dataIso: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

Arquivo `src/lib/dominio/cadastro.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validarPrograma, vaiAoArEm, type Programa } from './cadastro'

function programa(sobrescritas: Partial<Programa> = {}): Partial<Programa> {
  return {
    nome: 'Mais Você',
    mnemonico: 'MAVO',
    canal: 'TV Globo',
    estado: 'ativo',
    dias_da_semana: [1, 2, 3, 4, 5],
    slots: 3,
    bloqueio_mensal: 20,
    acoes_minimas: 1,
    acoes_maximas: 3,
    prazo_minimo_dias: 15,
    disponivel_para_proposta: true,
    custo_midia: 100000,
    custo_producao: 50000,
    ...sobrescritas,
  }
}

describe('validarPrograma', () => {
  it('aceita cadastro completo', () => {
    expect(validarPrograma(programa())).toEqual([])
  })

  it('exige nome, mnemônico e canal', () => {
    const erros = validarPrograma(programa({ nome: '', mnemonico: '  ', canal: '' }))
    expect(erros).toContain('Informe o nome do programa.')
    expect(erros).toContain('Informe o mnemônico do programa.')
    expect(erros).toContain('Informe o canal onde o programa é exibido.')
  })

  // R7
  it('exige mínimo menor ou igual ao máximo', () => {
    expect(validarPrograma(programa({ acoes_minimas: 5, acoes_maximas: 3 })))
      .toContain('A quantidade mínima de ações não pode ser maior que a máxima.')
  })

  it('exige pelo menos um slot', () => {
    expect(validarPrograma(programa({ slots: 0 })))
      .toContain('O programa precisa ter pelo menos 1 slot por data.')
  })

  it('recusa prazo mínimo negativo', () => {
    expect(validarPrograma(programa({ prazo_minimo_dias: -1 })))
      .toContain('O prazo mínimo não pode ser negativo.')
  })

  it('exige ao menos um dia de exibição', () => {
    expect(validarPrograma(programa({ dias_da_semana: [] })))
      .toContain('Selecione ao menos um dia de exibição.')
  })

  it('recusa dia da semana fora de 0 a 6', () => {
    expect(validarPrograma(programa({ dias_da_semana: [1, 9] })))
      .toContain('Dia da semana inválido: use 0 (domingo) a 6 (sábado).')
  })

  // Custos são condicionais à elegibilidade para proposta
  it('exige custos quando o programa está disponível para proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: true, custo_midia: null, custo_producao: null }),
    )
    expect(erros).toContain('Informe o custo de mídia para programas disponíveis para proposta.')
    expect(erros).toContain('Informe o custo de produção para programas disponíveis para proposta.')
  })

  it('dispensa custos quando o programa não gera proposta', () => {
    const erros = validarPrograma(
      programa({ disponivel_para_proposta: false, custo_midia: null, custo_producao: null }),
    )
    expect(erros).toEqual([])
  })
})

describe('vaiAoArEm', () => {
  it('reconhece dia de exibição', () => {
    // 2026-08-17 é uma segunda-feira
    expect(vaiAoArEm({ dias_da_semana: [1, 2, 3, 4, 5] }, '2026-08-17')).toBe(true)
  })

  it('recusa dia sem exibição', () => {
    // 2026-08-16 é um domingo
    expect(vaiAoArEm({ dias_da_semana: [1, 2, 3, 4, 5] }, '2026-08-16')).toBe(false)
  })

  it('reconhece domingo como dia 0', () => {
    expect(vaiAoArEm({ dias_da_semana: [0] }, '2026-08-16')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./cadastro"`.

- [ ] **Step 3: Implementar `src/lib/dominio/cadastro.ts`**

```ts
export type EstadoDoPrograma = 'ativo' | 'inativo' | 'em_configuracao'

export type Programa = {
  id: string
  nome: string
  mnemonico: string
  imagem_url: string | null
  canal: string
  possui_fluxo_aprovacao: boolean
  contem_digital: boolean
  redes_sociais: boolean
  estado: EstadoDoPrograma
  dias_da_semana: number[]
  slots: number
  bloqueio_mensal: number
  acoes_minimas: number
  acoes_maximas: number
  custo_midia: number | null
  custo_producao: number | null
  prazo_minimo_dias: number
  percentual_simulcast: number | null
  custo_multishow: number | null
  disponivel_para_proposta: boolean
}

function vazio(valor: string | undefined | null): boolean {
  return valor === undefined || valor === null || valor.trim() === ''
}

// R7 — validações do cadastro.
export function validarPrograma(programa: Partial<Programa>): string[] {
  const erros: string[] = []

  if (vazio(programa.nome)) erros.push('Informe o nome do programa.')
  if (vazio(programa.mnemonico)) erros.push('Informe o mnemônico do programa.')
  if (vazio(programa.canal)) erros.push('Informe o canal onde o programa é exibido.')

  const dias = programa.dias_da_semana ?? []
  if (dias.length === 0) erros.push('Selecione ao menos um dia de exibição.')
  if (dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)) {
    erros.push('Dia da semana inválido: use 0 (domingo) a 6 (sábado).')
  }

  if ((programa.slots ?? 0) < 1) {
    erros.push('O programa precisa ter pelo menos 1 slot por data.')
  }
  if ((programa.acoes_minimas ?? 0) > (programa.acoes_maximas ?? 0)) {
    erros.push('A quantidade mínima de ações não pode ser maior que a máxima.')
  }
  if ((programa.prazo_minimo_dias ?? 0) < 0) {
    erros.push('O prazo mínimo não pode ser negativo.')
  }

  if (programa.disponivel_para_proposta === true) {
    if (programa.custo_midia === null || programa.custo_midia === undefined) {
      erros.push('Informe o custo de mídia para programas disponíveis para proposta.')
    }
    if (programa.custo_producao === null || programa.custo_producao === undefined) {
      erros.push('Informe o custo de produção para programas disponíveis para proposta.')
    }
  }

  return erros
}

export function vaiAoArEm(
  programa: Pick<Programa, 'dias_da_semana'>,
  dataIso: string,
): boolean {
  const dia = new Date(`${dataIso}T00:00:00Z`).getUTCDay()
  return programa.dias_da_semana.includes(dia)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 42 testes no total.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/cadastro.ts src/lib/dominio/cadastro.test.ts
git commit -m "feat: validacao do cadastro de programa"
```

---

### Task 7: Schema do banco e RLS

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Consumes: os campos definidos na Task 6 (`Programa`) e na Task 5 (`AcaoImportada`).
- Produces: tabelas `programas`, `programa_apelidos`, `formatos`, `clientes`, `acoes_vendidas`, `perfil_usuario`.

- [ ] **Step 1: Escrever `supabase/schema.sql`**

```sql
-- CHATBOT 2.0 — Entrega 1. Rode uma vez no SQL Editor do Supabase.

create table if not exists perfil_usuario (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cargo text,
  perfil text not null default 'executivo'
    check (perfil in ('executivo', 'admin_programa', 'admin_geral')),
  criado_em timestamptz not null default now()
);

create table if not exists programas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mnemonico text not null unique,
  imagem_url text,
  canal text not null,
  possui_fluxo_aprovacao boolean not null default false,
  contem_digital boolean not null default false,
  redes_sociais boolean not null default false,
  estado text not null default 'em_configuracao'
    check (estado in ('ativo', 'inativo', 'em_configuracao')),
  dias_da_semana smallint[] not null default '{}',
  slots integer not null check (slots >= 1),
  bloqueio_mensal integer not null default 0,
  acoes_minimas integer not null default 1,
  acoes_maximas integer not null default 1,
  custo_midia numeric(14, 2),
  custo_producao numeric(14, 2),
  prazo_minimo_dias integer not null default 0 check (prazo_minimo_dias >= 0),
  percentual_simulcast numeric(5, 2),
  custo_multishow numeric(14, 2),
  disponivel_para_proposta boolean not null default false,
  criado_em timestamptz not null default now(),
  check (acoes_minimas <= acoes_maximas)
);

-- Quatro dos 23 programas chegam da API sem mnemônico. Sem apelido, ficariam
-- invisíveis ao cálculo de ocupação.
create table if not exists programa_apelidos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  texto text not null unique
);

create table if not exists formatos (
  formato text primary key,
  categoria text not null check (categoria in (
    'AÇÃO DE CONTEÚDO', 'COMERCIAL', 'CONTEÚDO NO BREAK',
    'INSERT', 'VINHETA', 'CHAMADA'
  ))
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  setor text,
  industria text,
  executivo text,
  email text
);

create index if not exists clientes_nome_idx on clientes (nome);
create index if not exists clientes_cnpj_idx on clientes (cnpj);

-- Snapshot da API do Globo Take. Substituído por inteiro a cada importação:
-- uma venda cancelada some da origem e precisa sumir daqui também.
create table if not exists acoes_vendidas (
  numero_da_entrega text primary key,
  programa text not null,
  data_de_exibicao date not null,
  anunciante text,
  marca text,
  formato text,
  tipo_da_entrega text,
  status_aprovacao text,
  importado_em timestamptz not null default now()
);

create index if not exists acoes_programa_data_idx
  on acoes_vendidas (programa, data_de_exibicao);

alter table perfil_usuario enable row level security;
alter table programas enable row level security;
alter table programa_apelidos enable row level security;
alter table formatos enable row level security;
alter table clientes enable row level security;
alter table acoes_vendidas enable row level security;

create or replace function e_administrador()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfil_usuario
    where usuario_id = auth.uid()
      and perfil in ('admin_programa', 'admin_geral')
  );
$$;

drop policy if exists "perfil proprio" on perfil_usuario;
create policy "perfil proprio" on perfil_usuario
  for select to authenticated using (usuario_id = auth.uid());

drop policy if exists "leitura autenticada" on programas;
create policy "leitura autenticada" on programas
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programas;
create policy "escrita administrador" on programas
  for all to authenticated using (e_administrador()) with check (e_administrador());

drop policy if exists "leitura autenticada" on programa_apelidos;
create policy "leitura autenticada" on programa_apelidos
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programa_apelidos;
create policy "escrita administrador" on programa_apelidos
  for all to authenticated using (e_administrador()) with check (e_administrador());

drop policy if exists "leitura autenticada" on formatos;
create policy "leitura autenticada" on formatos
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on clientes;
create policy "leitura autenticada" on clientes
  for select to authenticated using (true);

drop policy if exists "leitura autenticada" on acoes_vendidas;
create policy "leitura autenticada" on acoes_vendidas
  for select to authenticated using (true);
```

- [ ] **Step 2: Rodar no Supabase**

No painel do Supabase: **SQL Editor > New query**, colar o arquivo inteiro, **Run**.
Esperado: `Success. No rows returned`.

- [ ] **Step 3: Conferir que o RLS está ativo**

No **Table Editor**, as seis tabelas devem aparecer com o cadeado de RLS.
`formatos`, `clientes` e `acoes_vendidas` não têm policy de escrita: são
alimentadas pelos scripts, que usam a chave `service_role` e ignoram RLS.

- [ ] **Step 4: Commitar**

```powershell
git add supabase/schema.sql
git commit -m "feat: schema do banco com RLS ativo nas seis tabelas"
```

---

### Task 8: Conexão com o Supabase, sessão e tela de login

**Files:**
- Create: `src/lib/supabase/variaveis.ts`, `src/lib/supabase/cliente-navegador.ts`, `src/lib/supabase/cliente-servidor.ts`, `src/lib/sessao-servidor.ts`, `src/lib/autenticacao.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/components/login/TelaLogin.tsx`, `src/components/login/PainelApresentacao.tsx`, `src/components/login/FormularioEntrada.tsx`

**Interfaces:**
- Consumes: tabela `perfil_usuario` da Task 7.
- Produces:
  - `criarClienteNavegador(): SupabaseClient`
  - `criarClienteServidor(): Promise<SupabaseClient>`
  - `obterSessao(): Promise<{ usuarioId: string; email: string; nome: string; perfil: string } | null>`
  - `entrar(email: string, senha: string): Promise<{ erro: string | null }>`
  - `sair(): Promise<void>`

- [ ] **Step 1: Ler a documentação do Next 16 sobre middleware e server components**

Antes de escrever, leia `node_modules/next/dist/docs/` — a API de `cookies()`, o formato do middleware e as convenções de server actions mudaram em relação a versões anteriores. Use `../Projetos Apps/cache-hub/src/lib/supabase/` e `../Projetos Apps/cache-hub/src/proxy.ts` como referência viva: esse projeto roda nesta mesma versão.

- [ ] **Step 2: Escrever `src/lib/supabase/variaveis.ts`**

```ts
export function lerVariaveis() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chave) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local. ' +
        'Copie o .env.local.example e preencha com as chaves do Supabase.',
    )
  }
  return { url, chave }
}
```

- [ ] **Step 3: Escrever os dois clientes e o `proxy.ts`**

Copie a estrutura de `../Projetos Apps/cache-hub/src/lib/supabase/cliente-navegador.ts`,
`cliente-servidor.ts` e `../Projetos Apps/cache-hub/src/proxy.ts`, trocando apenas
os nomes de tabela. O `proxy.ts` renova a sessão a cada requisição — sem ele, o
usuário é deslogado ao navegar entre páginas.

- [ ] **Step 4: Escrever `src/lib/sessao-servidor.ts`**

```ts
import { criarClienteServidor } from './supabase/cliente-servidor'

export type Sessao = {
  usuarioId: string
  email: string
  nome: string
  perfil: 'executivo' | 'admin_programa' | 'admin_geral'
}

export async function obterSessao(): Promise<Sessao | null> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.auth.getUser()
  const usuario = data.user
  if (!usuario) return null

  const { data: perfil } = await supabase
    .from('perfil_usuario')
    .select('nome, perfil')
    .eq('usuario_id', usuario.id)
    .maybeSingle()

  return {
    usuarioId: usuario.id,
    email: usuario.email ?? '',
    nome: perfil?.nome ?? usuario.email ?? '',
    perfil: (perfil?.perfil ?? 'executivo') as Sessao['perfil'],
  }
}

export function podeAdministrar(sessao: Sessao | null): boolean {
  return sessao?.perfil === 'admin_programa' || sessao?.perfil === 'admin_geral'
}
```

- [ ] **Step 5: Escrever a tela 1a**

`src/app/login/page.tsx` renderiza `<TelaLogin />`. A tela é o split 52/48 do
handoff:

- **Esquerda (52%)**: `background: var(--marca)`, três tiles de 120px com
  `var(--tile-a|b|c)`, `border-radius: 28px`, animação `floaty` (6 a 8s,
  `ease-in-out`, `translateY(0)` a `translateY(-14px)`), logo `chatbot 2.0` no
  topo, headline **"Posso vender? Quando? Quanto?"** em Space Grotesk 44px/800
  branco, e rodapé "Disponibilidade → Proposta → PDF".
- **Direita (48%)**: título "Entrar", campo **E-mail corporativo**, campo
  **Senha**, link "Esqueci minha senha" alinhado à direita, botão **Entrar** de
  52px com `var(--marca)` e `var(--sombra-botao)`. Campos com
  `border-radius: var(--raio-campo)`, placeholder `var(--placeholder)` e borda
  `#A031F5` no foco.

O botão "Entrar com SSO corporativo" **não** entra nesta entrega; deixe o espaço
reservado com um comentário no código apontando para esta decisão da spec.

Erros de login aparecem acima do botão, em `var(--concorrencia)`, com texto em
português: credencial inválida vira "E-mail ou senha incorretos."

- [ ] **Step 6: Verificar no navegador**

```powershell
npm run dev
```

Abra <http://localhost:3000>. Esperado: redireciona para `/login` e mostra a
tela conforme o handoff. Crie um usuário em **Authentication > Users > Add user**
(com "Auto Confirm User" marcado) e entre com ele — deve autenticar e redirecionar
para `/inicio` (que ainda dará 404; a rota nasce na Task 9).

- [ ] **Step 7: Commitar**

```powershell
git add src/lib/supabase src/lib/sessao-servidor.ts src/lib/autenticacao.ts src/proxy.ts src/app/login src/components/login
git commit -m "feat: autenticacao com Supabase e tela de login"
```

---

### Task 9: Shell do aplicativo

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/inicio/page.tsx`, `src/app/(app)/consulta/page.tsx`, `src/app/(app)/propostas/page.tsx`, `src/app/(app)/historico/page.tsx`, `src/app/(app)/configuracoes/page.tsx`, `src/components/layout/BarraLateral.tsx`, `src/components/layout/SecaoEmConstrucao.tsx`
- Modify: nenhum

**Interfaces:**
- Consumes: `obterSessao`, `podeAdministrar` da Task 8.
- Produces: `<SecaoEmConstrucao titulo={string} />` reutilizável.

- [ ] **Step 1: Escrever o layout com guarda de rota**

`src/app/(app)/layout.tsx` roda no servidor: chama `obterSessao()` e, se for
nulo, `redirect('/login')`. Renderiza `<BarraLateral />` e o conteúdo.

- [ ] **Step 2: Escrever a barra lateral conforme o handoff**

224px de largura, fundo branco, borda direita `var(--borda)`. Itens: Início,
Nova consulta, Propostas, Histórico, Configurações. Item ativo com pílula
`linear-gradient(135deg, rgba(255,45,85,.12), rgba(45,107,255,.12))`, texto
`var(--roxo)` e ponto com `var(--marca)`; inativos com ponto `#D6D1E0` e texto
`var(--texto-3)`. Rodapé com avatar circular, nome e perfil, vindos de
`obterSessao()`.

**Configurações só aparece para quem passa em `podeAdministrar`** — esconder é
conveniência; quem protege de verdade é o RLS da Task 7.

- [ ] **Step 3: Escrever `SecaoEmConstrucao`**

```tsx
export function SecaoEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <section
      style={{
        background: 'var(--superficie)',
        borderRadius: 'var(--raio-janela)',
        padding: '40px',
        border: '1px solid var(--borda)',
      }}
    >
      <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 26, fontWeight: 700 }}>
        {titulo}
      </h1>
      <p style={{ color: 'var(--texto-2)', marginTop: 8 }}>
        Esta seção ainda está em construção. Ela chega nas próximas entregas.
      </p>
    </section>
  )
}
```

Use-a em `inicio`, `consulta`, `propostas` e `historico`.

- [ ] **Step 4: Verificar no navegador**

```powershell
npm run dev
```

Esperado: após entrar, o app abre em `/inicio` com a sidebar. Clicar em cada
item navega e mostra o aviso de construção. Sair e tentar `/inicio` direto pela
URL deve redirecionar para `/login`.

- [ ] **Step 5: Commitar**

```powershell
git add "src/app/(app)" src/components/layout
git commit -m "feat: shell do aplicativo com barra lateral e guarda de rota"
```

---

### Task 10: Carga de formatos e clientes a partir das planilhas

**Files:**
- Create: `scripts/gerar-seed.mjs`, `supabase/seed.sql` (gerado)

**Interfaces:**
- Consumes: `dados/Formatos.xlsx`, `dados/Carteira.xlsx`; tabelas da Task 7.
- Produces: `supabase/seed.sql` com os 73 formatos e os clientes da carteira.

- [ ] **Step 1: Escrever `scripts/gerar-seed.mjs`**

```js
// Gera supabase/seed.sql a partir das planilhas em dados/.
// O seed.sql é ARQUIVO GERADO — não edite à mão; rode `npm run seed:gerar`.
import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

function lerPlanilha(caminho) {
  const livro = XLSX.read(readFileSync(caminho))
  const aba = livro.Sheets[livro.SheetNames[0]]
  return XLSX.utils.sheet_to_json(aba, { defval: '' })
}

function aspas(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 'null'
  return `'${String(valor).trim().replace(/'/g, "''")}'`
}

const formatos = lerPlanilha('dados/Formatos.xlsx')
  .filter((linha) => String(linha.FORMATO ?? '').trim() !== '')
  .map((linha) => `  (${aspas(linha.FORMATO)}, ${aspas(linha.CATEGORIA)})`)

const clientes = lerPlanilha('dados/Carteira.xlsx')
  .filter((linha) => String(linha['Nome da conta'] ?? '').trim() !== '')
  .map(
    (linha) =>
      `  (${aspas(linha['Nome da conta'])}, ${aspas(linha.CNPJ)}, ${aspas(linha.Setor)}, ` +
      `${aspas(linha['Indústria'])}, ${aspas(linha['Executivo de Vendas: Nome completo'])}, ` +
      `${aspas(linha['E-mail'])})`,
  )

const sql = `-- ARQUIVO GERADO por scripts/gerar-seed.mjs. Não edite à mão.
-- Pode rodar quantas vezes quiser: não duplica nada.

-- Parte 1: formatos e suas categorias (${formatos.length} linhas)
insert into formatos (formato, categoria) values
${formatos.join(',\n')}
on conflict (formato) do update set categoria = excluded.categoria;

-- Parte 2: carteira de clientes (${clientes.length} linhas)
truncate table clientes;
insert into clientes (nome, cnpj, setor, industria, executivo, email) values
${clientes.join(',\n')};
`

writeFileSync('supabase/seed.sql', sql, 'utf8')
console.log(`seed.sql gerado: ${formatos.length} formatos, ${clientes.length} clientes`)
```

- [ ] **Step 2: Rodar o gerador**

```powershell
npm run seed:gerar
```

Esperado: `seed.sql gerado: 73 formatos, 15519 clientes` (a contagem de clientes
pode variar conforme a planilha).

- [ ] **Step 3: Aplicar no Supabase**

**SQL Editor > New query**, colar `supabase/seed.sql`, **Run**.
Confira no Table Editor: `formatos` com 73 linhas, `clientes` preenchida.

- [ ] **Step 4: Verificar que a regra bate com a realidade**

No SQL Editor:

```sql
select categoria, count(*) from formatos group by categoria order by 2 desc;
```

Esperado: `AÇÃO DE CONTEÚDO` com 24 formatos — o mesmo número apurado na
classificação.

- [ ] **Step 5: Commitar**

```powershell
git add scripts/gerar-seed.mjs supabase/seed.sql
git commit -m "feat: carga de formatos e carteira a partir das planilhas"
```

---

### Task 11: Cadastro de programas

**Files:**
- Create: `src/lib/dados/programas.ts`, `src/lib/acoes/programas.ts`, `src/app/(app)/configuracoes/programas/page.tsx`, `src/app/(app)/configuracoes/programas/[id]/page.tsx`, `src/components/programas/ListaDeProgramas.tsx`, `src/components/programas/FormularioDePrograma.tsx`, `src/components/programas/EditorDeApelidos.tsx`

**Interfaces:**
- Consumes: `validarPrograma`, `type Programa` da Task 6; `criarClienteServidor` da Task 8.
- Produces:
  - `listarProgramas(): Promise<Programa[]>`
  - `obterPrograma(id: string): Promise<Programa | null>`
  - `salvarPrograma(dados: Partial<Programa>): Promise<{ erros: string[]; id: string | null }>`
  - `salvarApelidos(programaId: string, textos: string[]): Promise<{ erro: string | null }>`

- [ ] **Step 1: Escrever a leitura em `src/lib/dados/programas.ts`**

Consultas simples via `criarClienteServidor()`, ordenando por `nome`.

- [ ] **Step 2: Escrever a server action em `src/lib/acoes/programas.ts`**

A action **chama `validarPrograma` antes de tocar no banco** e devolve a lista de
erros sem gravar quando houver qualquer um. A validação no cliente é
conveniência; esta é a que vale.

- [ ] **Step 3: Escrever a lista de programas**

Tabela com nome, mnemônico, canal, estado, slots e prazo mínimo. Botão
"Novo programa" com `var(--marca)`. Estado vazio: "Nenhum programa cadastrado
ainda."

- [ ] **Step 4: Escrever o formulário com os 19 campos**

Agrupados em quatro blocos, para não virar um paredão:

1. **Identificação** — imagem, nome, mnemônico, canal, estado
2. **Exibição** — dias da semana (sete caixas de seleção), slots, prazo mínimo
3. **Regras de proposta** — bloqueio mensal, ações mínimas, ações máximas,
   disponível para proposta
4. **Custos** — custo de mídia, custo de produção, % simulcast, custo Multishow
5. **Marcadores** — possui fluxo de aprovação, contém digital, redes sociais

Os erros devolvidos por `validarPrograma` aparecem no topo do formulário, em
`var(--concorrencia)`.

- [ ] **Step 5: Escrever o editor de apelidos**

Campo de texto livre com lista dos apelidos já cadastrados e botão de remover.
Inclua um texto de ajuda: "Use apelidos quando o nome do programa chegar da API
sem o mnemônico — por exemplo, VIVER SERTANEJO."

- [ ] **Step 6: Verificar no navegador**

```powershell
npm run dev
```

Cadastre o programa **Mais Você**: mnemônico `MAVO`, canal TV Globo, dias de
segunda a sexta, 3 slots, prazo mínimo 15, mínimo 1, máximo 3, disponível para
proposta com custos preenchidos. Esperado: salva e reaparece na lista. Depois
tente salvar com mínimo 5 e máximo 3: esperado a mensagem "A quantidade mínima
de ações não pode ser maior que a máxima." e nada gravado.

- [ ] **Step 7: Commitar**

```powershell
git add src/lib/dados/programas.ts src/lib/acoes/programas.ts "src/app/(app)/configuracoes" src/components/programas
git commit -m "feat: cadastro de programas com validacao no servidor"
```

---

### Task 12: Importador e painel de importação

**Files:**
- Create: `scripts/importar.mjs`, `src/lib/dados/importacao.ts`, `src/app/(app)/configuracoes/importacao/page.tsx`, `src/components/importacao/PainelDeImportacao.tsx`

**Interfaces:**
- Consumes: `deveImportar`, `projetar`, `formatosNovos` da Task 5; `montarMapa` da Task 2.
- Produces:
  - `resumoDaImportacao(): Promise<{ importadoEm: string | null; total: number; porPrograma: { programa: string; acoes: number }[]; formatosNovos: string[] }>`

- [ ] **Step 1: Escrever `scripts/importar.mjs`**

```js
// Busca a API do Globo Take e substitui o snapshot em acoes_vendidas.
// Roda na máquina do administrador, onde o SSO corporativo funciona.
// Uso: npm run importar
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { deveImportar, projetar, formatosNovos } from '../src/lib/dominio/ingestao.ts'
import { montarMapa } from '../src/lib/dominio/formatos.ts'

const API = 'https://globotake.g.globo/api/v1/programsActionsPowerBi'

function lerEnv() {
  const texto = readFileSync('.env.local', 'utf8')
  const env = {}
  for (const linha of texto.split('\n')) {
    const par = linha.match(/^([A-Z_]+)=(.*)$/)
    if (par) env[par[1]] = par[2].trim()
  }
  return env
}

const env = lerEnv()
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const resposta = await fetch(API)
const corpo = await resposta.text()

// A API responde HTTP 200 com a página de login quando não há sessão de SSO.
if (corpo.trimStart().startsWith('<')) {
  console.error(
    'A API devolveu HTML em vez de JSON: você não está autenticado no SSO corporativo.\n' +
      'Abra ' + API + ' no navegador, faça login, e rode este comando de novo.',
  )
  process.exit(1)
}

const brutos = JSON.parse(corpo)
const registros = Array.isArray(brutos) ? brutos : (brutos.data ?? brutos.results ?? [])
const hoje = new Date().toISOString().slice(0, 10)

const aceitos = registros.filter((registro) => deveImportar(registro, hoje)).map(projetar)

const { data: formatosCadastrados } = await supabase.from('formatos').select('formato, categoria')
const mapa = montarMapa(formatosCadastrados ?? [])
const novos = formatosNovos(aceitos, mapa)

const { error: erroApagar } = await supabase
  .from('acoes_vendidas')
  .delete()
  .neq('numero_da_entrega', '')
if (erroApagar) throw erroApagar

// Lotes de 500 para não estourar o limite de tamanho da requisição.
for (let i = 0; i < aceitos.length; i += 500) {
  const { error } = await supabase.from('acoes_vendidas').upsert(aceitos.slice(i, i + 500))
  if (error) throw error
}

console.log(`recebidos: ${registros.length}`)
console.log(`importados: ${aceitos.length}`)
console.log(`descartados (passado ou sem data): ${registros.length - aceitos.length}`)
if (novos.length > 0) {
  console.log('\nFORMATOS NOVOS, ainda sem categoria cadastrada:')
  for (const formato of novos) console.log(`  - ${formato}`)
  console.log('Enquanto não forem classificados, contam como AÇÃO DE CONTEÚDO.')
}
```

O script importa as regras de `src/lib/dominio/*.ts` de propósito: duplicar a
lógica de filtro no importador seria a forma mais fácil de o script e o
aplicativo divergirem. Node 22 lê TypeScript com uma flag, então o script
`importar` no `package.json` fica:

```json
"importar": "node --experimental-strip-types scripts/importar.mjs"
```

- [ ] **Step 2: Rodar a importação**

```powershell
npm run importar
```

Esperado, estando autenticado no SSO: as três contagens e, se houver, a lista de
formatos novos. Não estando autenticado: a mensagem explicando o login, e saída
com erro — sem apagar nada do banco.

- [ ] **Step 3: Escrever `src/lib/dados/importacao.ts`**

Consulta o `max(importado_em)`, o total de linhas, a contagem por programa, e
compara os formatos distintos de `acoes_vendidas` com a tabela `formatos` para
listar os que faltam classificar.

- [ ] **Step 4: Escrever o painel**

Mostra, em destaque, **quando foi a última importação** — um snapshot velho não
pode ser confundido com disponibilidade atual. Abaixo: total de ações, tabela por
programa, e a lista de formatos novos com o aviso de que contam como ação de
conteúdo até serem classificados. Se nunca houve importação: "Nenhuma importação
realizada. Rode `npm run importar` no computador do administrador."

- [ ] **Step 5: Verificar no navegador**

Acesse **Configurações > Importação**. Esperado: data da última importação e as
contagens conferindo com o que o script imprimiu.

- [ ] **Step 6: Rodar a verificação completa**

```powershell
npm test
npm run build
```

Esperado: todos os testes passam e o build completa sem erro.

- [ ] **Step 7: Commitar**

```powershell
git add scripts/importar.mjs src/lib/dados/importacao.ts "src/app/(app)/configuracoes/importacao" src/components/importacao
git commit -m "feat: importador da API e painel de acompanhamento"
```

---

## Verificação final da entrega

Rode na ordem e confira cada resultado:

1. `npm test` — todos passam (42 testes de domínio).
2. `npm run build` — completa sem erro.
3. `npm run dev` e <http://localhost:3000> — redireciona para `/login`.
4. Entrar com e-mail e senha reais leva a `/inicio` com a sidebar.
5. Sair e acessar `/inicio` pela URL redireciona para `/login`.
6. Cadastrar um programa com os 19 campos, e vê-lo reaparecer na lista.
7. Salvar com mínimo maior que máximo é recusado com mensagem em português.
8. `npm run importar` carrega as ações e relata importados e descartados.
9. **Configurações > Importação** mostra a data do snapshot e as contagens.
10. `git status` não lista nada dentro de `dados/`.

## Fora do escopo desta entrega

Wizard de disponibilidade, calendário, proposta, PDF, SSO corporativo no login,
reserva de inventário e mobile. Ficam para as Entregas 2 e 3.
