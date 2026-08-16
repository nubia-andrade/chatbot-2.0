'use client'

import { useMemo, useState } from 'react'
import { salvarPrecos } from '@/lib/acoes/regional'
import { PRACAS } from '@/lib/dominio/regional'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'
import { AvisoDeSaida } from '@/components/comum/AvisoDeSaida'
import { EstadoVazio } from '@/components/comum/EstadoVazio'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'
import { MatrizDePracas, type AcaoRegionalDaMatriz } from './MatrizDePracas'
import { FormularioDeAcaoRegional } from './FormularioDeAcaoRegional'

type PrecoDePraca = { praca_codigo: string; valor: number; atualizado_em: string }

type Props = {
  programaId: string
  diaDaSemanaRegional: number
  prazoMinimoRegionalDias: number
  maxPracasPorAcao: number
  direitosEConexos: number | null
  custoProducaoRegional: number | null
  precosIniciais: PrecoDePraca[]
  acoesIniciais: AcaoRegionalDaMatriz[]
  hojeIso: string
}

function formatarDataHoraBR(iso: string): string {
  if (!iso) return 'Nunca atualizado'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return 'Nunca atualizado'
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Aba Regional inteira — Task 12.
 *
 * Reúne os três pedaços do brief numa tela só, na ordem em que o consultor
 * usa: primeiro os preços (o que cada praça custa), depois a matriz (o que
 * ainda está livre) e por fim o formulário de venda (registrar o que foi
 * fechado). Clicar numa data livre da matriz preenche o formulário — a
 * "consequência" visível de que a spec pede, e não duas telas que não se
 * falam.
 */
export function PainelRegional({
  programaId,
  diaDaSemanaRegional,
  prazoMinimoRegionalDias,
  maxPracasPorAcao,
  direitosEConexos,
  custoProducaoRegional,
  precosIniciais,
  acoesIniciais,
  hojeIso,
}: Props) {
  const [acoes, setAcoes] = useState<AcaoRegionalDaMatriz[]>(acoesIniciais)
  const [dataClicadaNaMatriz, setDataClicadaNaMatriz] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <PainelDePrecos
        programaId={programaId}
        precosIniciais={precosIniciais}
        direitosEConexos={direitosEConexos}
        custoProducaoRegional={custoProducaoRegional}
      />

      <MatrizDePracas
        diaDaSemanaRegional={diaDaSemanaRegional}
        prazoMinimoRegionalDias={prazoMinimoRegionalDias}
        acoes={acoes}
        hojeIso={hojeIso}
        aoEscolherData={setDataClicadaNaMatriz}
      />

      <FormularioDeAcaoRegional
        programaId={programaId}
        diaDaSemanaRegional={diaDaSemanaRegional}
        prazoMinimoRegionalDias={prazoMinimoRegionalDias}
        maxPracasPorAcao={maxPracasPorAcao}
        hojeIso={hojeIso}
        acoes={acoes}
        dataSugeridaPelaMatriz={dataClicadaNaMatriz}
        aoRegistrar={(novas) => setAcoes((atual) => [...atual, ...novas])}
      />

      <SecaoDeAcoesVendidas acoes={acoes} />
    </div>
  )
}

