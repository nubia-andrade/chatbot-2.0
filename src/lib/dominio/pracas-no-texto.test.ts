import { describe, it, expect } from 'vitest'
import { pracasNoTexto } from './pracas-no-texto'

describe('pracasNoTexto', () => {
  it('reconhece praça única depois de traço', () => {
    expect(pracasNoTexto('Ação regional - RJ')).toEqual(['RJ'])
  })

  it('reconhece duas praças separadas por barra', () => {
    expect(pracasNoTexto('Ação regional SP/BH')).toEqual(['SP', 'BH'])
  })

  it('reconhece praça entre parênteses com rótulo', () => {
    expect(pracasNoTexto('Ação regional (praça: SP) com LED, QR Code')).toEqual(['SP'])
  })

  it('reconhece lista com "e"', () => {
    expect(pracasNoTexto('Ação regional (RJ, SP e DF) no sofánews')).toEqual(['SP', 'RJ', 'DF'])
  })

  it('trata SP1 como SP', () => {
    expect(pracasNoTexto('AÇÃO REGIONAL - PRAÇA SP1')).toEqual(['SP'])
  })

  it('trata PE1 como PE1', () => {
    expect(pracasNoTexto('Ação regional na praça PE1.')).toEqual(['PE1'])
  })

  it('reconhece soma com sinal de mais', () => {
    expect(pracasNoTexto('Ação regional para SP1, RJ + BH')).toEqual(['SP', 'RJ', 'BH'])
  })

  it('devolve vazio quando não há praça no texto', () => {
    expect(pracasNoTexto('Ação regional com speech, LED e QR Code.')).toEqual([])
  })

  it('devolve vazio para texto ausente', () => {
    expect(pracasNoTexto(null)).toEqual([])
    expect(pracasNoTexto('-')).toEqual([])
  })

  it('não confunde sigla dentro de palavra', () => {
    expect(pracasNoTexto('Ação no ESPORTE com DFX e BHZ')).toEqual([])
  })

  it('devolve na ordem canônica, sem repetir', () => {
    expect(pracasNoTexto('regional BH, SP, BH e RJ')).toEqual(['SP', 'RJ', 'BH'])
  })
})
