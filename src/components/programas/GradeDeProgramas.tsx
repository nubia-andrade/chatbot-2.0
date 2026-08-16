'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CartaoDePrograma } from '@/components/programas/CartaoDePrograma'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { podeEditarPrograma, podeExcluirPrograma, type Perfil } from '@/lib/dominio/perfis'
import type { Programa, EstadoDoPrograma } from '@/lib/dominio/cadastro'

type Props = {
  programas: Programa[]
  perfis: Perfil[]
  programasVinculados: string[]
}

const OPCOES_ESTADO: { valor: EstadoDoPrograma | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos os estados' },
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'inativo', rotulo: 'Inativo' },
  { valor: 'em_configuracao', rotulo: 'Em configuração' },
]

/**
 * Grade de cartões da lista de programas — Task 9.
 *
 * Grade responsiva (`repeat(auto-fill, minmax(240px, 1fr))`), com busca por
 * nome e filtro por status no topo. A busca e o filtro são só sobre os
 * programas já carregados: a lista inteira de programas cadastrados é
 * pequena (dezenas, não milhares), então filtrar no cliente não pesa e
 * responde na hora, sem ida ao servidor a cada tecla.
 */
export function GradeDeProgramas({ programas, perfis, programasVinculados }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoDoPrograma | 'todos'>('todos')

  const podeExcluir = podeExcluirPrograma(perfis)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return programas.filter((programa) => {
      const bateNome = termo === '' || programa.nome.toLowerCase().includes(termo)
      const bateEstado = filtroEstado === 'todos' || programa.estado === filtroEstado
      return bateNome && bateEstado
    })
  }, [programas, busca, filtroEstado])

  if (programas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum programa cadastrado ainda"
        explicacao="Cadastre o primeiro para começar a configurar disponibilidade."
        acao={
          <Link
            href="/configuracoes/programas/novo"
            className="inline-flex h-[40px] items-center rounded-[10px] px-5 text-[13px] font-bold text-white"
            style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
          >
            Novo programa
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="sr-only">Buscar programa por nome</span>
          <input
            type="text"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome…"
            className="h-[40px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie)] px-3 text-[13.5px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="sr-only">Filtrar por estado</span>
          <select
            value={filtroEstado}
            onChange={(evento) => setFiltroEstado(evento.target.value as EstadoDoPrograma | 'todos')}
            className="h-[40px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie)] px-3 text-[13.5px] text-[var(--texto)]"
          >
            {OPCOES_ESTADO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum programa encontrado"
          explicacao="Ajuste a busca ou o filtro de estado para ver outros programas."
        />
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {filtrados.map((programa) => (
            <CartaoDePrograma
              key={programa.id}
              programa={programa}
              podeEditar={podeEditarPrograma(perfis, programasVinculados, programa.id)}
              podeExcluir={podeExcluir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
