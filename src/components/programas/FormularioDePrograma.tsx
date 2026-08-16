'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { salvarPrograma } from '@/lib/acoes/programas'
import { enviarImagemDePrograma } from '@/lib/acoes/imagens'
import type { EstadoDoPrograma, Programa } from '@/lib/dominio/cadastro'
import { paraNumero, formatarMoeda } from '@/lib/dominio/moeda'
import { urlDeImagemSegura } from '@/lib/seguranca/url-imagem'
import { AvisoDeSaida, useNavegacaoSegura } from '@/components/comum/AvisoDeSaida'
import { BotaoDeGravacao } from '@/components/comum/BotaoDeGravacao'
import { BlocoDeCustos, rascunhoDeCustosInicial, type RascunhoDeCustos } from './BlocoDeCustos'

const ROTULOS_ESTADO: Record<EstadoDoPrograma, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_configuracao: 'Em configuração',
}

const DIAS_DA_SEMANA: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: 'Dom' },
  { valor: 1, rotulo: 'Seg' },
  { valor: 2, rotulo: 'Ter' },
  { valor: 3, rotulo: 'Qua' },
  { valor: 4, rotulo: 'Qui' },
  { valor: 5, rotulo: 'Sex' },
  { valor: 6, rotulo: 'Sáb' },
]

/** Estado do formulário: números monetários ficam como texto para admitir campo vazio. */
type Rascunho = {
  nome: string
  mnemonico: string
  imagem_url: string
  canal: string
  estado: EstadoDoPrograma
  dias_da_semana: number[]
  slots: string
  prazo_minimo_dias: string
  bloqueio_mensal: string
  acoes_minimas: string
  acoes_maximas: string
  disponivel_para_proposta: boolean
  possui_fluxo_aprovacao: boolean
  contem_digital: boolean
  redes_sociais: boolean
  aceita_regional: boolean
  dia_da_semana_regional: string
  prazo_minimo_regional_dias: string
  max_pracas_por_acao: string
  custo_producao_regional: string
  bloqueio_mensal_regional: string
} & RascunhoDeCustos

function rascunhoInicial(programa: Programa | null): Rascunho {
  return {
    nome: programa?.nome ?? '',
    mnemonico: programa?.mnemonico ?? '',
    imagem_url: programa?.imagem_url ?? '',
    canal: programa?.canal ?? '',
    estado: programa?.estado ?? 'em_configuracao',
    dias_da_semana: programa?.dias_da_semana ?? [],
    slots: programa ? String(programa.slots) : '1',
    prazo_minimo_dias: programa ? String(programa.prazo_minimo_dias) : '0',
    bloqueio_mensal: programa ? String(programa.bloqueio_mensal) : '0',
    acoes_minimas: programa ? String(programa.acoes_minimas) : '1',
    acoes_maximas: programa ? String(programa.acoes_maximas) : '1',
    disponivel_para_proposta: programa?.disponivel_para_proposta ?? false,
    ...rascunhoDeCustosInicial(programa),
    possui_fluxo_aprovacao: programa?.possui_fluxo_aprovacao ?? false,
    contem_digital: programa?.contem_digital ?? false,
    redes_sociais: programa?.redes_sociais ?? false,
    aceita_regional: programa?.aceita_regional ?? false,
    dia_da_semana_regional:
      programa?.dia_da_semana_regional !== null && programa?.dia_da_semana_regional !== undefined
        ? String(programa.dia_da_semana_regional)
        : '',
    prazo_minimo_regional_dias:
      programa?.prazo_minimo_regional_dias !== null && programa?.prazo_minimo_regional_dias !== undefined
        ? String(programa.prazo_minimo_regional_dias)
        : '',
    max_pracas_por_acao: programa ? String(programa.max_pracas_por_acao) : '3',
    custo_producao_regional: formatarMoeda(programa?.custo_producao_regional),
    bloqueio_mensal_regional:
      programa?.bloqueio_mensal_regional !== null && programa?.bloqueio_mensal_regional !== undefined
        ? String(programa.bloqueio_mensal_regional)
        : '',
  }
}

