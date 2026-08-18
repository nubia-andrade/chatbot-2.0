'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { CartaoDeProgramaConsultavel } from '@/components/consulta/CartaoDeProgramaConsultavel'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { programasComRestricaoPara, type ProgramaComRestricao } from '@/lib/dados/classificacao'
import { podeComprarRegional } from '@/lib/dominio/elegibilidade-regional'
import type { Programa } from '@/lib/dominio/cadastro'
import type { Modalidade } from '@/lib/dominio/disponibilidade'

const MOTIVO_SEM_PERFIL = 'Consulta regional exige o perfil de executivo regional.'
const MOTIVO_CLIENTE_INELEGIVEL = 'Este cliente não está habilitado para ações regionais.'

type Props = {
  programas: Programa[]
  temPerfilRegional: boolean
}

export function PassoPrograma({ programas, temPerfilRegional }: Props) {
  const pronto = useGuardaDoPasso('programa')
  const { estado, atualizar } = useConsulta()
  const router = useRouter()

  const [resultado, setResultado] = useState<
    | { para: string; tipo: 'ok'; restricoes: ProgramaComRestricao[] }
    | { para: string; tipo: 'erro' }
    | null
  >(null)
  const idDaConsulta = useRef(0)

  const clienteId = estado.cliente?.id ?? null

  useEffect(() => {
    if (!clienteId) return
    const numero = ++idDaConsulta.current
    programasComRestricaoPara(clienteId)
      .then((restricoes) => {
        if (numero !== idDaConsulta.current) return
        setResultado({ para: clienteId, tipo: 'ok', restricoes })
      })
      .catch(() => {
        if (numero !== idDaConsulta.current) return
        setResultado({ para: clienteId, tipo: 'erro' })
      })
  }, [clienteId])

  if (!pronto || !estado.cliente) return <CarregandoDoPasso />

  const cliente = estado.cliente
  const clienteAptoRegional = podeComprarRegional(cliente)
  const carregandoRestricoes = resultado === null || resultado.para !== clienteId
  const erroRestricoes = !carregandoRestricoes && resultado?.tipo === 'erro'
  const restricoes = !carregandoRestricoes && resultado?.tipo === 'ok' ? resultado.restricoes : []
  const restricaoPorPrograma = new Map(restricoes.map((r) => [r.programa_id, r.motivo]))

  function escolher(programa: Programa, modalidade: Modalidade) {
    atualizar({
      programaId: programa.id,
      programaNome: programa.nome,
      modalidade,
      itens: [],
      incluirDigital: false,
      incluirRedesSociais: false,
    })
    router.push('/consulta/calendario')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--texto)]" style={{ fontFamily: 'var(--fonte-titulo)' }}>
          O que você está vendendo?
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Escolha o programa e a modalidade da consulta para {cliente.nome}.
        </p>
      </div>

      {carregandoRestricoes && <p role="status" className="text-[12.5px] text-[var(--texto-3)]">Verificando restrições cadastradas…</p>}

      {erroRestricoes && (
        <p role="alert" className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
          Não foi possível verificar as restrições cadastradas contra este cliente agora. Os programas abaixo aparecem sem o veto — confira com cuidado antes de prosseguir, ou recarregue a página para tentar de novo.
        </p>
      )}

      {programas.length === 0 ? (
        <EstadoVazio titulo="Nenhum programa disponível para consulta" explicacao="Nenhum programa está ativo e disponível para proposta agora. Fale com quem administra os programas." />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {programas.map((programa) => {
            let regionalDisponivel = false
            let motivoRegionalIndisponivel: string | null = null

            if (programa.aceita_regional) {
              if (!temPerfilRegional) motivoRegionalIndisponivel = MOTIVO_SEM_PERFIL
              else if (!clienteAptoRegional) motivoRegionalIndisponivel = MOTIVO_CLIENTE_INELEGIVEL
              else regionalDisponivel = true
            }

            return (
              <CartaoDeProgramaConsultavel
                key={programa.id}
                programa={programa}
                restricao={restricaoPorPrograma.get(programa.id) ?? null}
                regionalDisponivel={regionalDisponivel}
                motivoRegionalIndisponivel={motivoRegionalIndisponivel}
                permiteEscolha={!carregandoRestricoes}
                aoEscolher={(modalidade) => escolher(programa, modalidade)}
              />
            )
          })}
        </div>
      )}

      <AcoesDoPasso
        voltarPara="setor"
        avancarPara="calendario"
        avancarRotulo="Ver calendário"
        habilitado={estado.programaId !== null}
        motivo="Selecione um programa e uma modalidade para continuar"
      />
    </div>
  )
}
