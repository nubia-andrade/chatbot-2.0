import { PainelDePerfisEAcessos } from '@/components/configuracoes/PainelDePerfisEAcessos'
import { listarUsuariosComAcessos } from '@/lib/acoes/perfis-acessos'
import { listarProgramas } from '@/lib/dados/programas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'

export default async function PaginaPerfisEAcessos() {
  const sessao = await obterSessao()

  if (!sessao || !temPerfil(sessao.perfis, 'proprietario')) {
    return (
      <section className="rounded-[var(--raio-janela)] border border-[var(--borda)] bg-[var(--superficie)] p-10">
        <h1 className="text-[24px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          Perfis e acessos
        </h1>
        <p className="mt-2 text-[13px] text-[var(--concorrencia)]">
          Apenas o perfil Proprietário pode administrar usuários e vínculos de programas.
        </p>
      </section>
    )
  }

  const [usuarios, programas] = await Promise.all([
    listarUsuariosComAcessos(),
    listarProgramas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          Perfis e acessos
        </h1>
        <p className="mt-1 max-w-[760px] text-[13px] leading-[1.5] text-[var(--texto-3)]">
          Defina o que cada usuário pode fazer e vincule os consultores aos programas que administram. Os mesmos vínculos serão usados automaticamente como destinatários das propostas geradas pelos executivos.
        </p>
      </header>

      <PainelDePerfisEAcessos
        usuarios={usuarios}
        programas={programas
          .filter((programa) => programa.estado !== 'inativo')
          .map((programa) => ({ id: programa.id, nome: programa.nome }))}
      />
    </div>
  )
}