/**
 * Texto vazio vira `undefined` — "não informado", e não zero. É a
 * validação de domínio (`validarPrograma`) quem decide o que fazer com um
 * campo ausente (ex.: slots ausente vira o mesmo erro de slots zerado).
 */
function numeroOuIndefinido(texto: string): number | undefined {
  const limpo = texto.trim()
  if (limpo === '') return undefined
  const valor = Number(limpo)
  return Number.isNaN(valor) ? undefined : valor
}

function paraPrograma(id: string | undefined, rascunho: Rascunho): Partial<Programa> {
  return {
    ...(id ? { id } : {}),
    nome: rascunho.nome,
    mnemonico: rascunho.mnemonico,
    imagem_url: rascunho.imagem_url.trim() || null,
    canal: rascunho.canal,
    estado: rascunho.estado,
    dias_da_semana: rascunho.dias_da_semana,
    slots: numeroOuIndefinido(rascunho.slots),
    prazo_minimo_dias: numeroOuIndefinido(rascunho.prazo_minimo_dias),
    bloqueio_mensal: numeroOuIndefinido(rascunho.bloqueio_mensal),
    acoes_minimas: numeroOuIndefinido(rascunho.acoes_minimas),
    acoes_maximas: numeroOuIndefinido(rascunho.acoes_maximas),
    disponivel_para_proposta: rascunho.disponivel_para_proposta,
    custo_midia_tv: paraNumero(rascunho.custo_midia_tv),
    custo_producao_tv: paraNumero(rascunho.custo_producao_tv),
    percentual_simulcast: paraNumero(rascunho.percentual_simulcast),
    custo_midia_digital: paraNumero(rascunho.custo_midia_digital),
    custo_producao_digital: paraNumero(rascunho.custo_producao_digital),
    possui_fluxo_aprovacao: rascunho.possui_fluxo_aprovacao,
    contem_digital: rascunho.contem_digital,
    redes_sociais: rascunho.redes_sociais,
    aceita_regional: rascunho.aceita_regional,
    // O bloco regional some da tela quando `aceita_regional` é desmarcado —
    // os campos somem junto com ele, então o que não se digitou vira `null`
    // (dia/prazo, R10/R11) ou fica valendo o padrão de banco (praças).
    dia_da_semana_regional: rascunho.aceita_regional
      ? (numeroOuIndefinido(rascunho.dia_da_semana_regional) ?? null)
      : null,
    prazo_minimo_regional_dias: rascunho.aceita_regional
      ? (numeroOuIndefinido(rascunho.prazo_minimo_regional_dias) ?? null)
      : null,
    max_pracas_por_acao: numeroOuIndefinido(rascunho.max_pracas_por_acao) ?? 3,
    custo_producao_regional: rascunho.aceita_regional ? paraNumero(rascunho.custo_producao_regional) : null,
    bloqueio_mensal_regional: rascunho.aceita_regional
      ? (numeroOuIndefinido(rascunho.bloqueio_mensal_regional) ?? null)
      : null,
  }
}

/**
 * Formulário de cadastro de programa — Task 10, Step 4; Custos reestruturado
 * na Entrega 3 (nacional TV/Digital, com "direitos e conexos" calculado —
 * `BlocoDeCustos`). O bloco regional (dia da semana, prazo, teto de praças)
 * fica visível só com `aceita_regional` marcado; os custos por praça saíram
 * daqui e moram na aba Regional do programa.
 *
 * Agrupado em blocos (Identificação, Exibição, Regras de proposta, Custos,
 * Marcadores, Regional) para não virar um paredão de campos.
 *
 * A validação real é a de `salvarPrograma` (que chama `validarPrograma` no
 * servidor antes de gravar); os erros que ela devolve aparecem no topo,
 * em `var(--concorrencia)`, com o formulário preenchido como estava — nunca
 * uma tela em branco. Não há validação client-side que bloqueie o envio —
 * é só o servidor que decide.
 *
 * `AvisoDeSaida`/`useNavegacaoSegura` (`components/comum/AvisoDeSaida.tsx`)
 * protegem contra perder alteração não salva: `sujo` liga assim que a
 * pessoa toca em qualquer campo e desliga só depois de um salvamento sem
 * erro.
 */
