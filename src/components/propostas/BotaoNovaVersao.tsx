'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { prepararNovaVersao } from '@/lib/acoes/acompanhamento-propostas'
import { CHAVE_SESSAO_CONSULTA, type EstadoDaConsulta } from '@/components/consulta/ProvedorDaConsulta'

export function BotaoNovaVersao({ propostaId }: { propostaId: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, iniciarTransicao] = useTransition()

  function iniciar() {
    setErro(null)
    iniciarTransicao(async () => {
      const retorno = await prepararNovaVersao(propostaId)
      if (!retorno.dados) {
        setErro(retorno.erro ?? 'Não foi possível preparar a nova versão.')
        return
      }

      const primeiraData = retorno.dados.itens[0]?.data
      const agora = new Date()
      const ano = primeiraData ? Number(primeiraData.slice(0, 4)) : agora.getFullYear()
      const mes = primeiraData ? Number(primeiraData.slice(5, 7)) : agora.getMonth() + 1

      const estado: EstadoDaConsulta = {
        marcaId: retorno.dados.marcaId,
        marcaNome: retorno.dados.marcaNome,
        cliente: retorno.dados.cliente,
        programaId: retorno.dados.programaId,
        programaNome: retorno.dados.programaNome,
        produto: retorno.dados.produto,
        objetivo: retorno.dados.objetivo,
        modalidade: retorno.dados.modalidade,
        ano,
        mes,
        itens: retorno.dados.itens,
        incluirDigital: retorno.dados.incluirDigital,
        incluirRedesSociais: retorno.dados.incluirRedesSociais,
        datasConfirmadas: false,
        propostaAnteriorId: retorno.dados.propostaAnteriorId,
        finalizada: false,
        propostaId: null,
      }

      try {
        sessionStorage.setItem(CHAVE_SESSAO_CONSULTA, JSON.stringify(estado))
      } catch {
        setErro('O navegador não conseguiu preparar a nova versão nesta aba.')
        return
      }

      router.push('/consulta')
      router.refresh()
    })
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={iniciar}
        disabled={carregando}
        className="inline-flex rounded-[9px] border border-[var(--borda-forte)] bg-white px-4 py-2 text-[11.5px] font-bold text-[var(--texto-2)] disabled:opacity-50"
      >
        {carregando ? 'Preparando…' : 'Criar nova versão'}
      </button>
      {erro && <p className="mt-1 max-w-[260px] text-[10px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}
    </div>
  )
}
