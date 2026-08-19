import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obterSessao } from '@/lib/sessao-servidor'
import { podeAdministrarProgramas, podeEditarPrograma } from '@/lib/dominio/perfis'
import { listarProgramas } from '@/lib/dados/programas'
import { obterConfiguracaoDeEmailDoPrograma } from '@/lib/dados/email-programa'
import { emailMicrosoftConfigurado, remetenteMicrosoft } from '@/lib/propostas/email-microsoft'

export default async function PaginaEmailsDasPropostas() {
  const sessao = await obterSessao()
  if (!sessao || !podeAdministrarProgramas(sessao.perfis)) notFound()

  const programas = (await listarProgramas())
    .filter((programa) => programa.estado !== 'inativo')
    .filter((programa) => podeEditarPrograma(sessao.perfis, sessao.programasVinculados, programa.id))

  const linhas = await Promise.all(programas.map(async (programa) => ({
    programa,
    configuracao: await obterConfiguracaoDeEmailDoPrograma(programa.id),
  })))

  const microsoftOk = emailMicrosoftConfigurado()
  const remetente = remetenteMicrosoft()
  const ativos = linhas.filter((item) => item.configuracao.ativo).length
  const semResponsavel = linhas.filter((item) => item.configuracao.ativo && item.configuracao.usuarios.filter((u) => u.selecionado).length === 0).length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Distribuição de propostas</p>
          <h1 className="mt-1 text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
            E-mails das propostas
          </h1>
          <p className="mt-1 max-w-[820px] text-[13px] leading-[1.55] text-[var(--texto-3)]">
            O executivo que gera a proposta recebe em Para. Aqui você acompanha e configura os usuários do Chatbot 2.0 que recebem cópia por programa.
          </p>
        </div>
        <Link href="/configuracoes" className="rounded-[10px] border border-[var(--borda-forte)] bg-white px-4 py-2.5 text-[12px] font-bold text-[var(--texto-2)]">
          ← Configurações
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Programas visíveis" valor={String(linhas.length)} />
        <Metrica rotulo="Disparo ativo" valor={String(ativos)} />
        <Metrica rotulo="Ativos sem CC" valor={String(semResponsavel)} alerta={semResponsavel > 0} />
        <Metrica rotulo="Microsoft 365" valor={microsoftOk ? 'Configurado' : 'Pendente'} alerta={!microsoftOk} />
      </section>

      <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borda)] pb-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--texto)]">Programas e responsáveis</h2>
            <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Remetente atual: {remetente || 'não configurado'}</p>
          </div>
          {!microsoftOk && (
            <span className="rounded-full bg-[#FFF4E5] px-3 py-1.5 text-[10.5px] font-bold text-[#9A5B00]">
              Envio real ainda não habilitado
            </span>
          )}
        </div>

        <div className="divide-y divide-[var(--borda)]">
          {linhas.map(({ programa, configuracao }) => {
            const selecionados = configuracao.usuarios.filter((usuario) => usuario.selecionado)
            const incompleto = configuracao.ativo && selecionados.length === 0
            return (
              <div key={programa.id} className="grid gap-4 py-4 lg:grid-cols-[minmax(220px,1.2fr)_160px_minmax(260px,1fr)_130px] lg:items-center">
                <div>
                  <p className="text-[13.5px] font-bold text-[var(--texto)]">{programa.nome}</p>
                  <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">{programa.canal || 'TV Globo'}</p>
                </div>

                <div>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-bold ${configuracao.ativo ? 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]' : 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'}`}>
                    {configuracao.ativo ? 'Disparo ativo' : 'Desativado'}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.05em] text-[var(--texto-3)]">Cópia (CC)</p>
                  {!configuracao.schemaDisponivel ? (
                    <p className="mt-1 text-[11px] font-semibold text-[var(--concorrencia-texto)]">Schema de e-mail pendente</p>
                  ) : selecionados.length === 0 ? (
                    <p className={`mt-1 text-[11.5px] ${incompleto ? 'font-bold text-[#A65A00]' : 'text-[var(--texto-3)]'}`}>
                      {incompleto ? 'Atenção: disparo ativo sem responsável em cópia' : 'Nenhum responsável selecionado'}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--texto-2)]">
                      {selecionados.map((usuario) => usuario.nome).join(' · ')}
                    </p>
                  )}
                </div>

                <div className="lg:text-right">
                  <Link
                    href={`/configuracoes/programas/${programa.id}/email`}
                    className="inline-flex rounded-[9px] border border-[var(--borda-forte)] bg-white px-4 py-2 text-[11.5px] font-bold text-[var(--roxo)]"
                  >
                    Configurar →
                  </Link>
                </div>
              </div>
            )
          })}

          {linhas.length === 0 && (
            <p className="py-8 text-center text-[12.5px] text-[var(--texto-3)]">Nenhum programa disponível para configuração.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function Metrica({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">{rotulo}</p>
      <p className={`mt-2 text-[22px] font-bold ${alerta ? 'text-[#A65A00]' : 'text-[var(--texto)]'}`}>{valor}</p>
    </div>
  )
}
