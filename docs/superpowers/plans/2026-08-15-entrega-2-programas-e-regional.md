# CHATBOT 2.0 — Entrega 2: Área do programa, perfis e regional — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir tudo que o calendário de disponibilidade precisa consultar antes de existir: perfis acumuláveis, a área do programa, datas bloqueadas, restrições de anunciante e a disponibilidade regional por praça.

**Architecture:** Mesma separação da Entrega 1 — regras puras em `src/lib/dominio` com Vitest, leitura em `src/lib/dados`, escrita em `src/lib/acoes`, telas em `src/app/(app)`. A novidade estrutural é que a disponibilidade regional é indexada por `(programa, data, praça)`, com uma linha por praça vendida, tornando "esta praça está livre nesta data?" uma consulta direta.

**Tech Stack:** Next.js 16.3.0 · React 19.2.8 · TypeScript 5 · Tailwind CSS v4 · Supabase (Postgres + Auth) · Vitest 4 · Node 22

**Spec:** `docs/superpowers/specs/2026-08-15-entrega-2-programas-e-regional-design.md`
**Regras de negócio da área:** `docs/regras-acoes-regionais.md`

## Global Constraints

- **Supabase real e acessível.** `.env.local` preenchido; 73 formatos, 15.519 clientes, 246 ações vendidas e o programa MAVO já no banco. **Verifique cada tarefa contra o banco de verdade**, não só com build e teste.
- **Todo texto visível e todo identificador em português**, com acentuação correta. Nunca trocar caractere acentuado por ASCII.
- **As 5 praças, com estes códigos exatos:** `SP`, `RJ`, `BH`, `DF`, `PE1`.
- **As seis categorias de formato, exatas:** `AÇÃO DE CONTEÚDO`, `COMERCIAL`, `CONTEÚDO NO BREAK`, `INSERT`, `VINHETA`, `CHAMADA`.
- **Os quatro perfis:** `executivo`, `executivo_regional`, `consultor_programa`, `proprietario` — **acumuláveis**, uma linha por par usuário/perfil.
- **Regras do Encontro:** 1 slot por semana às **sextas** (dia 5), prazo mínimo **7 dias**, bloqueio mensal 4 ações, direitos e conexos R$ 20.000,00, produção R$ 7.797,00. Preços: SP 49.000, RJ 25.000, BH 9.000, DF 6.000, PE1 7.000.
- **Regras do É de Casa:** 1 slot por semana aos **sábados** (dia 6), prazo mínimo **10 dias**, bloqueio mensal 4 ações, direitos e conexos R$ 23.000,00, produção R$ 7.910,00. Preços: SP 53.000, RJ 31.000, BH 13.000, DF 10.000, PE1 11.000.
- **Máximo de 3 praças por ação** de um mesmo cliente; cada praça consome o slot dela.
- **Dias da semana:** 0 = domingo … 6 = sábado, convenção de `Date.getUTCDay()`.
- **Next.js 16 tem mudanças incompatíveis com o que modelos aprenderam.** Consulte `node_modules/next/dist/docs/` antes de escrever rota, layout ou server action.
- **Nada de segredo no código.** `SUPABASE_SERVICE_ROLE_KEY` só em scripts de linha de comando.
- **Nada dentro de `dados/` vai para o git.**
- **Princípios de UX da spec valem para toda tarefa de tela** — releia a seção "Experiência do usuário" da spec antes de qualquer componente.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/schema-entrega-2.sql` | Migração: tabelas novas, colunas novas, RLS |
| `src/lib/dominio/perfis.ts` | Perfis acumuláveis e o que cada um pode |
| `src/lib/dominio/regional.ts` | Slot por praça, teto de praças, dia da semana, prazo |
| `src/lib/dominio/bloqueios.ts` | Datas bloqueadas e prazo mínimo |
| `src/lib/dominio/restricoes.ts` | Restrição cadastrada e concorrência por data |
| `src/lib/dominio/pracas-no-texto.ts` | Extrai praças da `descritivo_da_acao` (sugestão) |
| `src/lib/dados/*.ts` | Leitura das tabelas novas |
| `src/lib/acoes/*.ts` | Escrita (server actions) |
| `src/components/comum/*.tsx` | Peças de UX reutilizáveis |
| `src/components/programas/*.tsx` | Cartões e área do programa |
| `src/app/(app)/configuracoes/programas/[id]/*` | As abas |

---

### Task 1: Migração do banco

**Files:**
- Create: `supabase/schema-entrega-2.sql`
- Modify: `README.md`

**Interfaces:**
- Produces: tabelas `usuario`, `consultor_programa`, `pracas`, `preco_regional`, `datas_bloqueadas`, `restricoes_anunciante`, `acoes_regionais`; `perfil_usuario` com chave composta; colunas novas em `programas`.

- [ ] **Step 1: Escrever `supabase/schema-entrega-2.sql`**

```sql
-- CHATBOT 2.0 — Entrega 2. Rode uma vez no SQL Editor, depois do schema.sql.
-- Pode rodar de novo sem duplicar nada.

-- ---------------------------------------------------------------------------
-- Perfis passam a ser acumuláveis: uma linha por par usuário/perfil.
-- Nome e cargo saem para `usuario`, para não se repetirem a cada perfil.
-- ---------------------------------------------------------------------------
create table if not exists usuario (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  cargo text,
  criado_em timestamptz not null default now()
);

insert into usuario (usuario_id, nome, cargo)
select usuario_id, nome, cargo from perfil_usuario
on conflict (usuario_id) do nothing;

alter table perfil_usuario drop constraint if exists perfil_usuario_pkey;
alter table perfil_usuario drop column if exists nome;
alter table perfil_usuario drop column if exists cargo;
alter table perfil_usuario
  drop constraint if exists perfil_usuario_perfil_check;
alter table perfil_usuario add constraint perfil_usuario_perfil_check
  check (perfil in ('executivo', 'executivo_regional', 'consultor_programa', 'proprietario'));

-- Perfis antigos viram os novos equivalentes.
update perfil_usuario set perfil = 'consultor_programa' where perfil = 'admin_programa';
update perfil_usuario set perfil = 'proprietario' where perfil = 'admin_geral';

alter table perfil_usuario
  add constraint perfil_usuario_pkey primary key (usuario_id, perfil);

-- ---------------------------------------------------------------------------
-- Consultor responde por programas específicos, não por todos.
-- ---------------------------------------------------------------------------
create table if not exists consultor_programa (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  programa_id uuid not null references programas (id) on delete cascade,
  primary key (usuario_id, programa_id)
);

-- ---------------------------------------------------------------------------
-- Regional
-- ---------------------------------------------------------------------------
alter table programas add column if not exists aceita_regional boolean not null default false;
alter table programas add column if not exists dia_da_semana_regional smallint;
alter table programas add column if not exists prazo_minimo_regional_dias integer;
alter table programas add column if not exists max_pracas_por_acao integer not null default 3;
alter table programas add column if not exists direitos_e_conexos numeric(14, 2);
alter table programas add column if not exists custo_producao_regional numeric(14, 2);
alter table programas add column if not exists atualizado_em timestamptz not null default now();

alter table programas drop constraint if exists programas_dia_regional_check;
alter table programas add constraint programas_dia_regional_check
  check (dia_da_semana_regional is null or (dia_da_semana_regional between 0 and 6));

create table if not exists pracas (
  codigo text primary key,
  nome text not null,
  ordem smallint not null
);

insert into pracas (codigo, nome, ordem) values
  ('SP', 'São Paulo', 1),
  ('RJ', 'Rio de Janeiro', 2),
  ('BH', 'Belo Horizonte', 3),
  ('DF', 'Brasília', 4),
  ('PE1', 'Recife', 5)
on conflict (codigo) do update set nome = excluded.nome, ordem = excluded.ordem;

create table if not exists preco_regional (
  programa_id uuid not null references programas (id) on delete cascade,
  praca_codigo text not null references pracas (codigo),
  valor numeric(14, 2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (programa_id, praca_codigo)
);

-- Uma linha por praça vendida: "SP está livre nesta sexta?" vira consulta direta.
create table if not exists acoes_regionais (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  data_de_exibicao date not null,
  cliente_id uuid references clientes (id),
  cliente_nome text not null,
  praca_codigo text not null references pracas (codigo),
  origem text not null default 'manual' check (origem in ('manual', 'sugerido_api')),
  numero_da_entrega text,
  criado_em timestamptz not null default now(),
  unique (programa_id, data_de_exibicao, praca_codigo)
);

create index if not exists acoes_regionais_data_idx
  on acoes_regionais (programa_id, data_de_exibicao);

-- ---------------------------------------------------------------------------
-- Bloqueios e restrições
-- ---------------------------------------------------------------------------
create table if not exists datas_bloqueadas (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  data date not null,
  motivo text not null,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  unique (programa_id, data)
);

create table if not exists restricoes_anunciante (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references programas (id) on delete cascade,
  anunciante text,
  setor text,
  industria text,
  motivo text not null,
  criado_em timestamptz not null default now(),
  check (anunciante is not null or setor is not null or industria is not null)
);

create index if not exists restricoes_programa_idx on restricoes_anunciante (programa_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table usuario enable row level security;
alter table consultor_programa enable row level security;
alter table pracas enable row level security;
alter table preco_regional enable row level security;
alter table acoes_regionais enable row level security;
alter table datas_bloqueadas enable row level security;
alter table restricoes_anunciante enable row level security;

create or replace function tem_perfil(nome_do_perfil text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from perfil_usuario
    where usuario_id = auth.uid() and perfil = nome_do_perfil
  );
$$;

create or replace function e_proprietario()
returns boolean language sql security definer set search_path = public as $$
  select tem_perfil('proprietario');
$$;

-- Consultor só escreve no programa ao qual está vinculado. Proprietário, em todos.
create or replace function e_consultor_de(id_do_programa uuid)
returns boolean language sql security definer set search_path = public as $$
  select e_proprietario() or exists (
    select 1 from consultor_programa
    where usuario_id = auth.uid() and programa_id = id_do_programa
  );
$$;

-- `e_administrador` continua existindo para não quebrar a Entrega 1.
create or replace function e_administrador()
returns boolean language sql security definer set search_path = public as $$
  select tem_perfil('proprietario') or tem_perfil('consultor_programa');
$$;

drop policy if exists "usuario proprio" on usuario;
create policy "usuario proprio" on usuario
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "vinculo proprio" on consultor_programa;
create policy "vinculo proprio" on consultor_programa
  for select to authenticated using (usuario_id = auth.uid() or e_proprietario());

drop policy if exists "vinculo escrita proprietario" on consultor_programa;
create policy "vinculo escrita proprietario" on consultor_programa
  for all to authenticated using (e_proprietario()) with check (e_proprietario());

drop policy if exists "leitura autenticada" on pracas;
create policy "leitura autenticada" on pracas
  for select to authenticated using (true);

drop policy if exists "escrita administrador" on programas;
create policy "escrita administrador" on programas
  for update to authenticated using (e_consultor_de(id)) with check (e_consultor_de(id));

drop policy if exists "insercao administrador" on programas;
create policy "insercao administrador" on programas
  for insert to authenticated with check (e_administrador());

drop policy if exists "remocao proprietario" on programas;
create policy "remocao proprietario" on programas
  for delete to authenticated using (e_proprietario());
```

Para as quatro tabelas dependentes de programa (`preco_regional`,
`acoes_regionais`, `datas_bloqueadas`, `restricoes_anunciante`), acrescente ao
final do arquivo, uma vez para cada:

```sql
drop policy if exists "leitura autenticada" on NOME_DA_TABELA;
create policy "leitura autenticada" on NOME_DA_TABELA
  for select to authenticated using (true);

drop policy if exists "escrita consultor" on NOME_DA_TABELA;
create policy "escrita consultor" on NOME_DA_TABELA
  for all to authenticated using (e_consultor_de(programa_id)) with check (e_consultor_de(programa_id));
```

Escreva as quatro expandidas, com o nome real da tabela — não deixe o
`NOME_DA_TABELA` no arquivo.

- [ ] **Step 2: Aplicar no Supabase e conferir**

Rode o arquivo no **SQL Editor**. Depois confirme com um script de verificação
que as 7 tabelas novas existem e que `perfil_usuario` aceita duas linhas para o
mesmo usuário. Cole a saída no relatório.

- [ ] **Step 3: Documentar no README**

Acrescente `schema-entrega-2.sql` à ordem de instalação, depois do `schema.sql`.

- [ ] **Step 4: Commitar**

```powershell
git add supabase/schema-entrega-2.sql README.md
git commit -m "feat: migracao da Entrega 2 com perfis acumulaveis e tabelas regionais"
```

---

### Task 2: Domínio — perfis acumuláveis

**Files:**
- Create: `src/lib/dominio/perfis.ts`, `src/lib/dominio/perfis.test.ts`

**Interfaces:**
- Produces:
  - `type Perfil = 'executivo' | 'executivo_regional' | 'consultor_programa' | 'proprietario'`
  - `temPerfil(perfis: Perfil[], procurado: Perfil): boolean`
  - `podeAdministrarProgramas(perfis: Perfil[]): boolean`
  - `podeExcluirPrograma(perfis: Perfil[]): boolean`
  - `podeConsultarRegional(perfis: Perfil[]): boolean`
  - `podeEditarPrograma(perfis: Perfil[], programasVinculados: string[], programaId: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import {
  temPerfil,
  podeAdministrarProgramas,
  podeExcluirPrograma,
  podeConsultarRegional,
  podeEditarPrograma,
} from './perfis'

describe('temPerfil', () => {
  it('encontra o perfil na lista', () => {
    expect(temPerfil(['executivo', 'executivo_regional'], 'executivo_regional')).toBe(true)
  })

  it('devolve falso quando não está na lista', () => {
    expect(temPerfil(['executivo'], 'proprietario')).toBe(false)
    expect(temPerfil([], 'executivo')).toBe(false)
  })
})

describe('podeConsultarRegional', () => {
  // Perfis se acumulam: quem vende nacional e regional tem os dois
  it('exige o perfil regional', () => {
    expect(podeConsultarRegional(['executivo', 'executivo_regional'])).toBe(true)
    expect(podeConsultarRegional(['executivo'])).toBe(false)
  })

  it('proprietário enxerga tudo', () => {
    expect(podeConsultarRegional(['proprietario'])).toBe(true)
  })
})

describe('podeAdministrarProgramas', () => {
  it('vale para consultor e proprietário', () => {
    expect(podeAdministrarProgramas(['consultor_programa'])).toBe(true)
    expect(podeAdministrarProgramas(['proprietario'])).toBe(true)
  })

  it('não vale para executivo', () => {
    expect(podeAdministrarProgramas(['executivo', 'executivo_regional'])).toBe(false)
  })
})

describe('podeExcluirPrograma', () => {
  // Só o proprietário apaga: excluir leva junto datas, restrições e preços
  it('só o proprietário', () => {
    expect(podeExcluirPrograma(['proprietario'])).toBe(true)
    expect(podeExcluirPrograma(['consultor_programa'])).toBe(false)
  })
})

describe('podeEditarPrograma', () => {
  it('consultor edita só o programa a que está vinculado', () => {
    expect(podeEditarPrograma(['consultor_programa'], ['p-1'], 'p-1')).toBe(true)
    expect(podeEditarPrograma(['consultor_programa'], ['p-1'], 'p-2')).toBe(false)
  })

  it('proprietário edita qualquer um, mesmo sem vínculo', () => {
    expect(podeEditarPrograma(['proprietario'], [], 'p-9')).toBe(true)
  })

  it('executivo não edita nada', () => {
    expect(podeEditarPrograma(['executivo'], ['p-1'], 'p-1')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./perfis"`.

- [ ] **Step 3: Implementar**

```ts
export type Perfil =
  | 'executivo'
  | 'executivo_regional'
  | 'consultor_programa'
  | 'proprietario'

export function temPerfil(perfis: Perfil[], procurado: Perfil): boolean {
  return perfis.includes(procurado)
}

export function podeAdministrarProgramas(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'consultor_programa') || temPerfil(perfis, 'proprietario')
}

// Excluir programa leva junto datas bloqueadas, restrições, preços e ações
// regionais. É a única ação irreversível da entrega.
export function podeExcluirPrograma(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'proprietario')
}

export function podeConsultarRegional(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'executivo_regional') || temPerfil(perfis, 'proprietario')
}

/** Consultor edita só os programas a que está vinculado; proprietário, todos. */
export function podeEditarPrograma(
  perfis: Perfil[],
  programasVinculados: string[],
  programaId: string,
): boolean {
  if (temPerfil(perfis, 'proprietario')) return true
  if (!temPerfil(perfis, 'consultor_programa')) return false
  return programasVinculados.includes(programaId)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 63 anteriores + 10 novos = 73.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/perfis.ts src/lib/dominio/perfis.test.ts
git commit -m "feat: perfis acumulaveis e permissoes por programa"
```

---

### Task 3: Domínio — disponibilidade regional

**Files:**
- Create: `src/lib/dominio/regional.ts`, `src/lib/dominio/regional.test.ts`

**Interfaces:**
- Produces:
  - `const PRACAS: readonly string[]` — `['SP','RJ','BH','DF','PE1']`
  - `type AcaoRegional = { data_de_exibicao: string; praca_codigo: string; cliente_nome: string }`
  - `type ConfiguracaoRegional = { aceita_regional: boolean; dia_da_semana_regional: number | null; max_pracas_por_acao: number }`
  - `temSlotRegionalEm(config: ConfiguracaoRegional, dataIso: string): boolean`
  - `pracasOcupadasEm(acoes: AcaoRegional[], dataIso: string): string[]`
  - `pracasLivresEm(config: ConfiguracaoRegional, acoes: AcaoRegional[], dataIso: string): string[]`
  - `validarCompra(config: ConfiguracaoRegional, acoes: AcaoRegional[], dataIso: string, pracasDesejadas: string[]): string[]`

- [ ] **Step 1: Escrever o teste que falha**

Os números vêm das regras reais: Encontro às sextas, máximo 3 praças por ação.

```ts
import { describe, it, expect } from 'vitest'
import {
  PRACAS,
  temSlotRegionalEm,
  pracasOcupadasEm,
  pracasLivresEm,
  validarCompra,
} from './regional'

// Encontro: 1 slot por semana, sextas-feiras (dia 5)
const encontro = { aceita_regional: true, dia_da_semana_regional: 5, max_pracas_por_acao: 3 }
const semRegional = { aceita_regional: false, dia_da_semana_regional: null, max_pracas_por_acao: 3 }

// 2026-08-21 é uma sexta-feira; 2026-08-20 é quinta
const SEXTA = '2026-08-21'
const QUINTA = '2026-08-20'

const vendidas = [
  { data_de_exibicao: SEXTA, praca_codigo: 'SP', cliente_nome: 'Cliente A' },
  { data_de_exibicao: SEXTA, praca_codigo: 'RJ', cliente_nome: 'Cliente A' },
  { data_de_exibicao: SEXTA, praca_codigo: 'BH', cliente_nome: 'Cliente A' },
]

describe('PRACAS', () => {
  it('são as cinco Globos, nesta ordem', () => {
    expect([...PRACAS]).toEqual(['SP', 'RJ', 'BH', 'DF', 'PE1'])
  })
})

describe('temSlotRegionalEm', () => {
  // R10: o slot só existe no dia da semana do programa
  it('existe na sexta do Encontro', () => {
    expect(temSlotRegionalEm(encontro, SEXTA)).toBe(true)
  })

  it('não existe na quinta', () => {
    expect(temSlotRegionalEm(encontro, QUINTA)).toBe(false)
  })

  it('não existe em programa que não vende regional', () => {
    expect(temSlotRegionalEm(semRegional, SEXTA)).toBe(false)
  })
})

describe('pracasLivresEm', () => {
  // R8: cada praça tem seu próprio slot
  it('vendidas SP, RJ e BH, sobram DF e PE1', () => {
    expect(pracasLivresEm(encontro, vendidas, SEXTA)).toEqual(['DF', 'PE1'])
  })

  it('sem venda nenhuma, as cinco estão livres', () => {
    expect(pracasLivresEm(encontro, [], SEXTA)).toEqual(['SP', 'RJ', 'BH', 'DF', 'PE1'])
  })

  it('em dia sem slot, nenhuma praça está livre', () => {
    expect(pracasLivresEm(encontro, [], QUINTA)).toEqual([])
  })
})

describe('pracasOcupadasEm', () => {
  it('lista as praças já vendidas na data', () => {
    expect(pracasOcupadasEm(vendidas, SEXTA)).toEqual(['SP', 'RJ', 'BH'])
  })

  it('ignora outras datas', () => {
    expect(pracasOcupadasEm(vendidas, '2026-08-28')).toEqual([])
  })
})

describe('validarCompra', () => {
  it('aceita compra de praças livres dentro do teto', () => {
    expect(validarCompra(encontro, vendidas, SEXTA, ['DF', 'PE1'])).toEqual([])
  })

  // R9: máximo de praças por ação de um mesmo cliente
  it('recusa mais praças que o permitido por ação', () => {
    expect(validarCompra(encontro, [], SEXTA, ['SP', 'RJ', 'BH', 'DF']))
      .toContain('Uma ação pode ter no máximo 3 praças.')
  })

  it('recusa praça já vendida', () => {
    expect(validarCompra(encontro, vendidas, SEXTA, ['SP']))
      .toContain('A praça SP já está vendida nesta data.')
  })

  it('recusa data sem slot regional', () => {
    expect(validarCompra(encontro, [], QUINTA, ['SP']))
      .toContain('Este programa não tem ação regional nesta data.')
  })

  it('recusa praça inexistente', () => {
    expect(validarCompra(encontro, [], SEXTA, ['XX']))
      .toContain('Praça desconhecida: XX.')
  })

  it('recusa compra sem praça nenhuma', () => {
    expect(validarCompra(encontro, [], SEXTA, []))
      .toContain('Selecione ao menos uma praça.')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./regional"`.

- [ ] **Step 3: Implementar**

```ts
/** As 5 Globos, na ordem em que aparecem na interface. */
export const PRACAS = ['SP', 'RJ', 'BH', 'DF', 'PE1'] as const

export type AcaoRegional = {
  data_de_exibicao: string
  praca_codigo: string
  cliente_nome: string
}

export type ConfiguracaoRegional = {
  aceita_regional: boolean
  dia_da_semana_regional: number | null
  max_pracas_por_acao: number
}

function diaDaSemana(dataIso: string): number {
  return new Date(`${dataIso}T00:00:00Z`).getUTCDay()
}

/**
 * R10 — o slot regional só existe no dia da semana do programa: sextas no
 * Encontro, sábados no É de Casa. Fora dele não há "esgotado", simplesmente
 * não existe ação regional.
 */
export function temSlotRegionalEm(config: ConfiguracaoRegional, dataIso: string): boolean {
  if (!config.aceita_regional) return false
  if (config.dia_da_semana_regional === null) return false
  return diaDaSemana(dataIso) === config.dia_da_semana_regional
}

export function pracasOcupadasEm(acoes: AcaoRegional[], dataIso: string): string[] {
  return acoes.filter((a) => a.data_de_exibicao === dataIso).map((a) => a.praca_codigo)
}

/** R8 — cada praça tem seu próprio slot na data. */
export function pracasLivresEm(
  config: ConfiguracaoRegional,
  acoes: AcaoRegional[],
  dataIso: string,
): string[] {
  if (!temSlotRegionalEm(config, dataIso)) return []
  const ocupadas = new Set(pracasOcupadasEm(acoes, dataIso))
  return PRACAS.filter((praca) => !ocupadas.has(praca))
}

/** R9 — um cliente compra até `max_pracas_por_acao` praças, consumindo o slot de cada. */
export function validarCompra(
  config: ConfiguracaoRegional,
  acoes: AcaoRegional[],
  dataIso: string,
  pracasDesejadas: string[],
): string[] {
  const erros: string[] = []

  if (pracasDesejadas.length === 0) {
    erros.push('Selecione ao menos uma praça.')
  }
  if (!temSlotRegionalEm(config, dataIso)) {
    erros.push('Este programa não tem ação regional nesta data.')
  }
  if (pracasDesejadas.length > config.max_pracas_por_acao) {
    erros.push(`Uma ação pode ter no máximo ${config.max_pracas_por_acao} praças.`)
  }

  const ocupadas = new Set(pracasOcupadasEm(acoes, dataIso))
  for (const praca of pracasDesejadas) {
    if (!PRACAS.includes(praca as (typeof PRACAS)[number])) {
      erros.push(`Praça desconhecida: ${praca}.`)
    } else if (ocupadas.has(praca)) {
      erros.push(`A praça ${praca} já está vendida nesta data.`)
    }
  }

  return erros
}
```

- [ ] **Step 4: Acrescentar a regra provisória R15**

A área ainda não confirmou se a ação regional consome também um slot do
inventário nacional. A spec decidiu seguir pelo caminho conservador — assumir
que **sim** —, e exige que a decisão viva num único ponto, para inverter sem
caçar código depois.

Acrescente ao mesmo arquivo:

```ts
/**
 * R15 (PROVISÓRIO) — a área ainda não confirmou se a ação regional consome
 * também um slot do inventário nacional do dia. Assumimos que sim, por ser o
 * erro menos grave: mostrar menos disponibilidade nacional custa uma venda
 * possível; o contrário faz vender espaço que não existe.
 *
 * Quando a área confirmar, troque o retorno desta função — e só dela.
 */
export function regionalConsomeSlotNacional(): boolean {
  return true
}
```

E o teste, no mesmo arquivo de teste:

```ts
describe('regionalConsomeSlotNacional', () => {
  it('assume que sim, enquanto a área não confirma', () => {
    expect(regionalConsomeSlotNacional()).toBe(true)
  })
})
```

Lembre de acrescentar `regionalConsomeSlotNacional` à linha de importação do
teste.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 73 + 15 = 88.

- [ ] **Step 6: Commitar**

```powershell
git add src/lib/dominio/regional.ts src/lib/dominio/regional.test.ts
git commit -m "feat: disponibilidade regional por praca com teto por acao"
```

---

### Task 4: Domínio — datas bloqueadas e prazo mínimo

**Files:**
- Create: `src/lib/dominio/bloqueios.ts`, `src/lib/dominio/bloqueios.test.ts`

**Interfaces:**
- Produces:
  - `type DataBloqueada = { data: string; motivo: string }`
  - `estaBloqueada(bloqueios: DataBloqueada[], dataIso: string): DataBloqueada | null`
  - `dentroDoPrazoMinimo(hojeIso: string, dataIso: string, prazoDias: number): boolean`
  - `diasDeAntecedencia(hojeIso: string, dataIso: string): number`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import { estaBloqueada, dentroDoPrazoMinimo, diasDeAntecedencia } from './bloqueios'

const bloqueios = [
  { data: '2026-12-25', motivo: 'Natal' },
  { data: '2026-09-07', motivo: 'Feriado — programa não vai ao ar' },
]

describe('estaBloqueada', () => {
  // R12: data bloqueada vence tudo, mesmo com slot livre
  it('devolve o bloqueio, com o motivo', () => {
    expect(estaBloqueada(bloqueios, '2026-12-25')).toEqual({ data: '2026-12-25', motivo: 'Natal' })
  })

  it('devolve nulo para data livre', () => {
    expect(estaBloqueada(bloqueios, '2026-12-26')).toBeNull()
  })

  it('devolve nulo quando não há bloqueio nenhum', () => {
    expect(estaBloqueada([], '2026-12-25')).toBeNull()
  })
})

describe('diasDeAntecedencia', () => {
  it('conta os dias entre hoje e a exibição', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-22')).toBe(7)
  })

  it('devolve zero para o próprio dia', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-15')).toBe(0)
  })

  it('devolve negativo para data passada', () => {
    expect(diasDeAntecedencia('2026-08-15', '2026-08-14')).toBe(-1)
  })
})

describe('dentroDoPrazoMinimo', () => {
  // R11: Encontro exige 7 dias; É de Casa, 10
  it('recusa data com menos dias que o prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-20', 7)).toBe(true)
  })

  it('aceita data exatamente no prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-22', 7)).toBe(false)
  })

  it('aceita data confortavelmente além do prazo', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-09-30', 10)).toBe(false)
  })

  it('trata prazo zero', () => {
    expect(dentroDoPrazoMinimo('2026-08-15', '2026-08-15', 0)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./bloqueios"`.

- [ ] **Step 3: Implementar**

```ts
export type DataBloqueada = {
  data: string
  motivo: string
}

/**
 * R12 — data bloqueada vence qualquer disponibilidade. Devolve o bloqueio
 * inteiro, e não só um booleano, porque a interface precisa mostrar o motivo:
 * "indisponível" sem explicação vira dúvida e telefonema.
 */
export function estaBloqueada(
  bloqueios: DataBloqueada[],
  dataIso: string,
): DataBloqueada | null {
  return bloqueios.find((bloqueio) => bloqueio.data === dataIso) ?? null
}

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000

export function diasDeAntecedencia(hojeIso: string, dataIso: string): number {
  const hoje = new Date(`${hojeIso}T00:00:00Z`).getTime()
  const alvo = new Date(`${dataIso}T00:00:00Z`).getTime()
  return Math.round((alvo - hoje) / MILISSEGUNDOS_POR_DIA)
}

/**
 * R11 — verdadeiro quando a data está DENTRO do prazo mínimo, ou seja, perto
 * demais para ser vendida. Encontro exige 7 dias; É de Casa, 10.
 */
export function dentroDoPrazoMinimo(
  hojeIso: string,
  dataIso: string,
  prazoDias: number,
): boolean {
  return diasDeAntecedencia(hojeIso, dataIso) < prazoDias
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 88 + 10 = 98.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/bloqueios.ts src/lib/dominio/bloqueios.test.ts
git commit -m "feat: datas bloqueadas e prazo minimo de antecedencia"
```

---

### Task 5: Domínio — restrições de anunciante e concorrência

**Files:**
- Create: `src/lib/dominio/restricoes.ts`, `src/lib/dominio/restricoes.test.ts`

**Interfaces:**
- Produces:
  - `type Restricao = { anunciante: string | null; setor: string | null; industria: string | null; motivo: string }`
  - `type Anunciante = { nome: string; setor: string | null; industria: string | null }`
  - `restricaoQueBloqueia(restricoes: Restricao[], cliente: Anunciante): Restricao | null`
  - `type VendaNaData = { anunciante: string; setor: string | null; industria: string | null }`
  - `concorrenteNaData(vendas: VendaNaData[], cliente: Anunciante): VendaNaData | null`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from 'vitest'
import { restricaoQueBloqueia, concorrenteNaData } from './restricoes'

const restricoes = [
  { anunciante: 'AMBEV', setor: null, industria: null, motivo: 'Concorrente do patrocinador' },
  { anunciante: null, setor: 'Bebidas', industria: 'Alcoólicas', motivo: 'Apresentadora não faz' },
  { anunciante: null, setor: null, industria: 'Cigarros', motivo: 'Política editorial' },
]

describe('restricaoQueBloqueia', () => {
  // R13: por anunciante nomeado
  it('bloqueia o anunciante cadastrado, sem depender de acento ou caixa', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'ambev', setor: 'Bebidas', industria: 'Cervejas' })
    expect(achado?.motivo).toBe('Concorrente do patrocinador')
  })

  // por setor + indústria
  it('bloqueia pelo par setor e indústria', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'Outra Marca', setor: 'Bebidas', industria: 'Alcoólicas' })
    expect(achado?.motivo).toBe('Apresentadora não faz')
  })

  // por categoria isolada — o caso "não faz bebidas alcoólicas"
  it('bloqueia pela indústria sozinha', () => {
    const achado = restricaoQueBloqueia(restricoes, { nome: 'Marca X', setor: 'Tabaco', industria: 'Cigarros' })
    expect(achado?.motivo).toBe('Política editorial')
  })

  it('libera cliente que não casa com nenhuma restrição', () => {
    expect(restricaoQueBloqueia(restricoes, { nome: 'Nestlé', setor: 'Alimentos', industria: 'Chocolates' })).toBeNull()
  })

  it('não bloqueia por setor quando a restrição exige também a indústria', () => {
    expect(restricaoQueBloqueia(restricoes, { nome: 'Suco Bom', setor: 'Bebidas', industria: 'Sucos' })).toBeNull()
  })
})

