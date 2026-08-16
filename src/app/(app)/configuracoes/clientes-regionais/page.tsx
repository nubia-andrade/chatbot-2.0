import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { listarClientesElegiveis } from '@/lib/dados/clientes-regionais'
import { PainelDeClientesRegionais } from '@/components/configuracoes/PainelDeClientesRegionais'

/**
 * Configurações → Clientes regionais.
 *
 * A elegibilidade para ações regionais é do CLIENTE, GLOBAL — vale para
 * qualquer programa que aceite regional, não é configuração de um programa
 * específico. Por isso a tela vive aqui, em Configurações, e não dentro da
 * aba Regional de um programa (que só linka para cá).
 *
 * De propósito, repete a checagem de `podeAdministrar` que já decide se o
 * item aparece no índice de Configurações: esconder o link é conveniência
 * de interface, quem protege de verdade os dados é a policy "escrita
 * administrador" de `clientes` (`supabase/schema-clientes-regional.sql`).
 */
export default async function PaginaDeClientesRegionais() {
  const sessao = await obterSessao()

  if (!podeAdministrar(sessao)) {
    return (
      <section
        style={{
          background: 'var(--superficie)',
          borderRadius: 'var(--raio-janela)',
          padding: '40px',
          border: '1px solid var(--borda)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 26, fontWeight: 700 }}>
          Clientes regionais
        </h1>
        <p style={{ color: 'var(--concorrencia)', marginTop: 8 }}>
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  const { clientes, total } = await listarClientesElegiveis(1, '')

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="text-[26px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Clientes regionais
        </h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Quem pode comprar ação regional. A elegibilidade é do cliente — vale para todos os
          programas que aceitam regional, não só um.
        </p>
      </header>

      <PainelDeClientesRegionais clientesIniciais={clientes} totalInicial={total} />
    </div>
  )
}