function PainelDePrecos({
  programaId,
  precosIniciais,
  direitosEConexos,
  custoProducaoRegional,
}: {
  programaId: string
  precosIniciais: PrecoDePraca[]
  direitosEConexos: number | null
  custoProducaoRegional: number | null
}) {
  const [precos, setPrecos] = useState(precosIniciais)
  const [rascunho, setRascunho] = useState<Record<string, string>>(() =>
    Object.fromEntries(precosIniciais.map((preco) => [preco.praca_codigo, formatarMoeda(preco.valor)])),
  )
  const [pracasDoCalculo, setPracasDoCalculo] = useState<string[]>([])
  const [gravando, setGravando] = useState(false)
  const [erros, setErros] = useState<string[]>([])
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [sujo, setSujo] = useState(false)

  const valoresPorPraca = useMemo(() => new Map(precos.map((p) => [p.praca_codigo, p.valor])), [precos])

  const totalDaAcao = useMemo(() => {
    const somaDasPracas = pracasDoCalculo.reduce((total, praca) => total + (valoresPorPraca.get(praca) ?? 0), 0)
    return somaDasPracas + (direitosEConexos ?? 0) + (custoProducaoRegional ?? 0)
  }, [pracasDoCalculo, valoresPorPraca, direitosEConexos, custoProducaoRegional])

  function alternarPracaDoCalculo(praca: string) {
    setPracasDoCalculo((atual) => (atual.includes(praca) ? atual.filter((p) => p !== praca) : [...atual, praca]))
  }

  async function salvar() {
    setGravando(true)
    setErros([])
    setSucesso(null)

    const entradas = PRACAS.map((praca) => ({ praca_codigo: praca, valor: paraNumero(rascunho[praca]) ?? 0 }))
    const resultado = await salvarPrecos(programaId, entradas)

    setGravando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      return
    }

    const agora = new Date().toISOString()
    setPrecos(entradas.map((entrada) => ({ ...entrada, atualizado_em: agora })))
    setSucesso('Preços salvos.')
    setSujo(false)
  }

  return (
    <section
      className="rounded-[var(--raio-card)] border border-[var(--borda)] p-5"
      style={{ background: 'var(--superficie)' }}
    >
      <AvisoDeSaida ativo={sujo} />
      <h3 className="text-[14px] font-bold text-[var(--texto)]">Preços por praça</h3>

      <p
        role="note"
        className="mt-2 rounded-[10px] px-3 py-2 text-[12px] font-semibold"
        style={{ background: 'var(--prazo-fundo)', color: 'var(--prazo)' }}
      >
        Valores pendentes de confirmação com Pricing.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] font-bold text-[var(--texto-3)]">
              <th className="pb-2">Usar no cálculo</th>
              <th className="pb-2">Praça</th>
              <th className="pb-2">Valor (R$)</th>
              <th className="pb-2">Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {precos.map((preco) => (
              <tr key={preco.praca_codigo} className="border-t border-[var(--borda)]">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={pracasDoCalculo.includes(preco.praca_codigo)}
                    onChange={() => alternarPracaDoCalculo(preco.praca_codigo)}
                    aria-label={`Incluir ${preco.praca_codigo} no cálculo`}
                    className="h-4 w-4 cursor-pointer accent-[#7A2FF2]"
                  />
                </td>
                <td className="py-2 pr-3 font-bold text-[var(--texto)]">{preco.praca_codigo}</td>
                <td className="py-2 pr-3">
                  <label className="sr-only" htmlFor={`preco-${preco.praca_codigo}`}>
                    Valor da praça {preco.praca_codigo}
                  </label>
                  <input
                    id={`preco-${preco.praca_codigo}`}
                    type="text"
                    value={rascunho[preco.praca_codigo] ?? ''}
                    placeholder="0,00"
                    onChange={(evento) => {
                      setRascunho((atual) => ({ ...atual, [preco.praca_codigo]: evento.target.value }))
                      setSujo(true)
                      setSucesso(null)
                    }}
                    onBlur={() =>
                      setRascunho((atual) => ({
                        ...atual,
                        [preco.praca_codigo]: formatarMoeda(paraNumero(atual[preco.praca_codigo])),
                      }))
                    }
                    className="h-[38px] w-[140px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13px] text-[var(--texto)] outline-none focus:border-[#A031F5]"
                  />
                </td>
                <td className="py-2 text-[12px] text-[var(--texto-3)]">
                  {formatarDataHoraBR(preco.atualizado_em)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erros.length > 0 && (
        <ul role="alert" className="mt-3 flex flex-col gap-1">
          {erros.map((erro) => (
            <li key={erro} className="text-[12.5px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
              {erro}
            </li>
          ))}
        </ul>
      )}
      {sucesso && (
        <p role="status" className="mt-3 text-[12.5px] font-semibold" style={{ color: 'var(--disponivel)' }}>
          {sucesso}
        </p>
      )}

      <BotaoDeGravacao type="button" gravando={gravando} onClick={salvar} className="mt-4">
        Salvar preços
      </BotaoDeGravacao>

      <div className="mt-5 grid gap-3 border-t border-[var(--borda)] pt-4 sm:grid-cols-2">
        <div>
          <span className="block text-[12px] font-semibold text-[var(--texto-2)]">Direitos e conexos</span>
          <span className="text-[15px] font-bold text-[var(--texto)]">
            {direitosEConexos !== null ? `R$ ${formatarMoeda(direitosEConexos)}` : 'Não informado'}
          </span>
        </div>
        <div>
          <span className="block text-[12px] font-semibold text-[var(--texto-2)]">Custo de produção regional</span>
          <span className="text-[15px] font-bold text-[var(--texto)]">
            {custoProducaoRegional !== null ? `R$ ${formatarMoeda(custoProducaoRegional)}` : 'Não informado'}
          </span>
        </div>
        <p className="text-[11.5px] text-[var(--texto-3)] sm:col-span-2">
          Editáveis na aba Cadastro deste programa.
        </p>
      </div>

      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] p-3"
        style={{ background: 'var(--superficie-suave)' }}
      >
        <span className="text-[12.5px] font-semibold text-[var(--texto-2)]">
          Total da ação {pracasDoCalculo.length > 0 ? `(${pracasDoCalculo.join(', ')})` : '(marque as praças acima)'}
        </span>
        <span className="text-[17px] font-bold text-[var(--texto)]">R$ {formatarMoeda(totalDaAcao)}</span>
      </div>
    </section>
  )
}

function SecaoDeAcoesVendidas({ acoes }: { acoes: AcaoRegionalDaMatriz[] }) {
  const ordenadas = [...acoes].sort((a, b) => b.data_de_exibicao.localeCompare(a.data_de_exibicao))

  function formatarData(iso: string): string {
    const data = new Date(`${iso}T00:00:00Z`)
    if (Number.isNaN(data.getTime())) return iso
    const dia = String(data.getUTCDate()).padStart(2, '0')
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
    return `${dia}/${mes}/${data.getUTCFullYear()}`
  }

  return (
    <section>
      <h3 className="mb-3 text-[14px] font-bold text-[var(--texto)]">Ações vendidas</h3>
      {ordenadas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma ação regional vendida ainda"
          explicacao="Registre a primeira venda no formulário acima — ela aparece aqui e na matriz de disponibilidade."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {ordenadas.map((acao) => (
            <li
              key={acao.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-4"
              style={{ background: 'var(--superficie)' }}
            >
              <span className="text-[13.5px] font-bold text-[var(--texto)]">
                {formatarData(acao.data_de_exibicao)} · {acao.praca_codigo}
              </span>
              <span className="text-[13px] text-[var(--texto-3)]">{acao.cliente_nome}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