export function FormularioDePrograma({ programa }: { programa: Programa | null }) {
  const router = useRouter()
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoInicial(programa))
  const [erros, setErros] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [sujo, setSujo] = useState(false)
  const navegar = useNavegacaoSegura(sujo)

  function mudar<C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    setSujo(true)
  }

  function alternarDia(dia: number) {
    setRascunho((atual) => ({
      ...atual,
      dias_da_semana: atual.dias_da_semana.includes(dia)
        ? atual.dias_da_semana.filter((d) => d !== dia)
        : [...atual.dias_da_semana, dia].sort((a, b) => a - b),
    }))
    setSujo(true)
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    if (salvando) return

    setSalvando(true)
    setErros([])

    const resultado = await salvarPrograma(paraPrograma(programa?.id, rascunho))

    setSalvando(false)

    if (resultado.erros.length > 0) {
      setErros(resultado.erros)
      return
    }

    setSujo(false)

    if (!programa && resultado.id) {
      // Programa novo: segue para a página de edição, onde o editor de
      // apelidos e as demais abas passam a existir (dependem de um
      // `programa_id` real).
      router.push(`/configuracoes/programas/${resultado.id}`)
    }
    router.refresh()
  }

  return (
    <form
      onSubmit={salvar}
      className="flex flex-col gap-6 rounded-[var(--raio-card)] border border-[var(--borda)] p-6"
      style={{ background: 'var(--superficie)' }}
    >
      <AvisoDeSaida ativo={sujo} />

      {erros.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 rounded-[10px] border px-4 py-3 text-[13px] font-semibold"
          style={{
            color: 'var(--concorrencia)',
            background: 'var(--concorrencia-fundo)',
            borderColor: 'var(--concorrencia)',
          }}
        >
          {erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}

      <BlocoIdentificacao rascunho={rascunho} mudar={mudar} />
      <BlocoExibicao rascunho={rascunho} mudar={mudar} alternarDia={alternarDia} />
      <BlocoRegrasDeProposta rascunho={rascunho} mudar={mudar} />
      <BlocoDeCustos rascunho={rascunho} mudar={mudar} />
      <BlocoMarcadores rascunho={rascunho} mudar={mudar} />
      <BlocoRegional rascunho={rascunho} mudar={mudar} />

      <div className="flex flex-wrap gap-3 border-t border-[var(--borda)] pt-5">
        <BotaoDeGravacao gravando={salvando}>
          {programa ? 'Salvar alterações' : 'Cadastrar programa'}
        </BotaoDeGravacao>

        <button
          type="button"
          disabled={salvando}
          onClick={() => navegar('/configuracoes/programas')}
          className="h-[44px] rounded-[12px] border border-[var(--borda-forte)] px-5 text-[13.5px] font-semibold text-[var(--texto-2)] enabled:cursor-pointer disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

type PropsDoBloco = {
  rascunho: Rascunho
  mudar: <C extends keyof Rascunho>(campo: C, valor: Rascunho[C]) => void
}

function TituloDoBloco({ texto }: { texto: string }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--texto-3)]">
      {texto}
    </h2>
  )
}

function Campo({
  rotulo,
  valor,
  aoMudar,
  aoSairDoFoco,
  tipo = 'text',
  placeholder,
  ajuda,
}: {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  aoSairDoFoco?: () => void
  tipo?: 'text' | 'number'
  placeholder?: string
  /** Linha curta de ajuda, em termos do negócio, exibida abaixo do campo. */
  ajuda?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        placeholder={placeholder}
        onChange={(evento) => aoMudar(evento.target.value)}
        onBlur={aoSairDoFoco}
        className="h-[40px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
      />
      {ajuda && <span className="text-[11.5px] text-[var(--texto-3)]">{ajuda}</span>}
    </label>
  )
}

