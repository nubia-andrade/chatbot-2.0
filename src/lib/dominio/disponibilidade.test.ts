import { describe, it, expect } from 'vitest'
import { diasDoMes, calcularDisponibilidadeDoMes, type InsumosDeDisponibilidade } from './disponibilidade'
import { montarMapa } from './formatos'
import { indexarAnunciantes } from './casamento-anunciante'

const FORMATOS = montarMapa([
  { formato: 'ACAO DE CONTEUDO', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL', categoria: 'COMERCIAL' },
])

// MAVO: vai ao ar de segunda a sexta (1..5), 2 slots por dia, 3 dias de prazo.
const mavo = {
  id: 'p-1',
  mnemonico: 'MAVO',
  dias_da_semana: [1, 2, 3, 4, 5],
  slots: 2,
  bloqueio_mensal: 0,
  prazo_minimo_dias: 3,
  custo_midia_tv: 100000,
  custo_producao_tv: 5000,
  percentual_simulcast: null,
  aceita_regional: false,
  dia_da_semana_regional: null,
  prazo_minimo_regional_dias: null,
  max_pracas_por_acao: 3,
  custo_producao_regional: null,
  bloqueio_mensal_regional: 0,
}

const carteira = [
  { nome: 'COCA-COLA', setor: 'Bebidas', industria: 'Refrigerantes' },
  { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' },
  { nome: 'NESTLE', setor: 'Alimentos', industria: 'Chocolates' },
]

function insumos(ajustes: Partial<InsumosDeDisponibilidade> = {}): InsumosDeDisponibilidade {
  return {
    ano: 2026,
    mes: 9,
    hojeIso: '2026-08-16',
    modalidade: 'nacional',
    programa: mavo,
    cliente: { nome: 'PEPSI', setor: 'Bebidas', industria: 'Refrigerantes' },
    formatos: FORMATOS,
    acoesVendidas: [],
    acoesRegionais: [],
    bloqueios: [],
    periodosEspeciais: [],
    indiceDeAnunciantes: indexarAnunciantes(carteira),
    precosRegionais: [],
    ...ajustes,
  }
}

function dia(dias: ReturnType<typeof calcularDisponibilidadeDoMes>, data: string) {
  const achado = dias.find((d) => d.data === data)
  if (!achado) throw new Error(`Dia ${data} não veio no resultado`)
  return achado
}

describe('diasDoMes', () => {
  it('gera todos os dias do mês em ISO', () => {
    const dias = diasDoMes(2026, 2)
    expect(dias).toHaveLength(28)
    expect(dias[0]).toBe('2026-02-01')
    expect(dias[27]).toBe('2026-02-28')
  })

  it('acerta mês de 31 dias', () => {
    expect(diasDoMes(2026, 12)).toHaveLength(31)
  })
})

describe('calcularDisponibilidadeDoMes — nacional', () => {
  it('devolve um item por dia do mês', () => {
    expect(calcularDisponibilidadeDoMes(insumos())).toHaveLength(30)
  })

  // R10: dia fora da grade não é "esgotado", é ausência de inventário.
  it('sábado e domingo ficam sem exibição', () => {
    const dias = calcularDisponibilidadeDoMes(insumos())
    expect(dia(dias, '2026-09-05').estado).toBe('sem_exibicao') // sábado
    expect(dia(dias, '2026-09-06').estado).toBe('sem_exibicao') // domingo
    expect(dia(dias, '2026-09-05').total).toBe(0)
  })

  it('dia útil sem venda fica disponível com todos os slots', () => {
    const terca = dia(calcularDisponibilidadeDoMes(insumos()), '2026-09-08')
    expect(terca.estado).toBe('disponivel')
    expect(terca.livres).toBe(2)
    expect(terca.total).toBe(2)
  })

  // R1: só formato de categoria AÇÃO DE CONTEÚDO ocupa slot.
  it('conta só ação de conteúdo como ocupação', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'COMERCIAL', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').livres).toBe(1)
  })

  it('slots todos vendidos deixam o dia esgotado', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('esgotado')
    expect(dia(dias, '2026-09-08').livres).toBe(0)
  })

  // R14: concorrência é calculada, não cadastrada. PEPSI e COCA-COLA
  // compartilham setor e indústria.
  it('concorrente vendido na data fecha a data, e nomeia quem é', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'COCA-COLA *' },
        ],
      }),
    )
    const terca = dia(dias, '2026-09-08')
    expect(terca.estado).toBe('concorrencia')
    expect(terca.motivos.join(' ')).toContain('COCA-COLA')
  })

  it('cliente de outra categoria não gera concorrência', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('disponivel')
  })

  // Anunciante que não casa com a carteira NÃO bloqueia — só avisa.
  it('anunciante desconhecido não bloqueia, mas conta como não verificado', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        acoesVendidas: [
          { programa: 'MAVO - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'PORTO SEGURO' },
        ],
      }),
    )
    const terca = dia(dias, '2026-09-08')
    expect(terca.estado).toBe('disponivel')
    expect(terca.acoes_sem_classificacao).toBe(1)
  })

  // R11: prazo mínimo de 3 dias a partir de 16/08.
  it('data dentro do prazo mínimo fica fora do prazo', () => {
    const dias = calcularDisponibilidadeDoMes(insumos({ ano: 2026, mes: 8 }))
    expect(dia(dias, '2026-08-17').estado).toBe('fora_do_prazo')
    expect(dia(dias, '2026-08-18').estado).toBe('fora_do_prazo')
    expect(dia(dias, '2026-08-19').estado).toBe('disponivel')
  })

  // R12: data bloqueada, com o motivo cadastrado à vista.
  it('data bloqueada fecha, com o motivo', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({ bloqueios: [{ data: '2026-09-08', motivo: 'Reprise' }] }),
    )
    expect(dia(dias, '2026-09-08').estado).toBe('bloqueado')
    expect(dia(dias, '2026-09-08').motivos).toContain('Reprise')
  })

  // Os motivos se acumulam; a cor, não. Prazo vem primeiro para não furar a
  // faixa contígua do começo do mês.
  it('data fora do prazo E bloqueada pinta pelo prazo e guarda os dois motivos', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({ ano: 2026, mes: 8, bloqueios: [{ data: '2026-08-17', motivo: 'Reprise' }] }),
    )
    const dezessete = dia(dias, '2026-08-17')
    expect(dezessete.estado).toBe('fora_do_prazo')
    expect(dezessete.motivos).toHaveLength(2)
    expect(dezessete.motivos.join(' ')).toContain('Reprise')
  })

  // R16: teto mensal fecha o mês inteiro.
  it('teto mensal atingido fecha os dias restantes do mês', () => {
    const vendidas = ['2026-09-01', '2026-09-02', '2026-09-03'].map((data) => ({
      programa: 'MAVO - MAIS VOCE',
      data_de_exibicao: data,
      formato: 'ACAO DE CONTEUDO',
      anunciante: 'NESTLE',
    }))
    const dias = calcularDisponibilidadeDoMes(
      insumos({ programa: { ...mavo, bloqueio_mensal: 3 }, acoesVendidas: vendidas }),
    )
    const oito = dia(dias, '2026-09-08')
    expect(oito.estado).toBe('bloqueado')
    expect(oito.motivos.join(' ')).toContain('mês')
  })

  // Feriado é ilustração: nomeia e não interfere.
  it('feriado aparece nomeado sem alterar o estado', () => {
    const dias = calcularDisponibilidadeDoMes(insumos())
    const sete = dia(dias, '2026-09-07') // Independência, uma segunda-feira
    expect(sete.feriado).toBe('Independência')
    expect(sete.estado).toBe('disponivel')
    expect(sete.motivos).toEqual([])
  })

  it('o valor do dia soma mídia, direitos e produção', () => {
    // 100.000 + 15.000 + 5.000
    expect(dia(calcularDisponibilidadeDoMes(insumos()), '2026-09-08').valor_unitario).toBe(120000)
  })

  it('período especial aparece nomeado e sobe o valor', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        periodosEspeciais: [
          { nome: 'Black Friday', data_inicio: '2026-09-07', data_fim: '2026-09-11', percentual_acrescimo: 20 },
        ],
      }),
    )
    const oito = dia(dias, '2026-09-08')
    expect(oito.periodo_especial).toEqual({ nome: 'Black Friday', percentual: 20 })
    // 120.000 +20% na mídia → 120.000 + 18.000 + 5.000
    expect(oito.valor_unitario).toBe(143000)
  })

  // Ruling de pré-voo (R6): 4 dos 23 programas chegam da API sem mnemônico e
  // dependem de apelido cadastrado em `programa_apelidos`. Sem esta correção,
  // uma ação como "MAIS VOCE" (sem "MNEMONICO - ") nunca casaria com o
  // programa e o calendário mostraria disponibilidade sempre cheia — o pior
  // erro possível, porque vende espaço já vendido.
  it('ação sem mnemônico casa pelo apelido cadastrado', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        apelidosDoPrograma: ['MAIS VOCE'],
        acoesVendidas: [
          { programa: 'MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').livres).toBe(1)
  })

  // Fix de revisão: `extrairMnemonico` pode devolver um mnemônico que NÃO é
  // o deste programa (prefixação inconsistente da própria API é a razão de
  // apelido existir), e mesmo assim o texto integral estar cadastrado como
  // apelido. `acoesDoPrograma` precisa cair para o apelido neste caso, igual
  // a `encontrarProgramaId` — não pode parar no primeiro `return` só porque
  // extraiu ALGUM mnemônico.
  it('ação com prefixo de mnemônico errado ainda casa pelo apelido cadastrado do texto integral', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        apelidosDoPrograma: ['MV - MAIS VOCE'],
        acoesVendidas: [
          { programa: 'MV - MAIS VOCE', data_de_exibicao: '2026-09-08', formato: 'ACAO DE CONTEUDO', anunciante: 'NESTLE' },
        ],
      }),
    )
    expect(dia(dias, '2026-09-08').livres).toBe(1)
  })

  // Fix de revisão: R15 (provisório) diz que a ação regional consome também
  // um slot nacional do dia — a contagem mensal do teto nacional (R16)
  // precisa enxergar esse consumo, ou o motor fica cego para algo que ele
  // mesmo contabiliza dia a dia. Uma ação regional distinta (data + cliente)
  // conta como uma ação para o teto mensal nacional.
  it('ação regional conta para o teto mensal nacional', () => {
    const dias = calcularDisponibilidadeDoMes(
      insumos({
        programa: { ...mavo, bloqueio_mensal: 1 },
        acoesRegionais: [
          { data_de_exibicao: '2026-09-01', praca_codigo: 'SP', cliente_nome: 'NESTLE' },
        ],
      }),
    )
    const oito = dia(dias, '2026-09-08')
    expect(oito.estado).toBe('bloqueado')
    expect(oito.motivos.join(' ')).toContain('mês')
  })
})
