import { exigirAcessoASecao } from '@/lib/autorizacao-secoes'
import { listarPropostasParaAprovacao } from '@/lib/dados/aprovacoes'
import { PainelDeAprovacoes } from '@/components/aprovacoes/PainelDeAprovacoes'

export default async function PaginaAprovacoes() {
  await exigirAcessoASecao('aprovacoes')
  const propostas = await listarPropostasParaAprovacao()
  const pendentes = propostas.filter((p) => p.aprovacao_status === 'pendente').length

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--roxo)]">Governança comercial</p>
          <h1 className="mt-1 text-[24px] font-extrabold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>Aprovações</h1>
          <p className="mt-1 max-w-[760px] text-[12px] leading-[1.5] text-[var(--texto-3)]">Revise propostas dos programas sob sua responsabilidade. O PDF só é liberado ao executivo depois da aprovação; rejeições exigem justificativa e permitem uma nova versão.</p>
        </div>
        {pendentes > 0 && <span className="rounded-full bg-[#FFF4E5] px-3 py-2 text-[11px] font-bold text-[#8A5700]">{pendentes} pendente{pendentes === 1 ? '' : 's'}</span>}
      </header>
      <PainelDeAprovacoes propostas={propostas} />
    </div>
  )
}
