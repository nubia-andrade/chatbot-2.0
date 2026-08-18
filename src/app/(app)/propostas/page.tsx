import { listarPropostasVisiveis } from '@/lib/dados/propostas'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

const ROTULO_STATUS: Record<string, string> = {
  gerando: 'Gerando',
  gerada: 'PDF gerado',
  enviando: 'Enviando',
  enviada: 'Enviada',
  falha: 'Falha',
}

export default async function PaginaPropostas() {
  const propostas = await listarPropostasVisiveis()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          Propostas
        </h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Propostas geradas por você ou vinculadas aos programas que você atende.
        </p>
      </header>

      {propostas.length === 0 ? (
        <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie)] p-10 text-center">
          <p className="text-[14px] font-bold text-[var(--texto)]">Nenhuma proposta gerada ainda</p>
          <p className="mt-1 text-[12px] text-[var(--texto-3)]">As propostas concluídas no fluxo de consulta aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {propostas.map((proposta) => (
            <article key={proposta.id} className="grid gap-4 rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5 lg:grid-cols-[1fr_190px_150px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-bold text-[var(--texto)]">{proposta.marca_nome ?? proposta.cliente_nome} · {proposta.programa_nome}</h2>
                  <span className="rounded-full bg-[var(--superficie-suave)] px-2.5 py-1 text-[10.5px] font-bold text-[var(--texto-2)]">{ROTULO_STATUS[proposta.status] ?? proposta.status}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">{proposta.cliente_nome} · {proposta.modalidade === 'regional' ? 'Regional' : 'Nacional'} · {dataHora(proposta.criado_em)}</p>
                {proposta.erro && <p className="mt-2 text-[11px] text-[var(--concorrencia-texto)]">{proposta.erro}</p>}
              </div>

              <div className="lg:text-right">
                <p className="text-[10.5px] uppercase text-[var(--texto-3)]">Total comercial</p>
                <p className="mt-1 text-[15px] font-bold text-[var(--texto)]">{moeda(proposta.valor_total_comercial)}</p>
                <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">Geral: {moeda(proposta.valor_total_geral)}</p>
              </div>

              <div className="lg:text-right">
                {proposta.pdf_url ? (
                  <a href={proposta.pdf_url} target="_blank" rel="noreferrer" className="inline-flex rounded-[9px] px-4 py-2 text-[12px] font-bold text-white" style={{ background: 'var(--marca)' }}>
                    Abrir PDF
                  </a>
                ) : (
                  <span className="text-[11px] text-[var(--texto-3)]">PDF indisponível</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