/**
 * Imagem do programa: envio de arquivo para o Supabase Storage, com o campo
 * de URL preservado ao lado.
 *
 * Os dois caminhos coexistem de propósito. O upload é o que a spec pede —
 * ninguém precisa hospedar imagem em outro lugar antes de cadastrar um
 * programa. Colar URL continua valendo porque é o que já funcionava, porque
 * parte das imagens já vive em CDN da casa, e porque é a saída quando o
 * bucket ainda não foi criado no projeto.
 *
 * O que é gravado em `imagem_url` é sempre uma URL — o upload apenas produz
 * uma.
 */
function CampoDeImagem({ valor, aoMudar }: { valor: string; aoMudar: (valor: string) => void }) {
  const entradaDeArquivo = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(arquivo: File) {
    setEnviando(true)
    setErro(null)

    const formulario = new FormData()
    formulario.append('arquivo', arquivo)
    const resultado = await enviarImagemDePrograma(formulario)

    setEnviando(false)
    if (entradaDeArquivo.current) entradaDeArquivo.current.value = ''

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    if (resultado.url) aoMudar(resultado.url)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-[var(--texto-2)]">Imagem do programa</span>

      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-hidden
          className="h-[56px] w-[92px] shrink-0 rounded-[10px] border border-[var(--borda-forte)]"
          style={{
            background: urlDeImagemSegura(valor)
              ? `center / cover no-repeat url("${urlDeImagemSegura(valor)}")`
              : 'var(--superficie-suave)',
          }}
        />

        <input
          ref={entradaDeArquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(evento) => {
            const arquivo = evento.target.files?.[0]
            if (arquivo) void enviar(arquivo)
          }}
        />

        <button
          type="button"
          disabled={enviando}
          onClick={() => entradaDeArquivo.current?.click()}
          className="h-[40px] rounded-[10px] border border-[var(--borda-forte)] px-4 text-[12.5px] font-bold text-[var(--roxo)] enabled:cursor-pointer disabled:opacity-60"
        >
          {enviando ? 'Enviando…' : valor.trim() ? 'Trocar imagem' : 'Enviar imagem'}
        </button>

        {valor.trim() !== '' && !enviando && (
          <button
            type="button"
            onClick={() => aoMudar('')}
            className="h-[40px] cursor-pointer px-1 text-[12.5px] font-semibold text-[var(--texto-3)]"
          >
            Remover
          </button>
        )}
      </div>

      {erro && (
        <p role="alert" className="text-[12px] font-semibold" style={{ color: 'var(--concorrencia)' }}>
          {erro}
        </p>
      )}

      <Campo
        rotulo="Ou cole a URL de uma imagem já hospedada"
        valor={valor}
        placeholder="https://…"
        aoMudar={aoMudar}
      />
    </div>
  )
}

