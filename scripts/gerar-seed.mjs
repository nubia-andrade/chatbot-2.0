// Gera supabase/seed-formatos.sql e supabase/seed-clientes.sql a partir das
// planilhas em dados/. Ambos são ARQUIVOS GERADOS — não edite à mão; rode
// `npm run seed:gerar`.
//
// Por que dois arquivos: seed-formatos.sql traz os 73 formatos e suas
// categorias, dado não sensível, e é versionado. seed-clientes.sql traz a
// carteira de ~15 mil clientes com CNPJ e e-mails nominais de executivos —
// dado sensível que NÃO pode ir para o repositório, por isso está listado
// no .gitignore.
import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

function lerPlanilha(caminho) {
  let conteudo
  try {
    conteudo = readFileSync(caminho)
  } catch (erro) {
    if (erro.code === 'ENOENT') {
      // A pasta `dados/` não é versionada (contém CNPJ e e-mails nominais),
      // então quem clona o repositório não a recebe. Sem esta mensagem o
      // script morria com um ENOENT cru, sem dizer qual arquivo falta.
      console.error(
        `Não encontrei a planilha ${caminho}.\n` +
          `Ela precisa estar em ${caminho} — a pasta dados/ fica na raiz do projeto e NÃO é\n` +
          'versionada (contém CNPJ e e-mails nominais), por isso não vem junto com o\n' +
          'repositório. Peça o arquivo a quem já o tem e coloque-o nesse caminho.\n' +
          'Nenhum arquivo de seed foi gerado.',
      )
      process.exit(1)
    }
    console.error(`Não consegui ler a planilha ${caminho}: ${erro.message}`)
    process.exit(1)
  }
  const livro = XLSX.read(conteudo)
  const aba = livro.Sheets[livro.SheetNames[0]]
  return XLSX.utils.sheet_to_json(aba, { defval: '' })
}

function aspas(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return 'null'
  return `'${String(valor).trim().replace(/'/g, "''")}'`
}

/**
 * "Apto Proposta Regional" na planilha vem `'Elegível'` para quem pode
 * comprar ação regional e `'-'` para o resto. Compara tolerante a acento e
 * caixa (a mesma normalização de `normalizarNome`,
 * `src/lib/dominio/texto.ts`) para não depender da grafia exata da célula.
 */
function ehElegivelRegional(valor) {
  const normalizado = String(valor ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return normalizado === 'ELEGIVEL'
}

const formatos = lerPlanilha('dados/Formatos.xlsx')
  .filter((linha) => String(linha.FORMATO ?? '').trim() !== '')
  .map((linha) => `  (${aspas(linha.FORMATO)}, ${aspas(linha.CATEGORIA)})`)

const linhasDaCarteira = lerPlanilha('dados/Carteira.xlsx').filter(
  (linha) => String(linha['Nome da conta'] ?? '').trim() !== '',
)

const totalElegiveis = linhasDaCarteira.filter((linha) =>
  ehElegivelRegional(linha['Apto Proposta Regional']),
).length

const clientes = linhasDaCarteira.map(
  (linha) =>
    `  (${aspas(linha['Nome da conta'])}, ${aspas(linha.CNPJ)}, ${aspas(linha.Setor)}, ` +
    `${aspas(linha['Indústria'])}, ${aspas(linha['Executivo de Vendas: Nome completo'])}, ` +
    `${aspas(linha['E-mail'])}, ${aspas(linha['Segmentação SE'])}, ${aspas(linha['Cód SISCOM'])}, ` +
    `${ehElegivelRegional(linha['Apto Proposta Regional'])}, ${aspas(linha['Setor IBOPE'])})`,
)

const sqlFormatos = `-- ARQUIVO GERADO por scripts/gerar-seed.mjs. Não edite à mão.
-- Pode rodar quantas vezes quiser: não duplica nada.
-- Dado não sensível (formatos e categorias) — este arquivo É versionado.

-- Formatos e suas categorias (${formatos.length} linhas)
insert into formatos (formato, categoria) values
${formatos.join(',\n')}
on conflict (formato) do update set categoria = excluded.categoria;
`

const sqlClientes = `-- ARQUIVO GERADO por scripts/gerar-seed.mjs. Não edite à mão.
-- Pode rodar quantas vezes quiser: não duplica nada.
-- Dado sensível (CNPJ e e-mails nominais da carteira) — este arquivo NÃO é
-- versionado. Veja o .gitignore.

-- Carteira de clientes (${clientes.length} linhas, ${totalElegiveis} elegíveis para regional)
truncate table clientes;
insert into clientes (
  nome, cnpj, setor, industria, executivo, email,
  segmentacao_se, cod_siscom, apto_regional, setor_ibope
) values
${clientes.join(',\n')};
`

writeFileSync('supabase/seed-formatos.sql', sqlFormatos, 'utf8')
writeFileSync('supabase/seed-clientes.sql', sqlClientes, 'utf8')
console.log(
  `seed-formatos.sql gerado: ${formatos.length} formatos\n` +
    `seed-clientes.sql gerado: ${clientes.length} clientes (${totalElegiveis} elegíveis para regional)`,
)
