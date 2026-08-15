import { describe, expect, it } from 'vitest'
import { lerPaginado, TAMANHO_DA_PAGINA } from './paginacao'

/**
 * Simula o PostgREST: guarda `total` linhas e devolve só a fatia pedida,
 * cortando em `TAMANHO_DA_PAGINA` como o Supabase faz.
 */
function bancoFalso(total: number) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i }))
  const faixas: [number, number][] = []

  return {
    faixas,
    buscar(de: number, ate: number) {
      faixas.push([de, ate])
      const limite = Math.min(ate, de + TAMANHO_DA_PAGINA - 1)
      return Promise.resolve({ data: linhas.slice(de, limite + 1), error: null })
    },
  }
}

describe('lerPaginado', () => {
  it('traz tudo quando cabe numa página só', async () => {
    const banco = bancoFalso(10)
    const { linhas, erro } = await lerPaginado(banco.buscar)

    expect(erro).toBeNull()
    expect(linhas).toHaveLength(10)
    expect(banco.faixas).toEqual([[0, 999]])
  })

  it('não para na milésima linha — o defeito que motivou esta função', async () => {
    const banco = bancoFalso(2500)
    const { linhas, erro } = await lerPaginado(banco.buscar)

    expect(erro).toBeNull()
    expect(linhas).toHaveLength(2500)
    expect(linhas.at(-1)).toEqual({ id: 2499 })
    expect(banco.faixas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('faz uma requisição a mais quando o total é múltiplo exato da página', async () => {
    const banco = bancoFalso(2000)
    const { linhas } = await lerPaginado(banco.buscar)

    expect(linhas).toHaveLength(2000)
    expect(banco.faixas).toHaveLength(3)
  })

  it('devolve tabela vazia sem erro', async () => {
    const { linhas, erro } = await lerPaginado(bancoFalso(0).buscar)

    expect(linhas).toEqual([])
    expect(erro).toBeNull()
  })

  it('para no primeiro erro e devolve a mensagem', async () => {
    let chamadas = 0
    const { linhas, erro } = await lerPaginado<{ id: number }>((de) => {
      chamadas += 1
      if (de === 0) {
        return Promise.resolve({
          data: Array.from({ length: TAMANHO_DA_PAGINA }, (_, i) => ({ id: i })),
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: { message: 'conexão caiu' } })
    })

    expect(erro).toBe('conexão caiu')
    expect(chamadas).toBe(2)
    expect(linhas).toHaveLength(TAMANHO_DA_PAGINA)
  })
})