describe('concorrenteNaData', () => {
  const vendas = [
    { anunciante: 'COCA-COLA', setor: 'Bebidas', industria: 'Refrigerantes' },
    { anunciante: 'NESTLÉ', setor: 'Alimentos', industria: 'Chocolates' },
  ]

  // R14: concorrência é calculada, não cadastrada
  it('acusa concorrente de mesmo setor e indústria', () => {
    const achado = concorrenteNaData(vendas, { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' })
    expect(achado?.anunciante).toBe('COCA-COLA')
  })

  it('libera categoria diferente', () => {
    expect(concorrenteNaData(vendas, { nome: 'PEPSI', setor: 'Bebidas', industria: 'Sucos' })).toBeNull()
  })

  it('não acusa o próprio cliente como concorrente de si mesmo', () => {
    expect(concorrenteNaData(vendas, { nome: 'coca-cola', setor: 'Bebidas', industria: 'Refrigerantes' })).toBeNull()
  })

  it('não acusa nada quando a categoria do cliente é desconhecida', () => {
    expect(concorrenteNaData(vendas, { nome: 'X', setor: null, industria: null })).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./restricoes"`.

- [ ] **Step 3: Implementar**

```ts
export type Restricao = {
  anunciante: string | null
  setor: string | null
  industria: string | null
  motivo: string
}

export type Anunciante = {
  nome: string
  setor: string | null
  industria: string | null
}

export type VendaNaData = {
  anunciante: string
  setor: string | null
  industria: string | null
}

function normalizar(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * R13 — a restrição CADASTRADA pelo consultor: o que ninguém consegue deduzir,
 * como o apresentador não fazer bebidas alcoólicas. Casa do mais específico
 * para o mais genérico: anunciante nomeado, depois setor+indústria, depois
 * setor ou indústria isolados.
 */
export function restricaoQueBloqueia(
  restricoes: Restricao[],
  cliente: Anunciante,
): Restricao | null {
  const nome = normalizar(cliente.nome)
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)

  for (const restricao of restricoes) {
    const rAnunciante = normalizar(restricao.anunciante)
    const rSetor = normalizar(restricao.setor)
    const rIndustria = normalizar(restricao.industria)

    if (rAnunciante !== '' && rAnunciante === nome) return restricao

    if (rAnunciante === '') {
      const setorCasa = rSetor === '' || rSetor === setor
      const industriaCasa = rIndustria === '' || rIndustria === industria
      const temAlgumCriterio = rSetor !== '' || rIndustria !== ''
      if (temAlgumCriterio && setorCasa && industriaCasa) return restricao
    }
  }

  return null
}

/**
 * R14 — a concorrência é CALCULADA a partir do que já está vendido na data.
 * Dois clientes concorrem quando compartilham setor e indústria. Cliente sem
 * classificação não gera bloqueio: acusar concorrência sem base impediria
 * venda legítima.
 */
export function concorrenteNaData(
  vendas: VendaNaData[],
  cliente: Anunciante,
): VendaNaData | null {
  const setor = normalizar(cliente.setor)
  const industria = normalizar(cliente.industria)
  if (setor === '' || industria === '') return null

  const nome = normalizar(cliente.nome)
  return (
    vendas.find(
      (venda) =>
        normalizar(venda.anunciante) !== nome &&
        normalizar(venda.setor) === setor &&
        normalizar(venda.industria) === industria,
    ) ?? null
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 98 + 9 = 107.

- [ ] **Step 5: Commitar**

```powershell
git add src/lib/dominio/restricoes.ts src/lib/dominio/restricoes.test.ts
git commit -m "feat: restricao cadastrada de anunciante e concorrencia por data"
```

---

### Task 6: Domínio — praças sugeridas pelo texto da API

**Files:**
- Create: `src/lib/dominio/pracas-no-texto.ts`, `src/lib/dominio/pracas-no-texto.test.ts`

**Interfaces:**
- Consumes: `PRACAS` da Task 3.
- Produces: `pracasNoTexto(texto: string | null | undefined): string[]`

Esta função **sugere**, nunca decide. O consultor confirma antes de valer.

- [ ] **Step 1: Escrever o teste que falha**

Os casos são frases reais da base, com as 15 grafias encontradas.

```ts
import { describe, it, expect } from 'vitest'
import { pracasNoTexto } from './pracas-no-texto'

describe('pracasNoTexto', () => {
  it('reconhece praça única depois de traço', () => {
    expect(pracasNoTexto('Ação regional - RJ')).toEqual(['RJ'])
  })

  it('reconhece duas praças separadas por barra', () => {
    expect(pracasNoTexto('Ação regional SP/BH')).toEqual(['SP', 'BH'])
  })

  it('reconhece praça entre parênteses com rótulo', () => {
    expect(pracasNoTexto('Ação regional (praça: SP) com LED, QR Code')).toEqual(['SP'])
  })

  it('reconhece lista com "e"', () => {
    expect(pracasNoTexto('Ação regional (RJ, SP e DF) no sofánews')).toEqual(['SP', 'RJ', 'DF'])
  })

  it('trata SP1 como SP', () => {
    expect(pracasNoTexto('AÇÃO REGIONAL - PRAÇA SP1')).toEqual(['SP'])
  })

  it('trata PE1 como PE1', () => {
    expect(pracasNoTexto('Ação regional na praça PE1.')).toEqual(['PE1'])
  })

  it('reconhece soma com sinal de mais', () => {
    expect(pracasNoTexto('Ação regional para SP1, RJ + BH')).toEqual(['SP', 'RJ', 'BH'])
  })

  it('devolve vazio quando não há praça no texto', () => {
    expect(pracasNoTexto('Ação regional com speech, LED e QR Code.')).toEqual([])
  })

  it('devolve vazio para texto ausente', () => {
    expect(pracasNoTexto(null)).toEqual([])
    expect(pracasNoTexto('-')).toEqual([])
  })

  it('não confunde sigla dentro de palavra', () => {
    expect(pracasNoTexto('Ação no ESPORTE com DFX e BHZ')).toEqual([])
  })

  it('devolve na ordem canônica, sem repetir', () => {
    expect(pracasNoTexto('regional BH, SP, BH e RJ')).toEqual(['SP', 'RJ', 'BH'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./pracas-no-texto"`.

- [ ] **Step 3: Implementar**

```ts
import { PRACAS } from './regional'

/**
 * A API não tem campo de praça: a informação está em texto livre, escrito por
 * pessoas, com pelo menos 15 grafias diferentes ("- RJ", "SP/BH", "(praça:
 * SP)", "SP1, RJ + BH"). Esta função SUGERE o que reconheceu; quem decide é o
 * consultor, na tela. Nunca use o resultado como verdade.
 */
const APELIDOS: Record<string, string> = {
  SP: 'SP',
  SP1: 'SP',
  RJ: 'RJ',
  BH: 'BH',
  DF: 'DF',
  PE: 'PE1',
  PE1: 'PE1',
}

export function pracasNoTexto(texto: string | null | undefined): string[] {
  if (!texto) return []

  const encontradas = new Set<string>()
  // \b garante sigla isolada: "DFX" e "BHZ" não contam.
  const padrao = new RegExp(`\\b(${Object.keys(APELIDOS).join('|')})\\b`, 'gi')

  for (const achado of texto.matchAll(padrao)) {
    const canonica = APELIDOS[achado[1].toUpperCase()]
    if (canonica) encontradas.add(canonica)
  }

  return PRACAS.filter((praca) => encontradas.has(praca))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS — 107 + 11 = 118.

- [ ] **Step 5: Conferir contra a base real**

Escreva um script descartável em `.superpowers/conferir-pracas.mjs` que leia
`vendas.json`, filtre os registros cujo `descritivo_da_acao` contenha
"regional", e imprima o texto ao lado das praças sugeridas. Confira à mão se
alguma frase real ficou sem sugestão indevidamente e relate. Não altere a
função para forçar casos: relate o que encontrar.

- [ ] **Step 6: Commitar**

```powershell
git add src/lib/dominio/pracas-no-texto.ts src/lib/dominio/pracas-no-texto.test.ts
git commit -m "feat: sugestao de pracas a partir do texto livre da API"
```

---

### Task 7: Sessão com múltiplos perfis

**Files:**
- Modify: `src/lib/sessao-servidor.ts`, `src/components/layout/BarraLateral.tsx`, `scripts/tornar-admin.mjs`
- Create: `src/lib/dados/vinculos.ts`

**Interfaces:**
- Consumes: `Perfil`, `podeAdministrarProgramas`, `podeConsultarRegional` da Task 2.
- Produces:
  - `type Sessao = { usuarioId: string; email: string; nome: string; cargo: string | null; perfis: Perfil[]; programasVinculados: string[] }`
  - `obterSessao(): Promise<Sessao | null>`
  - `podeAdministrar(sessao: Sessao | null): boolean`

- [ ] **Step 1: Reescrever `obterSessao`**

Lê `usuario` (nome, cargo), todas as linhas de `perfil_usuario` (perfis) e
`consultor_programa` (programas vinculados). Usuário sem nenhum perfil recebe
`['executivo']` — o mais restrito.

- [ ] **Step 2: Atualizar a barra lateral**

O rodapé mostra o nome e os perfis por extenso ("Executiva comercial ·
Regional"). O menu Configurações aparece por `podeAdministrarProgramas`.

- [ ] **Step 3: Atualizar `scripts/tornar-admin.mjs`**

Passa a aceitar o perfil: `npm run admin -- <email> <perfil>`, com
`proprietario` como padrão. Insere em `usuario` e em `perfil_usuario` sem apagar
os perfis existentes — perfis se acumulam. Rejeita perfil fora da lista com
mensagem clara.

- [ ] **Step 4: Verificar contra o banco real**

```powershell
npm run admin -- nubia.andrade@g.globo executivo_regional
```

Esperado: a conta passa a ter **dois** perfis (`proprietario` e
`executivo_regional`), sem perder o primeiro. Confirme consultando a tabela e
cole a saída no relatório.

- [ ] **Step 5: Verificar e commitar**

```powershell
npm test
npm run build
git add src/lib/sessao-servidor.ts src/components/layout/BarraLateral.tsx scripts/tornar-admin.mjs src/lib/dados/vinculos.ts
git commit -m "feat: sessao com perfis acumulaveis e vinculo de consultor"
```

---

### Task 8: Peças de interface reutilizáveis

**Files:**
- Create: `src/components/comum/CampoDeBuscaDeCliente.tsx`, `src/components/comum/EstadoVazio.tsx`, `src/components/comum/BotaoDeGravacao.tsx`, `src/components/comum/ConfirmacaoNomeada.tsx`, `src/components/comum/AvisoDeSaida.tsx`
- Create: `src/lib/dados/busca-clientes.ts`

**Interfaces:**
- Produces:
  - `<CampoDeBuscaDeCliente aoEscolher={(cliente) => void} />`
  - `<EstadoVazio titulo={string} explicacao={string} acao={ReactNode} />`
  - `<BotaoDeGravacao gravando={boolean}>{children}</BotaoDeGravacao>`
  - `<ConfirmacaoNomeada nomeEsperado={string} aoConfirmar={() => void} />`
  - `<AvisoDeSaida ativo={boolean} />`
  - `buscarClientes(termo: string, limite?: number): Promise<{ id, nome, cnpj, setor, industria }[]>`

Estas peças existem porque os princípios de UX da spec valem para todas as
telas; implementá-los solto em cada uma garante divergência.

- [ ] **Step 1: `buscarClientes`**

Consulta `clientes` com `ilike` sobre `nome`, limite padrão de 20, ordenado por
nome. São 15.519 registros: nunca traga tudo.

- [ ] **Step 2: `CampoDeBuscaDeCliente`**

Campo com busca conforme se digita (aguardando 300ms após a última tecla), lista
de sugestões navegável por teclado (setas e Enter), e exibição do setor e da
indústria em cada sugestão — é o que distingue dois clientes de nome parecido.
Ao escolher, devolve o cliente inteiro, não só o nome.

**Nenhuma tela desta entrega aceita nome de cliente digitado à mão.**

- [ ] **Step 3: `EstadoVazio`**

Bloco centralizado com título, uma frase explicando o que aquela lista guarda e
por que vale preencher, e um espaço para o botão de ação.

- [ ] **Step 4: `BotaoDeGravacao`**

Botão com `var(--marca)` que, enquanto `gravando`, fica desabilitado e troca o
texto por "Salvando…". Impede o duplo clique que gera registro duplicado.

- [ ] **Step 5: `ConfirmacaoNomeada`**

Caixa de confirmação que só habilita o botão destrutivo quando a pessoa digita
exatamente o `nomeEsperado`. Usada na exclusão de programa.

- [ ] **Step 6: `AvisoDeSaida`**

Enquanto `ativo`, registra `beforeunload` e intercepta navegação interna,
perguntando se a pessoa quer sair com alterações não salvas.

- [ ] **Step 7: Verificar e commitar**

```powershell
npm run build
npm run lint
git add src/components/comum src/lib/dados/busca-clientes.ts
git commit -m "feat: pecas de interface reutilizaveis para as telas da entrega"
```

---

### Task 9: Lista de programas em cartões

**Files:**
- Modify: `src/app/(app)/configuracoes/programas/page.tsx`
- Create: `src/components/programas/CartaoDePrograma.tsx`, `src/components/programas/GradeDeProgramas.tsx`
- Modify: `src/lib/acoes/programas.ts` (excluir)

**Interfaces:**
- Consumes: `podeExcluirPrograma` da Task 2; `ConfirmacaoNomeada`, `EstadoVazio` da Task 8.
- Produces: `excluirPrograma(id: string): Promise<{ erro: string | null }>`

- [ ] **Step 1: `CartaoDePrograma`**

Cartão com capa de 120px — a imagem do programa quando houver, senão o gradiente
da marca com as iniciais. Abaixo: nome (Space Grotesk 16px/700), status como
etiqueta colorida (ativo em `var(--disponivel)`, inativo em `var(--texto-3)`, em
configuração em `var(--prazo)`), e "Modificado em DD/MM/AAAA" em
`var(--texto-3)`.

Botão **Ver** com `var(--marca)` levando à área do programa. Menu de três pontos
com **Editar** e, apenas quando `podeExcluirPrograma`, **Excluir**.

- [ ] **Step 2: `GradeDeProgramas`**

Grade responsiva (`repeat(auto-fill, minmax(240px, 1fr))`, gap 16px) com campo
de busca por nome no topo e filtro por status. Estado vazio: "Nenhum programa
cadastrado ainda. Cadastre o primeiro para começar a configurar disponibilidade."

- [ ] **Step 3: Exclusão com confirmação nomeada**

`excluirPrograma` valida no servidor que quem chama é proprietário. A interface
usa `ConfirmacaoNomeada`, exigindo o nome do programa, e avisa antes o que será
apagado junto: datas bloqueadas, restrições, preços e ações regionais.

- [ ] **Step 4: Verificar contra o banco real**

Suba com `npm run dev`, confirme que o MAVO aparece como cartão com a imagem, e
que **Excluir** aparece (a conta é proprietária). **Não exclua o MAVO** — crie
um programa de teste, exclua esse, e confirme no banco que sumiu.

- [ ] **Step 5: Commitar**

```powershell
git add "src/app/(app)/configuracoes/programas" src/components/programas src/lib/acoes/programas.ts
git commit -m "feat: lista de programas em cartoes com exclusao protegida"
```

---

### Task 10: Área do programa com abas

**Files:**
- Create: `src/app/(app)/configuracoes/programas/[id]/layout.tsx`, `.../[id]/page.tsx`, `.../[id]/datas/page.tsx`, `.../[id]/restricoes/page.tsx`, `.../[id]/regional/page.tsx`, `.../[id]/modelo/page.tsx`
- Create: `src/components/programas/CabecalhoDoPrograma.tsx`, `src/components/programas/AbasDoPrograma.tsx`

**Interfaces:**
- Consumes: `podeEditarPrograma` da Task 2; `obterSessao` da Task 7.
- Produces: layout que carrega o programa uma vez e o compartilha com as abas.

- [ ] **Step 1: Layout com guarda por vínculo**

O layout carrega o programa, chama `obterSessao`, e nega acesso com
`notFound()` quando `podeEditarPrograma` é falso. **Negar com "não encontrado",
não com "sem permissão"** — não revelar a existência de programa que a pessoa
não administra.

- [ ] **Step 2: `CabecalhoDoPrograma`**

Faixa com a imagem ao fundo (escurecida para garantir contraste), nome, mnemônico
e canal, além do caminho de volta para a lista.

- [ ] **Step 3: `AbasDoPrograma`**

Cinco abas: **Cadastro**, **Datas bloqueadas**, **Restrições**, **Regional** e
**Modelo de propostas**. Cada uma com um contador quando houver itens ("Datas
bloqueadas · 3").

A aba **Regional** só aparece quando o programa tem `aceita_regional`.

A aba **Modelo de propostas** aparece **desabilitada**, com o texto "Disponível
na próxima entrega" — a spec decidiu mostrar em vez de esconder, para que o
consultor saiba que existe.

- [ ] **Step 4: Mover o cadastro para a aba**

O formulário dos 19 campos passa a viver em `[id]/page.tsx`, com os campos
regionais novos (`aceita_regional`, `dia_da_semana_regional`,
`prazo_minimo_regional_dias`, `max_pracas_por_acao`, `direitos_e_conexos`,
`custo_producao_regional`) num bloco próprio, visível só quando
`aceita_regional` está marcado.

O formulário usa `AvisoDeSaida` e `BotaoDeGravacao`.

- [ ] **Step 5: Verificar e commitar**

Confirme no navegador que a aba Regional some ao desmarcar `aceita_regional`, e
que abrir o programa por URL sem vínculo dá "não encontrado".

```powershell
git add "src/app/(app)/configuracoes/programas/[id]" src/components/programas
git commit -m "feat: area do programa com abas e guarda por vinculo"
```

---

### Task 11: Datas bloqueadas e restrições

**Files:**
- Create: `src/lib/dados/bloqueios.ts`, `src/lib/acoes/bloqueios.ts`, `src/components/programas/CalendarioDeBloqueios.tsx`, `src/components/programas/PainelDeRestricoes.tsx`
- Create: `src/lib/dados/restricoes.ts`, `src/lib/acoes/restricoes.ts`

**Interfaces:**
- Consumes: `estaBloqueada` da Task 4; `restricaoQueBloqueia` da Task 5; `CampoDeBuscaDeCliente`, `EstadoVazio`, `BotaoDeGravacao` da Task 8.
- Produces:
  - `listarBloqueios(programaId: string): Promise<DataBloqueada[]>`
  - `bloquearDatas(programaId: string, datas: string[], motivo: string): Promise<{ erros: string[] }>`
  - `desbloquearData(programaId: string, data: string): Promise<{ erro: string | null }>`
  - `listarRestricoes(programaId: string): Promise<Restricao[]>`
  - `salvarRestricao(programaId: string, dados: Partial<Restricao>): Promise<{ erros: string[] }>`

- [ ] **Step 1: Calendário de bloqueios**

Grade mensal com navegação entre meses, no padrão visual do handoff (célula com
`var(--raio-campo)`, gap 6px). Clicar numa data a seleciona; várias podem ser
selecionadas de uma vez. Datas já bloqueadas aparecem em `var(--esgotado-fundo)`
com o motivo no título.

Um painel lateral lista as datas selecionadas e pede o **motivo**, obrigatório,
antes de habilitar o botão. Ao confirmar, mostra quantas datas serão bloqueadas.

Estado vazio: "Nenhuma data bloqueada. Bloqueie datas em que o programa não
aceita ação — feriados, reprises ou períodos já comprometidos."

- [ ] **Step 2: Painel de restrições**

Lista as restrições com uma etiqueta indicando o tipo (Anunciante, Categoria,
Setor) e o motivo. Formulário com três modos, escolhidos por botões de opção:

1. **Anunciante específico** — usa `CampoDeBuscaDeCliente`; ao escolher, o setor
   e a indústria vêm preenchidos e travados, vindos da carteira
2. **Setor e indústria** — dois campos de seleção alimentados pelos valores
   distintos existentes em `clientes`
3. **Só categoria** — um campo de seleção único, para o caso "não faz bebidas
   alcoólicas"

Motivo obrigatório nos três. Antes de salvar, mostra **quantos clientes da
carteira aquela restrição afeta** — é a diferença entre bloquear uma marca e
bloquear um setor inteiro sem perceber.

- [ ] **Step 3: Verificar contra o banco real**

Cadastre no MAVO: uma restrição por anunciante, uma por setor+indústria e uma só
por indústria. Confirme as três no banco e cole no relatório. Bloqueie três
datas com motivo e confirme.

- [ ] **Step 4: Commitar**

```powershell
git add src/lib/dados/bloqueios.ts src/lib/acoes/bloqueios.ts src/lib/dados/restricoes.ts src/lib/acoes/restricoes.ts src/components/programas
git commit -m "feat: datas bloqueadas em calendario e restricoes de anunciante"
```

---

### Task 12: Aba Regional

**Files:**
- Create: `src/lib/dados/regional.ts`, `src/lib/acoes/regional.ts`, `src/components/programas/PainelRegional.tsx`, `src/components/programas/MatrizDePracas.tsx`, `src/components/programas/FormularioDeAcaoRegional.tsx`

**Interfaces:**
- Consumes: `PRACAS`, `pracasLivresEm`, `validarCompra`, `temSlotRegionalEm` da Task 3; `pracasNoTexto` da Task 6; `CampoDeBuscaDeCliente`, `BotaoDeGravacao`, `EstadoVazio` da Task 8.
- Produces:
  - `listarPrecos(programaId: string): Promise<{ praca_codigo: string; valor: number }[]>`
  - `salvarPrecos(programaId: string, precos: { praca_codigo: string; valor: number }[]): Promise<{ erros: string[] }>`
  - `listarAcoesRegionais(programaId: string, deIso: string, ateIso: string): Promise<AcaoRegional[]>`
  - `registrarAcaoRegional(programaId: string, dados: { data: string; clienteId: string; clienteNome: string; pracas: string[] }): Promise<{ erros: string[] }>`

- [ ] **Step 1: Tabela de preços por praça**

As cinco praças em linhas, com campo de valor no formato brasileiro (reaproveite
`src/lib/dominio/moeda.ts`, que já existe). Mostra `atualizado_em` de cada
preço, e um aviso permanente: "Valores pendentes de confirmação com Pricing" —
porque é o que o documento da área diz.

Abaixo, os campos de **direitos e conexos** e **custo de produção regional**, e
um cálculo ao vivo: escolhendo praças, mostra o total daquela ação.

- [ ] **Step 2: `MatrizDePracas`**

A visão principal da aba: as datas do programa (só o dia da semana regional) nas
linhas, as 5 praças nas colunas, e cada célula mostrando livre, vendida (com o
nome do cliente) ou fora de prazo. Mostra dois meses por vez, com navegação.

Esta matriz é o que responde a pergunta real do consultor: *"o que ainda tenho
para vender?"*

- [ ] **Step 3: `FormularioDeAcaoRegional`**

Registrar ação vendida: data (só datas com slot, as demais desabilitadas),
cliente (`CampoDeBuscaDeCliente`) e as praças, com as já vendidas desabilitadas
e o motivo à vista.

Chama `validarCompra` antes de gravar e mostra os erros que ela devolve.

**A sugestão a partir da API:** quando existir uma entrega em `acoes_vendidas`
naquele programa e data, o formulário oferece "Encontramos uma ação nesta data:
*[descritivo]*. Praças reconhecidas: SP, RJ." com as praças pré-marcadas e o
`origem` gravado como `sugerido_api`. O consultor confirma ou corrige.

- [ ] **Step 4: Configurar Encontro e É de Casa de verdade**

Cadastre os dois programas com os valores exatos das regras (mnemônicos `FATI` e
`CASA`, para casar com a API), incluindo dias, prazos, preços das cinco praças,
direitos e conexos e custo de produção. Cadastre também os apelidos necessários.

- [ ] **Step 5: Verificar a regra na prática**

No Encontro, numa sexta-feira, registre uma ação para um cliente nas praças SP,
RJ e BH. Confirme na matriz que **DF e PE1 seguem livres** e que SP não pode ser
vendida de novo. Tente registrar 4 praças e confirme a recusa. Tente numa
quinta-feira e confirme que não há slot. Cole tudo no relatório.

- [ ] **Step 6: Verificação final e commit**

```powershell
npm test
npm run build
npm run lint
git add src/lib/dados/regional.ts src/lib/acoes/regional.ts src/components/programas
git commit -m "feat: aba regional com precos por praca e matriz de disponibilidade"
```

---

## Verificação final da entrega

1. `npm test` — todos passam (118 esperados).
2. `npm run build` e `npm run lint` sem erro.
3. Uma pessoa com dois perfis vê o que os dois permitem.
4. Consultor sem vínculo recebe "não encontrado" ao abrir o programa por URL.
5. Cartões mostram imagem, status e data de modificação; **Excluir** só para o proprietário.
6. Excluir programa exige digitar o nome.
7. Data bloqueada aparece com motivo.
8. Restrição cadastrada nas três formas.
9. No Encontro, sexta com SP, RJ e BH vendidos: DF e PE1 livres; SP recusada; 4 praças recusadas; quinta sem slot.
10. Nenhum campo de cliente aceita texto livre.
11. Sair de formulário alterado avisa.

## O que a spec pede e este plano deixa para a Entrega 3

**R16 — bloqueio mensal do regional** (4 ações fecham o mês). O campo
`bloqueio_mensal` já existe no cadastro desde a Entrega 1, e esta entrega o
preenche para Encontro e É de Casa. A regra em si só age quando o calendário
existe, então ela é implementada e testada junto do wizard. Registrado aqui para
não parecer esquecimento.

## Pendências que continuam abertas

Registradas na spec, não bloqueiam esta entrega: se a ação regional consome o
slot nacional (R15 segue conservador); os valores por praça ("checar com
Pricing"); as regras do Altas Horas; o que é o "pré-projeto"; e se praças da
mesma ação podem ter anunciantes diferentes.
