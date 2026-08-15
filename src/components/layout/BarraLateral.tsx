'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Sessao } from '@/lib/sessao-servidor'

type Props = {
  nome: string
  perfil: Sessao['perfil']
  /**
   * Já calculado no servidor (via `podeAdministrar` da Task 8) e recebido
   * pronto aqui. Esconder "Configurações" para quem não administra é só
   * conveniência de interface — quem protege de verdade o acesso aos dados
   * de configuração é o RLS do banco (`supabase/schema.sql`). Uma pessoa
   * sem permissão que force a URL não veria nada além do que a política do
   * banco autorizar.
   */
  podeAdministrar: boolean
}

type ItemMenu = { href: string; rotulo: string }

const ITENS_BASE: ItemMenu[] = [
  { href: '/inicio', rotulo: 'Início' },
  { href: '/consulta', rotulo: 'Nova consulta' },
  { href: '/propostas', rotulo: 'Propostas' },
  { href: '/historico', rotulo: 'Histórico' },
]

const ITEM_CONFIGURACOES: ItemMenu = { href: '/configuracoes', rotulo: 'Configurações' }

const ROTULOS_PERFIL: Record<Sessao['perfil'], string> = {
  executivo: 'Executivo comercial',
  admin_programa: 'Administrador de programa',
  admin_geral: 'Administrador geral',
}

/**
 * Barra lateral do shell do app — telas 1b a 1e do handoff.
 *
 * 224px, fundo branco, itens de navegação e o rodapé com quem está logado.
 */
export function BarraLateral({ nome, perfil, podeAdministrar }: Props) {
  const caminhoAtual = usePathname()

  const itens = podeAdministrar ? [...ITENS_BASE, ITEM_CONFIGURACOES] : ITENS_BASE

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

      <div className="mt-auto flex items-center gap-[10px] border-t border-[var(--borda)] px-2 pt-[10px]">
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
            {ROTULOS_PERFIL[perfil]}
          </div>
        </div>
      </div>
    </aside>
  )
}
