'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { excluirPrograma } from '@/lib/acoes/programas'
import { ConfirmacaoNomeada } from '@/components/comum/ConfirmacaoNomeada'
import type { Programa } from '@/lib/dominio/cadastro'

const ROTULOS_ESTADO: Record<Programa['estado'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_configuracao: 'Em configuração',
}

// Cor nunca é o único indicador de estado — o rótulo (`ROTULOS_ESTADO`) vai
// sempre junto da cor, na mesma etiqueta.
const CORES_ESTADO: Record<Programa['estado'], string> = {
  ativo: 'var(--disponivel)',
  inativo: 'var(--texto-3)',
  em_configuracao: 'var(--prazo)',
}

function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return '?'
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase()
  return `${palavras[0][0]}${palavras[palavras.length - 1][0]}`.toUpperCase()
}

function formatarData(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getFullYear()}`
}

type Props = {
  programa: Programa
  podeEditar: boolean
  podeExcluir: boolean
}

/**
 * Cartão de programa da grade de configurações — Task 9.
 *
 * Capa de 120px com a imagem do programa ou, na falta dela, o gradiente da
 * marca com as iniciais. Abaixo, nome, status (cor + texto, nunca só cor) e
 * "Modificado em", que vem de `programas.atualizado_em` — a coluna que a
 * migração da Entrega 2 acrescentou.
 *
 * O menu de três pontos traz Editar (quando a pessoa edita este programa —
 * `podeEditarPrograma`, Task 2) e, só para o proprietário, Excluir. Esconder
 * o botão é conveniência de interface: quem protege de verdade é o RLS de
 * `supabase/schema-entrega-2.sql` (policy "remocao proprietario") e a
 * checagem em `excluirPrograma`.
 */
export function CartaoDePrograma({ programa, podeEditar, podeExcluir }: Props) {
  const router = useRouter()
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAberto) return

    function aoClicarFora(evento: MouseEvent) {
      if (!menuRef.current?.contains(evento.target as Node)) {
        setMenuAberto(false)
      }
    }

    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [menuAberto])

  async function confirmarExclusao() {
    setExcluindo(true)
    setErro(null)

    const resultado = await excluirPrograma(programa.id)

    setExcluindo(false)

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }

    setModalAberto(false)
    router.refresh()
  }

  const capa = programa.imagem_url ? (
    <div
      role="img"
      aria-label={`Imagem de ${programa.nome}`}
      className="h-[120px] w-full rounded-t-[var(--raio-card)] bg-cover bg-center"
      style={{ backgroundImage: `url("${programa.imagem_url}")` }}
    />
  ) : (
    <div
      aria-hidden
      className="flex h-[120px] w-full items-center justify-center rounded-t-[var(--raio-card)] text-[28px] font-extrabold text-white"
      style={{ background: 'var(--marca)', fontFamily: 'var(--fonte-titulo)' }}
    >
      {iniciais(programa.nome)}
    </div>
  )

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)]"
      style={{ background: 'var(--superficie)' }}
    >
      {capa}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-[16px] font-bold leading-tight text-[var(--texto)]"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            {programa.nome}
          </h3>

          {(podeEditar || podeExcluir) && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuAberto}
                aria-label={`Mais ações para ${programa.nome}`}
                onClick={() => setMenuAberto((atual) => !atual)}
                className="flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[8px] text-[var(--texto-3)] hover:bg-[var(--superficie-suave)]"
              >
                ⋮
              </button>

              {menuAberto && (
                <div
                  role="menu"
                  className="absolute right-0 top-[32px] z-10 w-[160px] overflow-hidden rounded-[10px] border border-[var(--borda-forte)] bg-[var(--superficie)] shadow-[var(--sombra-janela)]"
                >
                  {podeEditar && (
                    <Link
                      role="menuitem"
                      href={`/configuracoes/programas/${programa.id}`}
                      onClick={() => setMenuAberto(false)}
                      className="block px-3 py-[9px] text-[13px] font-semibold text-[var(--texto)] hover:bg-[var(--superficie-suave)]"
                    >
                      Editar
                    </Link>
                  )}
                  {podeExcluir && (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenuAberto(false)
                        setModalAberto(true)
                      }}
                      className="block w-full cursor-pointer px-3 py-[9px] text-left text-[13px] font-semibold hover:bg-[var(--concorrencia-fundo)]"
                      style={{ color: 'var(--concorrencia)' }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <span
          className="w-fit rounded-full px-2.5 py-[3px] text-[11px] font-bold"
          style={{ color: CORES_ESTADO[programa.estado], background: 'var(--superficie-suave)' }}
        >
          {ROTULOS_ESTADO[programa.estado]}
        </span>

        <p className="text-[12px] text-[var(--texto-3)]">
          Modificado em {formatarData(programa.atualizado_em)}
        </p>

        <Link
          href={`/configuracoes/programas/${programa.id}`}
          className="mt-auto flex h-[36px] items-center justify-center rounded-[10px] text-[13px] font-bold text-white"
          style={{ background: 'var(--marca)' }}
        >
          Ver
        </Link>
      </div>

      {modalAberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`excluir-${programa.id}-titulo`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            className="flex w-full max-w-[440px] flex-col gap-4 rounded-[var(--raio-janela)] border border-[var(--borda)] p-6 shadow-[var(--sombra-janela)]"
            style={{ background: 'var(--superficie)' }}
          >
            <div>
              <h2
                id={`excluir-${programa.id}-titulo`}
                className="text-[18px] font-bold text-[var(--texto)]"
                style={{ fontFamily: 'var(--fonte-titulo)' }}
              >
                Excluir {programa.nome}?
              </h2>
              <p className="mt-2 text-[13px] leading-[1.5] text-[var(--texto-2)]">
                Esta é a única ação irreversível do sistema. Junto com o programa, o banco apaga
                em cascata:
              </p>
              <ul className="mt-2 list-disc pl-5 text-[13px] leading-[1.6] text-[var(--texto-2)]">
                <li>as datas bloqueadas deste programa;</li>
                <li>as restrições de anunciante cadastradas para ele;</li>
                <li>os preços regionais por praça;</li>
                <li>as ações regionais já vendidas.</li>
              </ul>
            </div>

            {erro && (
              <p
                role="alert"
                className="text-[12.5px] font-semibold"
                style={{ color: 'var(--concorrencia)' }}
              >
                {erro}
              </p>
            )}

            <ConfirmacaoNomeada
              nomeEsperado={programa.nome}
              aoConfirmar={confirmarExclusao}
              confirmando={excluindo}
            />

            <button
              type="button"
              disabled={excluindo}
              onClick={() => {
                setModalAberto(false)
                setErro(null)
              }}
              className="h-[40px] cursor-pointer rounded-[10px] border border-[var(--borda-forte)] text-[13px] font-semibold text-[var(--texto-2)] disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
