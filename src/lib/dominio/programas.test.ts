import { describe, it, expect } from 'vitest'
import { extrairMnemonico, montarIndice, encontrarProgramaId } from './programas'

const indice = montarIndice(
  [
    { id: 'p-mavo', mnemonico: 'MAVO' },
    { id: 'p-domi', mnemonico: 'DOMI' },
    { id: 'p-sfn', mnemonico: 'SFN' },
    { id: 'p-viver', mnemonico: 'VIVSER' },
  ],
  [{ programa_id: 'p-viver', texto: 'VIVER SERTANEJO' }],
)

describe('extrairMnemonico', () => {
  it('pega o trecho antes do primeiro hífen', () => {
    expect(extrairMnemonico('MAVO - MAIS VOCE')).toBe('MAVO')
    expect(extrairMnemonico('N20H - NOVELA III')).toBe('N20H')
  })

  it('ignora hifens posteriores e espaços extras', () => {
    expect(extrairMnemonico('SFN -  SPATEN FIGHT NIGHT - DUMMY')).toBe('SFN')
  })

  it('aceita mnemônico com espaço interno', () => {
    expect(extrairMnemonico('SÃO JULHÃO - MELHORES MOMENTOS')).toBe('SÃO JULHÃO')
  })

  it('devolve nulo quando não há hífen separador', () => {
    expect(extrairMnemonico('VIVER SERTANEJO')).toBeNull()
    expect(extrairMnemonico('')).toBeNull()
    expect(extrairMnemonico(null)).toBeNull()
  })
})

describe('encontrarProgramaId', () => {
  it('casa pelo mnemônico', () => {
    expect(encontrarProgramaId('MAVO - MAIS VOCE', indice)).toBe('p-mavo')
    expect(encontrarProgramaId('DOMI - DOMINGAO', indice)).toBe('p-domi')
  })

  // R6: os 4 programas que chegam sem mnemônico dependem do apelido
  it('cai para o apelido quando não há mnemônico', () => {
    expect(encontrarProgramaId('VIVER SERTANEJO', indice)).toBe('p-viver')
  })

  it('devolve nulo para programa não cadastrado', () => {
    expect(encontrarProgramaId('BREAK DE TERRITÓRIOS', indice)).toBeNull()
    expect(encontrarProgramaId('XPTO - INEXISTENTE', indice)).toBeNull()
  })
})
