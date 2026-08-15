'use client'

import { useId, useState } from 'react'

type Props = {
  nomeEsperado: string
  aoConfirmar: () => void
  rotuloBotao?: string
  confirmando?: boolean
}

/**
 * Confirmação nomeada — exigida antes de qualquer ação irreversível desta
 * entrega (hoje, só a exclusão de programa, que leva junto datas
 * bloqueadas, restrições, preços e ações regionais).
 *
 * O botão destrutivo só habilita quando o texto digitado bate exatamente
 * com `nomeEsperado`. Não é fricção gratuita: obriga a pessoa a ler o nome
 * do que está prestes a apagar, em vez de clicar em "Excluir" por reflexo
 * num modal genérico.
 */
export function ConfirmacaoNomeada({
  nomeEsperado,
  aoConfirmar,
  rotuloBotao = 'Excluir',
  confirmando = false,
}: Props) {
  const idCampo = useId()
  const [digitado, setDigitado] = useState('')

  const confere = digitado === nomeEsperado
  const idErro = `${idCampo}-ajuda`

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={idCampo} className="mb-[7px] block text-[12px] font-semibold text-[var(--texto-2)]">
          Digite <strong>{nomeEsperado}</strong> para confirmar
        </label>
        <input
          id={idCampo}
          type="text"
          autoComplete="off"
          value={digitado}
          onChange={(evento) => setDigitado(evento.target.value)}
          aria-describedby={idErro}
          aria-invalid={digitado !== '' && !confere}
          className="h-[44px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[14px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
        />
        <p id={idErro} className="mt-[6px] text-[12px] text-[var(--texto-3)]">
          {digitado === ''
            ? `Esta ação não pode ser desfeita.`
            : confere
              ? '✓ Nome conferido.'
              : '✗ O texto ainda não bate com o nome do programa.'}
        </p>
      </div>

      <button
        type="button"
        disabled={!confere || confirmando}
        onClick={aoConfirmar}
        aria-disabled={!confere || confirmando}
        className="h-[44px] rounded-[12px] px-5 text-[14px] font-bold text-white enabled:cursor-pointer disabled:opacity-50"
        style={{ background: 'var(--concorrencia)' }}
      >
        {confirmando ? 'Excluindo…' : rotuloBotao}
      </button>
    </div>
  )
}
