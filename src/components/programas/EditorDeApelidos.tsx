'use client'

import { useState } from 'react'
import { salvarApelidos } from '@/lib/acoes/programas'
import type { Apelido } from '@/lib/dados/programas'

type Props = {
  programaId: string
  apelidosIniciais: Apelido[]
}

/**
 * Editor de apelidos — Task 11, Step 5.
 *
 * R6: o campo `programa` da API vendida chega como `MNEMONICO - NOME`, mas
 * quatro dos 23 programas chegam sem o mnemônico. Sem um apelido cadastrado
 * com o texto exato que a API manda, esse programa fica invisível ao
 * cálculo de ocupação — daí o texto de ajuda abaixo.
 *
 * Cada adição ou remoção grava na hora (`salvarApelidos` manda a lista
 * inteira e desejada), sem um botão "Salvar" à parte: a lista de apelidos é
 * pequena o bastante para não precisar de rascunho.
 */
export function EditorDeApelidos({ programaId, apelidosIniciais }: Props) {
  const [apelidos, setApelidos] = useState<string[]>(apelidosIniciais.map((a) => a.texto))
  const [novoApelido, setNovoApelido] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function persistir(proximos: string[]) {
    setSalvando(true)
    setErro(null)

    const resultado = await salvarApelidos(programaId, proximos)

    setSalvando(false)

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }

    setApelidos(proximos)
  }

  function adicionar() {
    const texto = novoApelido.trim()
    if (texto === '' || apelidos.some((a) => a.toLowerCase() === texto.toLowerCase())) return

    setNovoApelido('')
    void persistir([...apelidos, texto])
  }

  function remover(texto: string) {
    void persistir(apelidos.filter((a) => a !== texto))
  }

  return (
    <section
      className="rounded-[var(--raio-card)] border border-[var(--borda)] p-6"
      style={{ background: 'var(--superficie)' }}
    >
      <h2 className="text-[16px] font-bold text-[var(--texto)]">Apelidos</h2>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--texto-3)]">
        Use apelidos quando o nome do programa chegar da API sem o mnemônico — por exemplo,
        VIVER SERTANEJO.
      </p>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(evento) => {
          evento.preventDefault()
          adicionar()
        }}
      >
        <input
          value={novoApelido}
          onChange={(evento) => setNovoApelido(evento.target.value)}
          placeholder="Ex.: VIVER SERTANEJO"
          disabled={salvando}
          className="h-[38px] flex-1 rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
        />
        <button
          type="submit"
          disabled={salvando || novoApelido.trim() === ''}
          className="h-[38px] cursor-pointer rounded-[10px] border border-[var(--borda-forte)] px-4 text-[12.5px] font-bold text-[var(--roxo)] enabled:hover:bg-[var(--superficie-suave)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Adicionar
        </button>
      </form>

      {erro && (
        <p
          role="alert"
          className="mt-3 text-[12.5px] font-semibold"
          style={{ color: 'var(--concorrencia)' }}
        >
          {erro}
        </p>
      )}

      {apelidos.length === 0 ? (
        <p className="mt-4 text-[13px] text-[var(--texto-3)]">Nenhum apelido cadastrado.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {apelidos.map((texto) => (
            <li
              key={texto}
              className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--borda)] px-3 py-2"
              style={{ background: 'var(--superficie-suave)' }}
            >
              <span className="text-[13px] text-[var(--texto)]">{texto}</span>
              <button
                type="button"
                disabled={salvando}
                onClick={() => remover(texto)}
                className="cursor-pointer text-[12px] font-semibold enabled:hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: 'var(--concorrencia)' }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
