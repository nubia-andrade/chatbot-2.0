import { describe, it, expect } from 'vitest'
import { montarMapa, normalizarFormato, categoriaDoFormato, ocupaSlot } from './formatos'

const mapa = montarMapa([
  { formato: 'AÇÃO PLENA', categoria: 'AÇÃO DE CONTEÚDO' },
  { formato: 'COMERCIAL BREAK', categoria: 'COMERCIAL' },
  { formato: 'QR CODE', categoria: 'INSERT' },
  { formato: 'COMERCIAL CONTEÚDO NO BREAK  DET PRIMEIRÍSSIMA', categoria: 'CONTEÚDO NO BREAK' },
])

describe('normalizarFormato', () => {
  it('coloca em maiúsculas, apara e colapsa espaços repetidos', () => {
    expect(normalizarFormato('  ação plena ')).toBe('AÇÃO PLENA')
    expect(normalizarFormato('COMERCIAL  BREAK')).toBe('COMERCIAL BREAK')
  })

  it('devolve string vazia para nulo e indefinido', () => {
    expect(normalizarFormato(null)).toBe('')
    expect(normalizarFormato(undefined)).toBe('')
  })
})

describe('categoriaDoFormato', () => {
  it('encontra a categoria cadastrada', () => {
    expect(categoriaDoFormato('AÇÃO PLENA', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('QR CODE', mapa)).toBe('INSERT')
  })

  it('casa mesmo com espaços duplicados no cadastro', () => {
    expect(categoriaDoFormato('COMERCIAL CONTEÚDO NO BREAK DET PRIMEIRÍSSIMA', mapa))
      .toBe('CONTEÚDO NO BREAK')
  })

  // R2: viés conservador — o desconhecido ocupa slot
  it('resolve vazio, traço e desconhecido para AÇÃO DE CONTEÚDO', () => {
    expect(categoriaDoFormato('', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('-', mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato(null, mapa)).toBe('AÇÃO DE CONTEÚDO')
    expect(categoriaDoFormato('FORMATO QUE AINDA NÃO EXISTE', mapa)).toBe('AÇÃO DE CONTEÚDO')
  })
})

describe('ocupaSlot', () => {
  // R1: só ação de conteúdo consome slot
  it('só é verdadeiro para AÇÃO DE CONTEÚDO', () => {
    expect(ocupaSlot('AÇÃO PLENA', mapa)).toBe(true)
    expect(ocupaSlot('COMERCIAL BREAK', mapa)).toBe(false)
    expect(ocupaSlot('QR CODE', mapa)).toBe(false)
  })

  it('é verdadeiro para formato desconhecido', () => {
    expect(ocupaSlot('-', mapa)).toBe(true)
  })
})
