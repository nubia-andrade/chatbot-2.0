import { listarPropostasVisiveis } from '@/lib/dados/propostas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'
import { PainelDePropostas } from '@/components/propostas/PainelDePropostas'

export default async function PaginaPropostas() {
  const [propostas, sessao] = await Promise.all([
    listarPropostasVisiveis(),
    obterSessao(),
  ])

  const proprietario = Boolean(sessao && temPerfil(sessao.perfis, 'proprietario'))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Acompanhamento comercial</p>
          <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
            Propostas
          </h1>
          <p className="mt-1 max-w-[760px] text-[13px] text-[var(--texto-3)]">
            Busque oportunidades, acompanhe negociações e consulte todas as versões sem perder a proposta vigente de vista.
          </p>
        </div>
        <div className="rounded-[11px] border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3 text-[11px] leading-[1.45] text-[var(--texto-2)]">
          Propostas emitidas não são editadas.<br />Use <strong>Nova versão</strong> quando houver revisão comercial.
        </div>
      </header>

      <PainelDePropostas
        propostas={propostas}
        usuarioId={sessao?.usuarioId ?? null}
        proprietario={proprietario}
      />
    </div>
  )
}
