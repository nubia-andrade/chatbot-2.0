import { redirect } from 'next/navigation'
import Link from 'next/link'
import { criarCategoriaDeOportunidade, alternarCategoriaDeOportunidade } from '@/lib/acoes/categorias-oportunidades'
import { listarCategoriasDeOportunidade } from '@/lib/dados/oportunidades'
import { podeAdministrarGovernancaGlobal } from '@/lib/dominio/perfis'
import { obterSessao } from '@/lib/sessao-servidor'

export default async function PaginaCategoriasOportunidades() {
  const sessao = await obterSessao()
  if (!sessao) redirect('/login')
  if (!podeAdministrarGovernancaGlobal(sessao.perfis)) redirect('/configuracoes')

  const categorias = await listarCategoriasDeOportunidade(true)

  return (
    <div className="mx-auto max-w-[920px] pb-16">
      <Link href="/configuracoes" className="text-[13px] font-semibold text-[#6b7280]">← Voltar para Configurações</Link>
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#ff5a3c]">Governança de dados</p>
        <h1 className="vitrine-pop mt-1 text-[30px] font-extrabold tracking-[-.8px]">Categorias de oportunidades</h1>
        <p className="mt-2 max-w-[650px] text-[13px] leading-[1.55] text-[#6b7280]">Controle a lista exibida no cadastro e nos filtros de Oportunidades. Desative uma categoria para impedir novos usos sem apagar oportunidades históricas.</p>
      </div>

      <form action={criarCategoriaDeOportunidade} className="mt-7 flex gap-3 rounded-[18px] bg-white p-4 shadow-[0_8px_24px_-18px_rgba(20,22,26,.35)]">
        <input name="nome" maxLength={60} required placeholder="Nova categoria" className="vitrine-input flex-1" />
        <button type="submit" className="vitrine-pop rounded-[12px] bg-[#14161a] px-5 text-[13px] font-bold text-white">Adicionar</button>
      </form>

      <div className="mt-5 overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_-18px_rgba(20,22,26,.35)]">
        {categorias.length === 0 ? (
          <p className="p-5 text-[13px] text-[#6b7280]">Nenhuma categoria cadastrada.</p>
        ) : categorias.map((categoria, indice) => (
          <div key={categoria.id} className={`flex items-center gap-4 px-5 py-4 ${indice > 0 ? 'border-t border-[#eceef1]' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="vitrine-pop truncate text-[14px] font-bold">{categoria.nome}</p>
              <p className="mt-0.5 text-[11px] text-[#9aa0a8]">{categoria.slug}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${categoria.ativo ? 'bg-[#eaf7ef] text-[#166534]' : 'bg-[#eef1f5] text-[#64748b]'}`}>
              {categoria.ativo ? 'Ativa' : 'Inativa'}
            </span>
            <form action={alternarCategoriaDeOportunidade}>
              <input type="hidden" name="id" value={categoria.id} />
              <input type="hidden" name="ativo" value={String(!categoria.ativo)} />
              <button type="submit" className="rounded-[10px] border border-[#d7dae0] px-3 py-2 text-[11px] font-bold text-[#5a606a] hover:border-[#14161a] hover:text-[#14161a]">
                {categoria.ativo ? 'Desativar' : 'Ativar'}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  )
}
