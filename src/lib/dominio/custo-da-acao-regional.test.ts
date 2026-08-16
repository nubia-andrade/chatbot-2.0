import { describe, it, expect } from 'vitest'
import { calcularCustoDaAcaoRegional, type PrecoDaPracaParaCalculo } from './custo-da-acao-regional'

// Valores reais do É de Casa (docs/regras-acoes-regionais.md / supabase/seed-regional.sql):
// SP 53.000, RJ 31.000, BH 13.000, produção regional 7.910. Sem simulcast
// cadastrado em nenhuma praça hoje (percentual_simulcast fica ausente).
const PRECOS_EDC: PrecoDaPracaParaCalculo[] = [
  { praca_codigo: 'SP', custo_midia_tv: 53000 },
  { praca_codigo: 'RJ', custo_midia_tv: 31000 },
  { praca_codigo: 'BH', custo_midia_tv: 13000 },
]

const PRODUCAO_EDC = 7910

describe('calcularCustoDaAcaoRegional', () => {
  it('uma praça: mídia + direitos (15%) + produção', () => {
    // SP: 53.000 + 15% de 53.000 (7.950) + 7.910 de produção = 68.860
    expect(calcularCustoDaAcaoRegional(['SP'], PRECOS_EDC, PRODUCAO_EDC)).toBe(68860)
  })

  it('três praças: a produção entra UMA vez, não multiplicada por praça', () => {
    // SP: 53.000 + 7.950 = 60.950
    // RJ: 31.000 + 4.650 = 35.650
    // BH: 13.000 + 1.950 = 14.950
    // soma das praças = 111.550; + 7.910 de produção (uma vez só) = 119.460
    const total = calcularCustoDaAcaoRegional(['SP', 'RJ', 'BH'], PRECOS_EDC, PRODUCAO_EDC)
    expect(total).toBe(119460)

    // Prova negativa: se a produção fosse (erradamente) somada por praça,
    // o total seria 111.550 + 3 × 7.910 = 135.280 — bem diferente do valor
    // correto acima.
    expect(total).not.toBe(111550 + 3 * PRODUCAO_EDC)
  })

  it('produção ausente (null) não impede o cálculo — entra como 0', () => {
    expect(calcularCustoDaAcaoRegional(['SP'], PRECOS_EDC, null)).toBe(60950)
    expect(calcularCustoDaAcaoRegional(['SP'], PRECOS_EDC, undefined)).toBe(60950)
  })

  it('praça sem preço cadastrado contribui 0 de mídia, mas a produção ainda entra', () => {
    // DF pedida, mas sem linha em `precos` — mídia e direitos ficam 0;
    // a produção regional (por programa) é cobrada mesmo assim.
    expect(calcularCustoDaAcaoRegional(['DF'], [], PRODUCAO_EDC)).toBe(7910)
  })

  it('lista de praças vazia devolve 0 — sem praça comprada não há ação, nem produção', () => {
    expect(calcularCustoDaAcaoRegional([], PRECOS_EDC, PRODUCAO_EDC)).toBe(0)
  })
})
