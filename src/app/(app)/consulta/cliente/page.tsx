'use client'

import { useRouter } from 'next/navigation'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { CampoDeBuscaDeCliente } from '@/components/comum/CampoDeBuscaDeCliente'
import type { Cliente } from '@/lib/dados/busca-clientes'

/**
 * Passo 1 — Cliente (tela 1b do handoff). Task 10.
 *
 * O campo de busca é a ÚNICA forma de preencher o cliente: nenhum texto
 * livre, a mesma regra que a Entrega 2 já impôs em `CampoDeBuscaDeCliente`.
 * Escolher um cliente grava no provider e já avança para o passo 2 — a
 * classificação que ele carrega (setor, indústria, elegibilidade regional)
 * é justamente o assunto da tela seguinte, não há por que esperar um
 * segundo clique.
 */
export default function PassoCliente() {
  const pronto = useGuardaDoPasso('cliente')
  const { estado, atualizar } = useConsulta()
  const router = useRouter()

  if (!pronto) {
    return <CarregandoDoPasso />
  }

  function escolher(cliente: Cliente) {
    atualizar({ cliente })
    router.push('/consulta/setor')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[26px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Para quem você está vendendo?
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Pesquise o anunciante por nome ou CNPJ.
        </p>
      </div>

      <div
        className="rounded-[var(--raio-card)] p-5"
        style={{
          border: '2px solid #A031F5',
          boxShadow: '0 12px 32px rgba(160, 49, 245, .16)',
          background: 'var(--superficie)',
        }}
      >
        <CampoDeBuscaDeCliente
          rotulo="Cliente"
          placeholder="Digite o nome ou CNPJ do anunciante…"
          aoEscolher={escolher}
        />

        {!estado.cliente && (
          <p className="mt-3 text-[12.5px] text-[var(--texto-3)]">
            Busque pelo nome ou CNPJ do anunciante. A classificação vem da carteira.
          </p>
        )}
      </div>

      <AcoesDoPasso
        voltarPara={null}
        avancarPara="setor"
        avancarRotulo="Ver setor do cliente"
        habilitado={estado.cliente !== null}
        motivo="Selecione um cliente para continuar"
      />
    </div>
  )
}
