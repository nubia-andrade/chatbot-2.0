import type { ResumoDaImportacao } from '@/lib/dados/importacao'

const FORMATADOR_DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
})

function formatarDataHora(isoUtc: string): string {
  return FORMATADOR_DATA_HORA.format(new Date(isoUtc))
}

/**
 * Painel de Configurações > Importação (Task 12).
 *
 * O dado mais importante da tela é quando foi a última importação, por isso
 * ele abre o painel, em destaque: um snapshot velho de `acoes_vendidas` não
 * pode ser confundido com disponibilidade atual — é a diferença entre
 * informar o executivo comercial e enganá-lo sobre o que ainda está livre
 * para vender.
 */
export function PainelDeImportacao({ resumo }: { resumo: ResumoDaImportacao }) {
  if (resumo.importadoEm === null) {
    return (
      <div
        className="rounded-[var(--raio-card)] border px-6 py-10 text-center"
        style={{ background: 'var(--prazo-fundo)', borderColor: 'var(--prazo)' }}
      >
        <p className="text-[15px] font-bold" style={{ color: 'var(--prazo)' }}>
          Nenhuma importação realizada.
        </p>
        <p className="mt-2 text-[13px] text-[var(--texto-2)]">
          Rode <code className="rounded bg-[var(--superficie)] px-1.5 py-0.5">npm run importar</code>{' '}
          no computador do administrador, com sessão ativa no SSO corporativo, para trazer as
          vendas do Globo Take.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="rounded-[var(--raio-card)] border px-6 py-6"
        style={{ background: 'var(--disponivel-fundo)', borderColor: 'var(--disponivel)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--texto-3)]">
          Última importação
        </p>
        <p
          className="mt-1 text-[24px] font-extrabold"
          style={{ fontFamily: 'var(--fonte-titulo)', color: 'var(--disponivel)' }}
        >
          {formatarDataHora(resumo.importadoEm)}
        </p>
        <p className="mt-1 text-[13px] text-[var(--texto-2)]">
          {resumo.total} ação{resumo.total === 1 ? '' : 'ões'} vendida
          {resumo.total === 1 ? '' : 's'} no snapshot atual.
        </p>
      </div>

      {resumo.formatosNovos.length > 0 && (
        <div
          className="rounded-[var(--raio-card)] border px-6 py-5"
          style={{ background: 'var(--prazo-fundo)', borderColor: 'var(--prazo)' }}
        >
          <p className="text-[13.5px] font-bold" style={{ color: 'var(--prazo)' }}>
            Formatos novos, ainda sem categoria cadastrada
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {resumo.formatosNovos.map((formato) => (
              <li
                key={formato}
                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={{ background: 'var(--superficie)', color: 'var(--texto)' }}
              >
                {formato}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-[var(--texto-2)]">
            Enquanto não forem classificados em Formatos, contam como{' '}
            <strong>AÇÃO DE CONTEÚDO</strong> e ocupam grade — cadastre a categoria correta o
            quanto antes.
          </p>
        </div>
      )}

      <div
        className="overflow-x-auto rounded-[var(--raio-card)] border border-[var(--borda)]"
        style={{ background: 'var(--superficie)' }}
      >
        <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--borda)] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--texto-3)]">
              <th className="px-4 py-3">Programa</th>
              <th className="px-4 py-3">Ações vendidas</th>
            </tr>
          </thead>
          <tbody>
            {resumo.porPrograma.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-[var(--texto-3)]">
                  Nenhuma ação no snapshot atual.
                </td>
              </tr>
            ) : (
              resumo.porPrograma.map((linha) => (
                <tr key={linha.programa} className="border-b border-[var(--borda)] last:border-none">
                  <td className="px-4 py-3 font-semibold text-[var(--texto)]">{linha.programa}</td>
                  <td className="px-4 py-3 text-[var(--texto-2)]">{linha.acoes}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
