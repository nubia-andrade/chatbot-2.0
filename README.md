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
| `npm run seed:gerar` | Gera a seed a partir das planilhas em `dados/` |
| `npm run importar` | Importa os dados gerados para o Supabase |

## Configuração

Copie `.env.local.example` para `.env.local` e preencha com as chaves do
projeto no Supabase (`Project Settings > API`). A `SUPABASE_SERVICE_ROLE_KEY`
é usada só pelos scripts de linha de comando (`seed:gerar` e `importar`) —
nunca deve rodar no navegador nem ser publicada no Vercel.

## Dados

A pasta `dados/` guarda planilhas de trabalho com CNPJ e e-mails nominais e
**nunca é versionada** (veja `.gitignore`). O handoff de design vive em
`design_handoff/`.
