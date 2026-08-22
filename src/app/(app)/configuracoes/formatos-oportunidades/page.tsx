import { redirect } from 'next/navigation'
import Link from 'next/link'
import { criarFormatoDeOportunidade, alternarFormatoDeOportunidade } from '@/lib/acoes/formatos-oportunidades'
import { listarFormatosDeOportunidade } from '@/lib/dados/oportunidades'
import { podeAdministrarGovernancaGlobal } from '@/lib/dominio/perfis'
import { obterSessao } from '@/lib/sessao-servidor'

export default async function PaginaFormatosOportunidades() {
  const sessao = await obterSessao()
  if (!sessao) redirect('/login')
  if (!podeAdministrarGovernancaGlobal(sessao.perfis)) redirect('/configuracoes')

  const formatos = await listarFormatosDeOportunidade(true)

  return (
    <div className="mx-auto max-w-[920px] pb-16">
      <Link href="/configuracoes" className="text-[13px] font-semibold text-[#6b7280]">← Voltar para Configurações</Link>
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#ff5a3c]">Governança de dados</p>
        <h1 className="vitrine-pop mt-1 text-[30px] font-extrabold tracking-[-.8px]">Formatos de oportunidades</h1>
        <p className="mt-2 max-w-[680px] text-[13px] leading-[1.55] text-[#6b7280]">Controle os formatos comerciais disponíveis no cadastro das oportunidades. Esta lista é editorial e não altera a classificação técnica dos formatos importados do Globo Take.</p>
      </div>

      <form action={criarFormatoDeOportunidade} className="mt-7 flex gap-3 rounded-[18px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(20,22,26,.35)]">
        <input name="nome" maxLength={80} required placeholder="Novo formato" className="vitrine-input flex-1" />
        <button type="submit" className="vitrine-pop rounded-[12px] bg-[#14161a] px-5 text-[13px] font-bold text-white">Adicionar</button>
      </form>

      <div className="mt-5 overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_-18px_rgba(20,22,26,.35)]">
        {formatos.length === 0 ? (
          <p className="p-5 text-[13px] text-[#6b7280]">Nenhum formato cadastrado.</p>
        ) : formatos.map((formato, indice) => (
          <div key={formato.id} className={`flex items-center gap-4 px-5 py-4 ${indice > 0 ? 'border-t border-[#eceef1]' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="vitrine-pop truncate text-[14px] font-bold">{formato.nome}</p>
              <p className="mt-0.5 text-[11px] text-[#9aa0a8]">{formato.slug}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${formato.ativo ? 'bg-[#eaf7ef] text-[#166534]' : 'bg-[#eef1f5] text-[#64748b]'}`}>
              {formato.ativo ? 'Ativo' : 'Inativo'}
            </span>
            <form action={alternarFormatoDeOportunidade}>
              <input type="hidden" name="id" value={formato.id} />
              <input type="hidden" name="ativo" value={String(!formato.ativo)} />
              <button type="submit" className="rounded-[10px] border border-[#d7dae0] px-3 py-2 text-[11px] font-bold text-[#5a606a] hover:border-[#14161a] hover:text-[#14161a]">
                {formato.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
