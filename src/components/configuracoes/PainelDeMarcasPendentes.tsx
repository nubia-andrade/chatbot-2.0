'use client'

import { useState } from 'react'
import { CampoDeBuscaDeCliente } from '@/components/comum/CampoDeBuscaDeCliente'
import type { Cliente } from '@/lib/dados/busca-clientes'
import type { AnuncianteTakePendente } from '@/lib/dados/marcas-take'
import { confirmarAnuncianteTake } from '@/lib/acoes/marcas-take'

type Props = { pendentes: AnuncianteTakePendente[] }

export function PainelDeMarcasPendentes({ pendentes }: Props) {
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function relacionar(alias: AnuncianteTakePendente, cliente: Cliente) {
    setSalvando(alias.id)
    setErro(null)
    const resultado = await confirmarAnuncianteTake(alias.id, cliente.id)
    setSalvando(null)
    if (resultado.erro) setErro(resultado.erro)
  }

  if (pendentes.length === 0) {
    return (
      <div className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-6">
        <h2 className="text-[15px] font-bold text-[var(--texto)]">Nenhum relacionamento pendente</h2>
        <p className="mt-2 text-[13px] text-[var(--texto-3)]">
          Todos os anunciantes observados no Globo Take já estão relacionados a um cliente da carteira.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-[var(--raio-card)] bg-[var(--concorrencia-fundo)] px-4 py-3 text-[13px] text-[var(--concorrencia)]">
          {erro}
        </div>
      )}

      {pendentes.map((alias) => (
        <article
          key={alias.id}
          className="grid gap-5 rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)]"
        >
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--texto-3)]">
              Anunciante no Globo Take
            </p>
            <h2 className="mt-1 text-[16px] font-bold text-[var(--texto)]">{alias.nome}</h2>
            <p className="mt-3 text-[11px] font-bold uppercase text-[var(--texto-3)]">Marcas observadas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {alias.marcas.length > 0 ? alias.marcas.map((marca) => (
                <span
                  key={marca}
                  className="rounded-full bg-[var(--superficie-suave)] px-2.5 py-1 text-[11px] font-semibold text-[var(--texto-2)]"
                >
                  {marca}
                </span>
              )) : (
                <span className="text-[12px] text-[var(--texto-3)]">Nenhuma marca listada.</span>
              )}
            </div>
          </div>

          <div className={salvando === alias.id ? 'pointer-events-none opacity-50' : ''}>
            <p className="mb-2 text-[12px] font-semibold text-[var(--texto-2)]">
              Qual cliente da carteira corresponde a este anunciante?
            </p>
            <CampoDeBuscaDeCliente
              rotulo="Relacionar com"
              placeholder="Busque o anunciante oficial na carteira…"
              aoEscolher={(cliente) => void relacionar(alias, cliente)}
            />
            {salvando === alias.id && (
              <p className="mt-2 text-[12px] text-[var(--texto-3)]">Salvando relacionamento…</p>
            )}
          </div>
        </article>
      ))}

      {pendentes.length >= 100 && (
        <p className="text-[12px] text-[var(--texto-3)]">
          Exibindo os primeiros 100 pendentes. Resolva alguns e recarregue a página para continuar.
        </p>
      )}
    </div>
  )
}
