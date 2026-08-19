import { listarPropostasVisiveis, type StatusEmailDaProposta } from '@/lib/dados/propostas'
import { obterSessao } from '@/lib/sessao-servidor'
import { temPerfil } from '@/lib/dominio/perfis'
import { BotaoReenviarEmail } from '@/components/propostas/BotaoReenviarEmail'
import { PainelNegociacaoProposta } from '@/components/propostas/PainelNegociacaoProposta'
import { BotaoNovaVersao } from '@/components/propostas/BotaoNovaVersao'

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

const ROTULO_PDF: Record<string, string> = {
  gerando: 'Gerando PDF',
  gerada: 'PDF gerado',
  enviando: 'PDF gerado',
  enviada: 'PDF gerado',
  falha: 'Falha no PDF',
}

const ROTULO_EMAIL: Record<StatusEmailDaProposta, string> = {
  desativado: 'E-mail desativado',
  nao_configurado: 'E-mail não configurado',
  pendente: 'E-mail pendente',
  enviando: 'Enviando e-mail',
  enviado: 'E-mail enviado',
  falha: 'Falha no e-mail',
}

function classeEmail(status: StatusEmailDaProposta): string {
  if (status === 'enviado') return 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]'
  if (status === 'falha') return 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]'
  if (status === 'enviando' || status === 'pendente') return 'bg-[#FFF4E5] text-[#A65A00]'
  return 'bg-[var(--superficie-suave)] text-[var(--texto-3)]'
}

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
          <h1 className="text-[26px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
            Propostas
          </h1>
          <p className="mt-1 text-[13px] text-[var(--texto-3)]">
            Consulte PDFs, acompanhe negociações, versões e o envio das propostas.
          </p>
        </div>
        <div className="rounded-[11px] border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-3 text-[11px] leading-[1.45] text-[var(--texto-2)]">
          Propostas emitidas não são editadas.<br />Use <strong>Nova versão</strong> quando houver revisão comercial.
        </div>
      </header>

      {propostas.length === 0 ? (
        <div className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie)] p-10 text-center">
          <p className="text-[14px] font-bold text-[var(--texto)]">Nenhuma proposta gerada ainda</p>
          <p className="mt-1 text-[12px] text-[var(--texto-3)]">As propostas concluídas no fluxo de consulta aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {propostas.map((proposta) => {
            const pdfDisponivel = Boolean(proposta.pdf_url)
            const autor = Boolean(sessao && proposta.usuario_id === sessao.usuarioId)
            const podeEditarNegociacao = Boolean(sessao && (autor || proprietario))
            const podeReenviar = Boolean(autor && pdfDisponivel)
            const podeNovaVersao = Boolean(podeEditarNegociacao && pdfDisponivel && proposta.negociacao_status !== 'substituida')

            return (
              <article key={proposta.id} className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_210px_240px] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-bold text-[var(--texto)]">{proposta.marca_nome ?? proposta.cliente_nome} · {proposta.programa_nome}</h2>
                      <span className="rounded-full border border-[#DDD6FE] bg-[#F8F6FF] px-2 py-0.5 text-[9.5px] font-bold text-[var(--roxo)]">v{proposta.versao}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">{proposta.cliente_nome} · {proposta.modalidade === 'regional' ? 'Regional' : 'Nacional'} · {dataHora(proposta.criado_em)}</p>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${proposta.status === 'falha' && !pdfDisponivel ? 'bg-[var(--concorrencia-fundo)] text-[var(--concorrencia-texto)]' : 'bg-[var(--disponivel-fundo)] text-[var(--disponivel-texto)]'}`}>
                        {ROTULO_PDF[proposta.status] ?? proposta.status}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${classeEmail(proposta.email_status)}`}>
                        {ROTULO_EMAIL[proposta.email_status]}
                      </span>
                      <span className="rounded-full border border-[var(--borda)] bg-[var(--superficie-suave)] px-2 py-1 text-[10px] font-semibold text-[var(--texto-2)]">TV</span>
                      {proposta.inclui_digital && <span className="rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-2 py-1 text-[10px] font-semibold text-[var(--roxo)]">Digital</span>}
                      {proposta.inclui_redes_sociais && <span className="rounded-full border border-[#D8E8FF] bg-[#F1F6FF] px-2 py-1 text-[10px] font-semibold text-[#315EA8]">Redes sociais</span>}
                    </div>

                    {proposta.erro && !pdfDisponivel && <p className="mt-2 text-[11px] text-[var(--concorrencia-texto)]">PDF: {proposta.erro}</p>}
                    {proposta.email_erro && <p className="mt-2 text-[11px] text-[#A65A00]">E-mail: {proposta.email_erro}</p>}
                    {proposta.email_enviado_em && <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">Último envio: {dataHora(proposta.email_enviado_em)}</p>}
                    {proposta.observacao_negociacao && <p className="mt-2 text-[11px] text-[var(--texto-2)]"><strong>Observação:</strong> {proposta.observacao_negociacao}</p>}
                    {proposta.motivo_perda && <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">Motivo da perda: {proposta.motivo_perda}</p>}
                  </div>

                  <div className="xl:text-right">
                    <p className="text-[10.5px] uppercase text-[var(--texto-3)]">Total comercial proposto</p>
                    <p className="mt-1 text-[16px] font-bold text-[var(--texto)]">{moeda(proposta.valor_total_comercial)}</p>
                    {proposta.negociacao_status === 'fechada' && proposta.valor_final_negociado !== null && (
                      <>
                        <p className="mt-3 text-[10.5px] uppercase text-[var(--texto-3)]">Valor final negociado</p>
                        <p className="mt-1 text-[15px] font-bold text-[var(--disponivel-texto)]">{moeda(proposta.valor_final_negociado)}</p>
                        {proposta.data_fechamento && <p className="mt-1 text-[10px] text-[var(--texto-3)]">Fechada em {new Intl.DateTimeFormat('pt-BR').format(new Date(`${proposta.data_fechamento}T12:00:00`))}</p>}
                      </>
                    )}
                    <p className="mt-2 text-[10.5px] text-[var(--texto-3)]">Geral para registro: {moeda(proposta.valor_total_geral)}</p>
                  </div>

                  <PainelNegociacaoProposta
                    propostaId={proposta.id}
                    statusInicial={proposta.negociacao_status}
                    valorProposto={proposta.valor_total_comercial}
                    valorFinalInicial={proposta.valor_final_negociado}
                    dataFechamentoInicial={proposta.data_fechamento}
                    observacaoInicial={proposta.observacao_negociacao}
                    motivoPerdaInicial={proposta.motivo_perda}
                    podeEditar={podeEditarNegociacao}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--borda)] pt-4">
                  {proposta.pdf_url ? (
                    <a href={proposta.pdf_url} target="_blank" rel="noreferrer" className="inline-flex rounded-[9px] px-4 py-2 text-[11.5px] font-bold text-white" style={{ background: 'var(--marca)' }}>
                      Abrir PDF
                    </a>
                  ) : (
                    <span className="px-2 py-2 text-[11px] text-[var(--texto-3)]">PDF indisponível</span>
                  )}
                  {podeReenviar && <BotaoReenviarEmail propostaId={proposta.id} />}
                  {podeNovaVersao && <BotaoNovaVersao propostaId={proposta.id} />}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
