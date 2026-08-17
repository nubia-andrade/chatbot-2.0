import type { Cliente } from '@/lib/dados/busca-clientes'

type Props = {
  cliente: Cliente
  /**
   * Recebida pronta (não recalculada aqui) para que quem monta a tela
   * decida a fonte da verdade uma vez só — hoje é sempre
   * `podeComprarRegional(cliente)`, mas mantém o cartão simples de
   * reaproveitar se um dia a elegibilidade depender de mais que o cliente.
   */
  aptoRegional: boolean
}

/**
 * O cartão de classificação do cliente — Task 10.
 *
 * Só leitura, como toda a tela do passo 2: a classificação vem da carteira
 * e só muda lá. Faixa superior no gradiente da marca com nome e CNPJ; abaixo,
 * a grade de três colunas que resume o que as regras de concorrência e de
 * regional vão usar nesta consulta.
 */
export function CartaoDoCliente({ cliente, aptoRegional }: Props) {
  return (
    <div
      className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)]"
      style={{ background: 'var(--superficie)' }}
    >
      <div className="flex flex-col gap-1 p-5" style={{ background: 'var(--marca)' }}>
        <p
          className="text-[20px] font-extrabold leading-tight text-white"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          {cliente.nome}
        </p>
        <p className="text-[13px] font-medium text-white/85">{cliente.cnpj ?? 'Sem CNPJ na carteira'}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Setor</p>
          <p className="mt-1 text-[14px] font-bold text-[var(--texto)]">{cliente.setor ?? 'Sem setor'}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Indústria</p>
          <p className="mt-1 text-[14px] font-bold text-[var(--texto)]">{cliente.industria ?? 'Sem indústria'}</p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">Ações regionais</p>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] font-bold">
            <span
              aria-hidden
              className="h-[8px] w-[8px] rounded-full"
              style={{ background: aptoRegional ? 'var(--disponivel)' : 'var(--reservado)' }}
            />
            <span style={{ color: aptoRegional ? 'var(--disponivel)' : 'var(--texto-2)' }}>
              {aptoRegional ? 'Elegível' : 'Não elegível'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
