'use client'

import { useMemo, useState } from 'react'
import type { PontoEvolucaoMensal } from '@/lib/dados/performance'

type Props = {
  titulo: string
  subtitulo?: string
  pontos: PontoEvolucaoMensal[]
}

type Periodo = 6 | 12

const LARGURA = 920
const ALTURA = 158
const MARGEM = { topo: 10, direita: 16, baixo: 26, esquerda: 60 }
const LARGURA_PLOT = LARGURA - MARGEM.esquerda - MARGEM.direita
const ALTURA_PLOT = ALTURA - MARGEM.topo - MARGEM.baixo

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(valor)
}

function moedaCompacta(valor: number): string {
  if (valor >= 1_000_000_000) return `R$ ${(valor / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `R$ ${Math.round(valor).toLocaleString('pt-BR')}`
}

function tetoBonito(valor: number): number {
  if (valor <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(valor))
  const normalizado = valor / potencia
  const fator = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10
  return fator * potencia
}

function pontosDaLinha(valores: number[], maximo: number): string {
  if (valores.length === 0) return ''
  return valores.map((valor, indice) => {
    const x = MARGEM.esquerda + (valores.length === 1 ? LARGURA_PLOT / 2 : (indice / (valores.length - 1)) * LARGURA_PLOT)
    const y = MARGEM.topo + ALTURA_PLOT - (valor / maximo) * ALTURA_PLOT
    return `${x},${y}`
  }).join(' ')
}

function coordenadaX(indice: number, quantidade: number): number {
  return MARGEM.esquerda + (quantidade === 1 ? LARGURA_PLOT / 2 : (indice / (quantidade - 1)) * LARGURA_PLOT)
}

function coordenadaY(valor: number, maximo: number): number {
  return MARGEM.topo + ALTURA_PLOT - (valor / maximo) * ALTURA_PLOT
}

export function GraficoEvolucaoComercial({ titulo, subtitulo, pontos }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>(6)
  const pontosVisiveis = useMemo(() => pontos.slice(-periodo), [pontos, periodo])
  const maiorValor = Math.max(0, ...pontosVisiveis.flatMap((ponto) => [ponto.ofertado, ponto.vendido]))
  const maximo = tetoBonito(maiorValor)
  const temDados = pontosVisiveis.some((ponto) => ponto.ofertado > 0 || ponto.vendido > 0)
  const grade = [0, 0.5, 1]
  const pontosOfertado = pontosDaLinha(pontosVisiveis.map((ponto) => ponto.ofertado), maximo)
  const pontosVendido = pontosDaLinha(pontosVisiveis.map((ponto) => ponto.vendido), maximo)

  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <h3 className="text-[13px] font-bold text-[var(--texto)]">{titulo}</h3>
          <p className="mt-0.5 text-[9.5px] leading-[1.35] text-[var(--texto-3)]">
            Últimos {periodo} meses · {subtitulo ?? 'Ofertado x Vendido pelo mês de criação da proposta.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2.5 text-[9.5px] font-semibold text-[var(--texto-2)]">
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[var(--roxo)]" /> Ofertado</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#17966F]" /> Vendido</span>
          </div>

          <div className="inline-flex rounded-[7px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-0.5" aria-label="Período do gráfico">
            {([6, 12] as Periodo[]).map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setPeriodo(opcao)}
                aria-pressed={periodo === opcao}
                className={`rounded-[5px] px-2 py-0.5 text-[9px] font-bold transition ${
                  periodo === opcao
                    ? 'bg-white text-[var(--roxo)] shadow-sm'
                    : 'text-[var(--texto-3)] hover:text-[var(--texto-2)]'
                }`}
              >
                {opcao}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {!temDados ? (
        <div className="flex h-[120px] items-center justify-center text-center">
          <div>
            <p className="text-[11.5px] font-bold text-[var(--texto)]">Ainda não há histórico suficiente</p>
            <p className="mt-1 text-[10px] text-[var(--texto-3)]">A evolução aparecerá conforme propostas forem geradas e negociações forem fechadas.</p>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 overflow-x-auto">
          <svg
            role="img"
            aria-label={`${titulo}: evolução mensal de valores ofertados e vendidos`}
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            className="min-w-[560px] w-full"
          >
            {grade.map((fracao) => {
              const valor = maximo * fracao
              const y = coordenadaY(valor, maximo)
              return (
                <g key={fracao}>
                  <line
                    x1={MARGEM.esquerda}
                    x2={LARGURA - MARGEM.direita}
                    y1={y}
                    y2={y}
                    stroke="#F0EEF4"
                    strokeWidth="1"
                  />
                  <text
                    x={MARGEM.esquerda - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="8.5"
                    fill="#99949F"
                  >
                    {moedaCompacta(valor)}
                  </text>
                </g>
              )
            })}

            {pontosVisiveis.map((ponto, indice) => {
              const x = coordenadaX(indice, pontosVisiveis.length)
              return (
                <text
                  key={ponto.mes}
                  x={x}
                  y={ALTURA - 7}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#99949F"
                >
                  {ponto.rotulo}
                </text>
              )
            })}

            <polyline
              points={pontosOfertado}
              fill="none"
              stroke="#8A2BE2"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={pontosVendido}
              fill="none"
              stroke="#17966F"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {pontosVisiveis.map((ponto, indice) => {
              const x = coordenadaX(indice, pontosVisiveis.length)
              const yOfertado = coordenadaY(ponto.ofertado, maximo)
              const yVendido = coordenadaY(ponto.vendido, maximo)
              return (
                <g key={`${ponto.mes}-pontos`}>
                  <circle cx={x} cy={yOfertado} r="2.6" fill="#FFFFFF" stroke="#8A2BE2" strokeWidth="1.7">
                    <title>{`${ponto.rotulo} · Ofertado: ${moeda(ponto.ofertado)} · ${ponto.propostas} proposta${ponto.propostas === 1 ? '' : 's'}`}</title>
                  </circle>
                  <circle cx={x} cy={yVendido} r="2.6" fill="#FFFFFF" stroke="#17966F" strokeWidth="1.7">
                    <title>{`${ponto.rotulo} · Vendido: ${moeda(ponto.vendido)} · ${ponto.fechadas} fechada${ponto.fechadas === 1 ? '' : 's'}`}</title>
                  </circle>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      <p className="mt-0.5 text-[9px] leading-[1.3] text-[var(--texto-3)]">
        Vendido usa o valor final negociado das propostas fechadas e permanece no mês em que a proposta foi criada.
      </p>
    </section>
  )
}
