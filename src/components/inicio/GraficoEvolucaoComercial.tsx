import type { PontoEvolucaoMensal } from '@/lib/dados/performance'

type Props = {
  titulo: string
  subtitulo?: string
  pontos: PontoEvolucaoMensal[]
}

const LARGURA = 920
const ALTURA = 300
const MARGEM = { topo: 28, direita: 24, baixo: 48, esquerda: 72 }
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
  const maiorValor = Math.max(0, ...pontos.flatMap((ponto) => [ponto.ofertado, ponto.vendido]))
  const maximo = tetoBonito(maiorValor)
  const temDados = pontos.some((ponto) => ponto.ofertado > 0 || ponto.vendido > 0)
  const grade = [0, 0.25, 0.5, 0.75, 1]
  const pontosOfertado = pontosDaLinha(pontos.map((ponto) => ponto.ofertado), maximo)
  const pontosVendido = pontosDaLinha(pontos.map((ponto) => ponto.vendido), maximo)

  return (
    <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-bold text-[var(--texto)]">{titulo}</h3>
          <p className="mt-1 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">
            {subtitulo ?? 'Últimos 12 meses · valores agrupados pela data de criação da proposta vigente.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10.5px] font-semibold text-[var(--texto-2)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--roxo)]" /> Ofertado</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#17966F]" /> Vendido</span>
        </div>
      </div>

      {!temDados ? (
        <div className="flex h-[260px] items-center justify-center text-center">
          <div>
            <p className="text-[12.5px] font-bold text-[var(--texto)]">Ainda não há histórico suficiente</p>
            <p className="mt-1 text-[11px] text-[var(--texto-3)]">A evolução aparecerá conforme propostas forem geradas e negociações forem fechadas.</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <svg
            role="img"
            aria-label={`${titulo}: evolução mensal de valores ofertados e vendidos`}
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            className="min-w-[760px] w-full"
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
                    stroke="#E7E4EC"
                    strokeWidth="1"
                  />
                  <text
                    x={MARGEM.esquerda - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#77727F"
                  >
                    {moedaCompacta(valor)}
                  </text>
                </g>
              )
            })}

            {pontos.map((ponto, indice) => {
              const x = coordenadaX(indice, pontos.length)
              return (
                <text
                  key={ponto.mes}
                  x={x}
                  y={ALTURA - 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#77727F"
                >
                  {ponto.rotulo}
                </text>
              )
            })}

            <polyline
              points={pontosOfertado}
              fill="none"
              stroke="#8A2BE2"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={pontosVendido}
              fill="none"
              stroke="#17966F"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {pontos.map((ponto, indice) => {
              const x = coordenadaX(indice, pontos.length)
              const yOfertado = coordenadaY(ponto.ofertado, maximo)
              const yVendido = coordenadaY(ponto.vendido, maximo)
              return (
                <g key={`${ponto.mes}-pontos`}>
                  <circle cx={x} cy={yOfertado} r="4.5" fill="#FFFFFF" stroke="#8A2BE2" strokeWidth="2.5">
                    <title>{`${ponto.rotulo} · Ofertado: ${moeda(ponto.ofertado)} · ${ponto.propostas} proposta${ponto.propostas === 1 ? '' : 's'}`}</title>
                  </circle>
                  <circle cx={x} cy={yVendido} r="4.5" fill="#FFFFFF" stroke="#17966F" strokeWidth="2.5">
                    <title>{`${ponto.rotulo} · Vendido: ${moeda(ponto.vendido)} · ${ponto.fechadas} fechada${ponto.fechadas === 1 ? '' : 's'}`}</title>
                  </circle>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      <p className="mt-2 text-[10px] leading-[1.45] text-[var(--texto-3)]">
        Vendido considera o valor final negociado das propostas fechadas e permanece no mês em que a proposta foi criada, mesmo que o fechamento aconteça depois.
      </p>
    </section>
  )
}