function Marcador({
  rotulo,
  descricao,
  marcado,
  aoMudar,
}: {
  rotulo: string
  descricao: string
  marcado: boolean
  aoMudar: (valor: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-[10px] border border-[var(--borda)] p-3">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(evento) => aoMudar(evento.target.checked)}
        className="mt-0.5 h-[16px] w-[16px] cursor-pointer accent-[#7A2FF2]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[12.5px] font-semibold text-[var(--texto)]">{rotulo}</span>
        <span className="text-[11.5px] text-[var(--texto-3)]">{descricao}</span>
      </span>
    </label>
  )
}

function BlocoIdentificacao({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3">
      <TituloDoBloco texto="Identificação" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          rotulo="Nome do programa"
          valor={rascunho.nome}
          aoMudar={(valor) => mudar('nome', valor)}
        />
        <Campo
          rotulo="Mnemônico"
          valor={rascunho.mnemonico}
          placeholder="Ex.: MAVO"
          aoMudar={(valor) => mudar('mnemonico', valor)}
        />
        <Campo
          rotulo="Canal"
          valor={rascunho.canal}
          placeholder="Ex.: TV Globo"
          aoMudar={(valor) => mudar('canal', valor)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[var(--texto-2)]">Estado</span>
          <select
            value={rascunho.estado}
            onChange={(evento) => mudar('estado', evento.target.value as EstadoDoPrograma)}
            className="h-[40px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)]"
          >
            {Object.entries(ROTULOS_ESTADO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <CampoDeImagem valor={rascunho.imagem_url} aoMudar={(valor) => mudar('imagem_url', valor)} />
        </div>
      </div>
    </fieldset>
  )
}

function BlocoExibicao({
  rascunho,
  mudar,
  alternarDia,
}: PropsDoBloco & { alternarDia: (dia: number) => void }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Exibição" />

      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold text-[var(--texto-2)]">Dias de exibição</span>
        <div className="flex flex-wrap gap-2">
          {DIAS_DA_SEMANA.map((dia) => {
            const marcado = rascunho.dias_da_semana.includes(dia.valor)
            return (
              <button
                key={dia.valor}
                type="button"
                aria-pressed={marcado}
                onClick={() => alternarDia(dia.valor)}
                className="h-[36px] w-[52px] cursor-pointer rounded-[10px] border text-[12.5px] font-bold"
                style={
                  marcado
                    ? { borderColor: 'var(--roxo)', background: 'rgba(122,47,242,.1)', color: 'var(--roxo)' }
                    : { borderColor: 'var(--borda-forte)', color: 'var(--texto-3)' }
                }
              >
                {dia.rotulo}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          rotulo="Slots por data"
          tipo="number"
          valor={rascunho.slots}
          aoMudar={(valor) => mudar('slots', valor)}
          ajuda="Quantas ações de conteúdo cabem num mesmo dia de exibição do programa."
        />
        <Campo
          rotulo="Prazo mínimo (dias)"
          tipo="number"
          valor={rascunho.prazo_minimo_dias}
          aoMudar={(valor) => mudar('prazo_minimo_dias', valor)}
          ajuda="Com quantos dias de antecedência a venda precisa ser fechada antes da exibição."
        />
      </div>
    </fieldset>
  )
}

function BlocoRegrasDeProposta({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Regras de proposta" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo
          rotulo="Bloqueio mensal"
          tipo="number"
          valor={rascunho.bloqueio_mensal}
          aoMudar={(valor) => mudar('bloqueio_mensal', valor)}
          ajuda="Quantas ações o programa aceita vender num mês antes de fechar para novas propostas."
        />
        <Campo
          rotulo="Ações mínimas"
          tipo="number"
          valor={rascunho.acoes_minimas}
          aoMudar={(valor) => mudar('acoes_minimas', valor)}
          ajuda="O menor número de ações que uma mesma proposta pode conter."
        />
        <Campo
          rotulo="Ações máximas"
          tipo="number"
          valor={rascunho.acoes_maximas}
          aoMudar={(valor) => mudar('acoes_maximas', valor)}
          ajuda="O maior número de ações que uma mesma proposta pode conter."
        />
      </div>
      <Marcador
        rotulo="Disponível para proposta"
        descricao="Programas disponíveis exigem custo de mídia e de produção de TV preenchidos."
        marcado={rascunho.disponivel_para_proposta}
        aoMudar={(valor) => mudar('disponivel_para_proposta', valor)}
      />
    </fieldset>
  )
}

function BlocoMarcadores({ rascunho, mudar }: PropsDoBloco) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Marcadores" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Marcador
          rotulo="Possui fluxo de aprovação"
          descricao="A proposta deste programa passa por aprovação antes de sair."
          marcado={rascunho.possui_fluxo_aprovacao}
          aoMudar={(valor) => mudar('possui_fluxo_aprovacao', valor)}
        />
        <Marcador
          rotulo="Contém digital"
          descricao="A exibição inclui uma parcela de mídia digital."
          marcado={rascunho.contem_digital}
          aoMudar={(valor) => mudar('contem_digital', valor)}
        />
        <Marcador
          rotulo="Redes sociais"
          descricao="O programa tem presença própria nas redes sociais."
          marcado={rascunho.redes_sociais}
          aoMudar={(valor) => mudar('redes_sociais', valor)}
        />
        <Marcador
          rotulo="Aceita regional"
          descricao="O programa vende ações locais por praça, além da grade nacional. Libera a aba Regional e o bloco abaixo."
          marcado={rascunho.aceita_regional}
          aoMudar={(valor) => mudar('aceita_regional', valor)}
        />
      </div>
    </fieldset>
  )
}

/**
 * Bloco regional — Task 10. Some da tela quando `aceita_regional` está
 * desmarcado, tanto porque os campos não fazem sentido para um programa que
 * não vende regional quanto porque `paraPrograma` já grava `null` neles
 * assim que o marcador é desligado.
 *
 * Os custos POR PRAÇA (mídia e direitos de TV e digital) não moram neste
 * bloco — moram na aba Regional (`TabelaDeCustosRegionais`), porque variam
 * por praça. Já o custo de produção regional é único para o programa
 * inteiro (uma ação com 3 praças paga a produção uma vez, não três —
 * `src/lib/dominio/custo-da-acao-regional.ts`) e por isso mora aqui, junto
 * do resto do estrutural: em que dia da semana existe o slot regional, com
 * que prazo, quantas praças cabem numa ação, e o bloqueio mensal — que é
 * PRÓPRIO do regional, diferente do "Bloqueio mensal" nacional acima
 * (`bloqueio_mensal`): o documento da área diz 4 ações por mês no regional,
 * um número que não tem relação com o bloqueio mensal nacional já
 * configurado (12 no Encontro, 2 no É de Casa). A regra em si (4 ações
 * fecham o mês) ainda não é aplicada em lugar nenhum — só o dado é
 * cadastrado aqui, à espera do calendário regional.
 */
function BlocoRegional({ rascunho, mudar }: PropsDoBloco) {
  if (!rascunho.aceita_regional) return null

  return (
    <fieldset className="flex flex-col gap-3 border-t border-[var(--borda)] pt-5">
      <TituloDoBloco texto="Regional" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[var(--texto-2)]">
            Dia da semana da ação regional
          </span>
          <select
            value={rascunho.dia_da_semana_regional}
            onChange={(evento) => mudar('dia_da_semana_regional', evento.target.value)}
            className="h-[40px] cursor-pointer rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)]"
          >
            <option value="">Selecione…</option>
            {DIAS_DA_SEMANA.map((dia) => (
              <option key={dia.valor} value={dia.valor}>
                {dia.rotulo}
              </option>
            ))}
          </select>
        </label>
        <Campo
          rotulo="Prazo mínimo regional (dias)"
          tipo="number"
          valor={rascunho.prazo_minimo_regional_dias}
          aoMudar={(valor) => mudar('prazo_minimo_regional_dias', valor)}
          ajuda="Com quantos dias de antecedência uma ação regional precisa ser fechada."
        />
        <Campo
          rotulo="Máximo de praças por ação"
          tipo="number"
          valor={rascunho.max_pracas_por_acao}
          aoMudar={(valor) => mudar('max_pracas_por_acao', valor)}
          ajuda="Quantas praças um mesmo cliente pode reunir numa única ação regional."
        />
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-[var(--texto-2)]">Custo de produção regional</span>
          <input
            type="text"
            value={rascunho.custo_producao_regional}
            placeholder="0,00"
            onChange={(evento) => mudar('custo_producao_regional', evento.target.value)}
            onBlur={() => mudar('custo_producao_regional', formatarMoeda(paraNumero(rascunho.custo_producao_regional)))}
            className="h-[40px] rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-3 text-[13.5px] text-[var(--texto)] outline-none placeholder:text-[var(--placeholder)] focus:border-[#A031F5]"
          />
          <span className="text-[11.5px] text-[var(--texto-3)]">
            Único para a ação inteira — não multiplica pelo número de praças compradas.
          </span>
        </label>
        <Campo
          rotulo="Bloqueio mensal regional"
          tipo="number"
          valor={rascunho.bloqueio_mensal_regional}
          aoMudar={(valor) => mudar('bloqueio_mensal_regional', valor)}
          ajuda="Quantas ações regionais fecham o mês para novas propostas — diferente do bloqueio mensal nacional acima."
        />
      </div>
      <p className="text-[11.5px] text-[var(--texto-3)]">
        Os custos por praça (mídia, direitos de TV e digital) ficam na aba Regional deste programa.
      </p>
    </fieldset>
  )
}
