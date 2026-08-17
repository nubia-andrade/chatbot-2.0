'use client'

import { useEffect, useRef, useState } from 'react'
import { useConsulta, useGuardaDoPasso } from '@/components/consulta/ProvedorDaConsulta'
import { AcoesDoPasso } from '@/components/consulta/AcoesDoPasso'
import { CarregandoDoPasso } from '@/components/consulta/CarregandoDoPasso'
import { CartaoDoCliente } from '@/components/consulta/CartaoDoCliente'
import { podeComprarRegional } from '@/lib/dominio/elegibilidade-regional'
import { programasComRestricaoPara, type ProgramaComRestricao } from '@/lib/dados/classificacao'

/**
 * Passo 2 — Setor (tela 1c do handoff). Task 10.
 *
 * Só leitura, de ponta a ponta: a classificação vem da carteira e só muda
 * lá. Não há campo para corrigir setor, indústria ou elegibilidade regional
 * aqui — oferecer um recriaria a divergência que a Entrega 2 combateu ao
 * proibir texto livre na escolha do cliente.
 *
 * Sem gate próprio: o setor nasce junto do cliente (detectado
 * automaticamente), então quem chega até aqui já pode seguir adiante.
 */
export default function PassoSetor() {
  const pronto = useGuardaDoPasso('setor')
  const { estado } = useConsulta()

  // Resultado da checagem de restrições, marcado com o `clienteId` a que
  // pertence — o mesmo truque de `sugestoesTermo` em `CampoDeBuscaDeCliente`:
  // `carregando`/`erro`/`restricoes` abaixo são derivados da comparação com
  // `clienteId` atual, em vez de `setState` extra, para o efeito nunca
  // precisar chamar `setState` de forma síncrona no próprio corpo (só dentro
  // do `.then`/`.catch`, quando a resposta chega).
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

  const carregando = clienteId !== null && resultado?.para !== clienteId
  const erro = resultado !== null && resultado.para === clienteId && resultado.tipo === 'erro'
  const restricoes = resultado !== null && resultado.para === clienteId && resultado.tipo === 'ok' ? resultado.restricoes : []

  if (!pronto) {
    return <CarregandoDoPasso />
  }

  // A guarda só libera este passo com `estado.cliente` preenchido
  // (`primeiroPassoPendente`), mas o tipo continua `Cliente | null` — este
  // retorno é só a rede de segurança do TypeScript, não um estado real de
  // tela.
  if (!estado.cliente) {
    return <CarregandoDoPasso />
  }

  const cliente = estado.cliente
  const aptoRegional = podeComprarRegional(cliente)
  const semClassificacao = !cliente.setor || !cliente.industria

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[19px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Setor e categoria do cliente
        </h2>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Classificação governada e regras de concorrência aplicáveis.
        </p>
      </div>

      <CartaoDoCliente cliente={cliente} aptoRegional={aptoRegional} />

      {semClassificacao && (
        <div
          role="alert"
          className="rounded-[var(--raio-card)] border px-4 py-3"
          style={{ background: 'var(--prazo-fundo)', borderColor: 'var(--prazo)' }}
        >
          <p className="text-[13px] font-bold" style={{ color: 'var(--prazo-texto)' }}>
            Este cliente não tem setor e indústria na carteira.
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--texto-2)]">
            A verificação de concorrência não vai rodar para ele — confirme a classificação
            antes de fechar.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-[14px] font-bold text-[var(--texto)]">Regras que valem para esta consulta</h3>

        <div className="mt-3 flex flex-col gap-2">
          {carregando ? (
            <p role="status" className="text-[12.5px] text-[var(--texto-3)]">
              Verificando restrições cadastradas…
            </p>
          ) : erro ? (
            <p role="alert" className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
              Não foi possível verificar as restrições cadastradas agora. Tente recarregar a página.
            </p>
          ) : (
            <>
              {restricoes.length === 0 ? (
                <p className="text-[12.5px] text-[var(--texto-3)]">
                  Nenhuma restrição cadastrada contra este cliente.
                </p>
              ) : (
                restricoes.map((restricao) => (
                  <div
                    key={restricao.programa_id}
                    className="rounded-[var(--raio-card)] border px-4 py-3"
                    style={{ background: '#FDECEF', borderColor: '#FDE0E6' }}
                  >
                    <p className="text-[13px] font-bold" style={{ color: '#8B1030' }}>
                      {restricao.programa_nome}: não disponível para este cliente
                    </p>
                    <p className="mt-1 text-[12.5px]" style={{ color: '#8B1030' }}>
                      {restricao.motivo}
                    </p>
                  </div>
                ))
              )}

              {!semClassificacao && (
                <div
                  className="rounded-[var(--raio-card)] border px-4 py-3"
                  style={{ background: 'var(--superficie-suave)', borderColor: 'var(--borda)' }}
                >
                  <p className="text-[12.5px] text-[var(--texto-2)]">
                    Este cliente disputa exclusividade por data com outros anunciantes de{' '}
                    <strong>{cliente.setor}</strong> · <strong>{cliente.industria}</strong>.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AcoesDoPasso
        voltarPara="cliente"
        avancarPara="programa"
        avancarRotulo="Selecionar programa"
        habilitado
      />
    </div>
  )
}
