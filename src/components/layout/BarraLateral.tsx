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

type ItemMenu = { href: string; rotulo: string; secao: SecaoApp }

const ITENS_MENU: ItemMenu[] = [
  { href: '/inicio', rotulo: 'Início', secao: 'inicio' },
  { href: '/consulta', rotulo: 'Nova consulta', secao: 'consulta' },
  { href: '/propostas', rotulo: 'Propostas', secao: 'propostas' },
  { href: '/historico', rotulo: 'Histórico', secao: 'historico' },
  { href: '/configuracoes', rotulo: 'Configurações', secao: 'configuracoes' },
]

const ROTULOS_PERFIL: Record<Perfil, string> = {
  executivo: 'Executiva comercial',
  executivo_regional: 'Regional',
  consultor_programa: 'Consultora de programa',
  proprietario: 'Proprietária',
}

/**
 * Barra lateral do shell do app.
 *
 * O menu reflete a matriz de permissões carregada no servidor. Isso é uma
 * conveniência de interface; as rotas e o RLS continuam fazendo a proteção
 * efetiva caso alguém tente forçar uma URL manualmente.
 */
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

  return (
    <aside className="flex w-[224px] shrink-0 flex-col gap-[6px] border-r border-[var(--borda)] bg-[var(--superficie)] p-4 py-[22px]">
      <div className="mb-[16px] flex items-center gap-[9px] px-2">
        <span
          aria-hidden
          className="h-[26px] w-[26px] rounded-[8px]"
          style={{ background: 'var(--marca)' }}
        />
        <span className="text-[16px] font-extrabold" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          chatbot<span style={{ color: 'var(--roxo)' }}>2.0</span>
        </span>
      </div>

      <nav className="flex flex-col gap-[6px]">
        {itens.map((item) => {
          const ativo = caminhoAtual === item.href || caminhoAtual.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-[11px] rounded-[10px] px-3 py-[11px] text-[13px]"
              style={{
                background: ativo
                  ? 'linear-gradient(135deg, rgba(255,45,85,.12), rgba(45,107,255,.12))'
                  : 'transparent',
                color: ativo ? 'var(--roxo)' : 'var(--texto-3)',
                fontWeight: ativo ? 700 : 600,
              }}
            >
              <span
                aria-hidden
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: ativo ? 'var(--marca)' : '#D6D1E0' }}
              />
              {item.rotulo}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--borda)] px-2 pt-[10px]">
        <div className="flex items-center gap-[10px]">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
            style={{ background: 'var(--marca)' }}
          >
            {(nome.charAt(0) || '?').toUpperCase()}
          </span>
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
  )
}
