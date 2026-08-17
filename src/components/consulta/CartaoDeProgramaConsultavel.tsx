'use client'

import type { Programa } from '@/lib/dominio/cadastro'
import type { Modalidade } from '@/lib/dominio/disponibilidade'
import { urlDeImagemSegura } from '@/lib/seguranca/url-imagem'

const NOMES_DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

function diasPorExtenso(dias: number[]): string {
  if (dias.length === 0) return 'Sem dias cadastrados'
  return [...dias]
    .sort((a, b) => a - b)
    .map((dia) => NOMES_DIAS[dia] ?? '—')
    .join(', ')
}

type Props = {
  programa: Programa
  /** Motivo do veto R13 contra o cliente desta consulta, ou `null` quando não há restrição. */
  restricao: string | null
  /** `true` quando a modalidade Regional pode ser oferecida (perfil + elegibilidade do cliente). Irrelevante quando o programa não `aceita_regional`. */
  regionalDisponivel: boolean
  /** Por que Regional não é oferecida — só um dos dois motivos, nunca os dois juntos. `null` quando `regionalDisponivel` é `true` ou o programa não aceita regional. */
  motivoRegionalIndisponivel: string | null
  /**
   * `false` enquanto a checagem R13 do cliente ainda está em voo — os
   * botões ficam presentes, mas desabilitados, para não deixar escolher um
   * programa cuja resposta, um instante depois, revelaria bloqueado.
   */
  permiteEscolha: boolean
  aoEscolher: (modalidade: Modalidade) => void
}

/**
 * Cartão de um programa consultável — passo 3 (Task 11).
 *
 * Programa com restrição R13 contra o cliente fica esmaecido e sem os
 * botões de escolha: sumir da lista deixaria o executivo sem entender a
 * ausência, e deixar escolher para negar dois passos depois seria pior
 * ainda — por isso o motivo fica à vista, numa faixa vermelha, em vez de o
 * cartão desaparecer.
 */
export function CartaoDeProgramaConsultavel({
  programa,
  restricao,
  regionalDisponivel,
  motivoRegionalIndisponivel,
  permiteEscolha,
  aoEscolher,
}: Props) {
  const bloqueado = restricao !== null
  const imagem = urlDeImagemSegura(programa.imagem_url)

  const capa = imagem ? (
    <div
      role="img"
      aria-label={`Imagem de ${programa.nome}`}
      className="flex h-[104px] w-full items-end bg-cover bg-center p-3"
      style={{ backgroundImage: `url("${imagem}")` }}
    >
      <span
        className="text-[18px] font-extrabold leading-tight text-white"
        style={{ fontFamily: 'var(--fonte-titulo)', textShadow: '0 2px 6px rgba(0,0,0,.5)' }}
      >
        {programa.nome}
      </span>
    </div>
  ) : (
    <div
      className="flex h-[104px] w-full items-end p-3"
      style={{ background: 'var(--marca)' }}
    >
      <span
        className="text-[18px] font-extrabold leading-tight text-white"
        style={{ fontFamily: 'var(--fonte-titulo)' }}
      >
        {programa.nome}
      </span>
    </div>
  )

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)]"
      style={{
        background: 'var(--superficie)',
        opacity: bloqueado ? 0.55 : 1,
      }}
    >
      {capa}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Canal</dt>
            <dd className="text-[13px] font-bold text-[var(--texto)]">{programa.canal}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Vai ao ar</dt>
            <dd className="text-right text-[13px] font-bold text-[var(--texto)]">
              {diasPorExtenso(programa.dias_da_semana)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Ações por dia</dt>
            <dd className="text-[13px] font-bold text-[var(--texto)]">{programa.slots}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">
              Antecedência mínima
            </dt>
            {/*
              O handoff pede o valor em #F59E0B — mas #F59E0B como TEXTO
              sobre `--superficie` (branco) dá ≈2,3:1 de contraste, abaixo
              do mínimo de 4,5:1 (mesmo problema achado na revisão da Task
              10). `--prazo-texto` é o âmbar escuro já criado para essa
              revisão — ≈7,1:1 sobre branco — e é o que entra aqui em vez do
              tom literal do handoff.
            */}
            <dd className="text-[13px] font-bold" style={{ color: 'var(--prazo-texto)' }}>
              {programa.prazo_minimo_dias} dia{programa.prazo_minimo_dias === 1 ? '' : 's'}
            </dd>
          </div>
        </dl>

        {bloqueado ? (
          <div
            role="note"
            className="rounded-[10px] px-3 py-2"
            style={{ background: '#FDECEF' }}
          >
            <p className="text-[12px] font-bold" style={{ color: '#8B1030' }}>
              Indisponível para este cliente
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: '#8B1030' }}>
              {restricao}
            </p>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2">
            {programa.aceita_regional ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => aoEscolher('nacional')}
                    disabled={!permiteEscolha}
                    className="h-[38px] flex-1 rounded-[10px] text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: 'var(--marca)', cursor: permiteEscolha ? 'pointer' : 'not-allowed' }}
                  >
                    Nacional
                  </button>
                  <button
                    type="button"
                    onClick={() => aoEscolher('regional')}
                    disabled={!permiteEscolha || !regionalDisponivel}
                    title={motivoRegionalIndisponivel ?? undefined}
                    className="h-[38px] flex-1 rounded-[10px] border text-[13px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: 'var(--borda-forte)',
                      color: regionalDisponivel ? 'var(--texto)' : 'var(--texto-3)',
                      cursor: permiteEscolha && regionalDisponivel ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Regional
                  </button>
                </div>
                {!regionalDisponivel && motivoRegionalIndisponivel && (
                  // `--texto-3` (≈3,6:1 sobre branco) não bate o mínimo de
                  // 4,5:1 para texto — este parágrafo carrega a explicação
                  // de por que o botão está desabilitado, não é decoração,
                  // então usa `--texto-2` (≈5,6:1), que passa.
                  <p className="text-[11.5px] font-medium text-[var(--texto-2)]">
                    {motivoRegionalIndisponivel}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => aoEscolher('nacional')}
                disabled={!permiteEscolha}
                className="h-[38px] w-full rounded-[10px] text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--roxo)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'var(--marca)', cursor: permiteEscolha ? 'pointer' : 'not-allowed' }}
              >
                Ver calendário →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
