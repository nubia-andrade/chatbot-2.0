'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { sair } from '@/lib/autenticacao'
import type { Perfil, SecaoApp } from '@/lib/dominio/perfis'

type Props = {
  nome: string
  perfis: Perfil[]
  secoes: SecaoApp[]
}

type ItemMenu = { href: string; rotulo: string; rotuloMobile: string; secao: SecaoApp }

const ITENS_MENU: ItemMenu[] = [
  { href: '/inicio', rotulo: 'Início', rotuloMobile: 'Início', secao: 'inicio' },
  { href: '/consulta', rotulo: 'Nova consulta', rotuloMobile: 'Consulta', secao: 'consulta' },
  { href: '/propostas', rotulo: 'Propostas', rotuloMobile: 'Propostas', secao: 'propostas' },
  { href: '/aprovacoes', rotulo: 'Aprovações', rotuloMobile: 'Aprovar', secao: 'aprovacoes' },
  { href: '/configuracoes', rotulo: 'Configurações', rotuloMobile: 'Config.', secao: 'configuracoes' },
]

const ROTULOS_PERFIL: Record<Perfil, string> = {
  executivo: 'Executiva comercial',
  executivo_regional: 'Regional',
  consultor_programa: 'Consultora de programa',
  proprietario: 'Proprietária',
}

/** Menu responsivo. As rotas e o RLS continuam sendo a proteção efetiva. */
export function BarraLateral({ nome, perfis, secoes }: Props) {
  const caminhoAtual = usePathname()
  const roteador = useRouter()
  const [saindo, setSaindo] = useState(false)
  const itens = ITENS_MENU.filter((item) => secoes.includes(item.secao))

  async function encerrarSessao() {
    if (saindo) return
    setSaindo(true)
    await sair()
    roteador.replace('/login')
    roteador.refresh()
  }

  function ativo(href: string) {
    return caminhoAtual === href || caminhoAtual.startsWith(`${href}/`)
  }

  return (
    <>
      <aside className="hidden w-[224px] shrink-0 flex-col gap-[6px] border-r border-[var(--borda)] bg-[var(--superficie)] p-4 py-[22px] md:flex">
        <Marca />

        <nav className="flex flex-col gap-[6px]">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-[11px] rounded-[10px] px-3 py-[11px] text-[13px]"
              style={{
                background: ativo(item.href)
                  ? 'linear-gradient(135deg, rgba(255,45,85,.12), rgba(45,107,255,.12))'
                  : 'transparent',
                color: ativo(item.href) ? 'var(--roxo)' : 'var(--texto-3)',
                fontWeight: ativo(item.href) ? 700 : 600,
              }}
            >
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: ativo(item.href) ? 'var(--marca)' : '#D6D1E0' }}
              />
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-[var(--borda)] px-2 pt-[10px]">
          <div className="flex items-center gap-[10px]">
            <Avatar nome={nome} />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold text-[var(--texto)]">{nome}</div>
              <div className="truncate text-[10px] font-medium text-[var(--texto-3)]">
                {perfis.map((p) => ROTULOS_PERFIL[p]).join(' · ')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={encerrarSessao}
            disabled={saindo}
            className="mt-[8px] w-full rounded-[10px] border border-[var(--borda-forte)] px-3 py-[8px] text-left text-[12px] font-semibold text-[var(--texto-3)] enabled:cursor-pointer disabled:opacity-60"
          >
            {saindo ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--borda)] bg-[var(--superficie)] px-4 md:hidden">
        <Marca compacta />
        <div className="flex items-center gap-2">
          <Avatar nome={nome} pequena />
          <button
            type="button"
            onClick={encerrarSessao}
            disabled={saindo}
            className="rounded-[8px] border border-[var(--borda)] px-2.5 py-1.5 text-[10.5px] font-bold text-[var(--texto-3)]"
          >
            {saindo ? '…' : 'Sair'}
          </button>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-[var(--borda)] bg-[var(--superficie)] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden" style={{ gridTemplateColumns: `repeat(${Math.max(1, itens.length)}, minmax(0, 1fr))` }}>
        {itens.map((item) => {
          const selecionado = ativo(item.href)
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 text-center">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: selecionado ? 'var(--marca)' : '#D6D1E0' }} />
              <span className="text-[10px] font-bold" style={{ color: selecionado ? 'var(--roxo)' : 'var(--texto-3)' }}>{item.rotuloMobile}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className={`${compacta ? '' : 'mb-[16px]'} flex items-center gap-[9px] px-2`}>
      <span aria-hidden className={`${compacta ? 'h-6 w-6' : 'h-[26px] w-[26px]'} rounded-[8px]`} style={{ background: 'var(--marca)' }} />
      <span className={`${compacta ? 'text-[15px]' : 'text-[16px]'} font-extrabold`} style={{ fontFamily: 'var(--fonte-titulo)' }}>
        chatbot<span style={{ color: 'var(--roxo)' }}>2.0</span>
      </span>
    </div>
  )
}

function Avatar({ nome, pequena = false }: { nome: string; pequena?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex ${pequena ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-[13px]'} shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ background: 'var(--marca)' }}
    >
      {(nome.charAt(0) || '?').toUpperCase()}
    </span>
  )
}
