'use server'

import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { podeConsultarRegional } from '../dominio/perfis'
import { obterPrograma } from '../dados/programas'
import { carregarDisponibilidade } from '../dados/disponibilidade'
import {
  validarConsulta,
  totalDaConsulta,
  type ConsultaEmMontagem,
} from '../dominio/consulta'
import type { DiaDeDisponibilidade } from '../dominio/disponibilidade'

/**
 * `gravarConsulta` — o ÚLTIMO portão antes do banco.
 *
 * Tudo que a tela validou é conveniência. O que vale de verdade roda aqui:
 * sessão presente, perfil autoriza a modalidade pedida, e a disponibilidade é
 * recalculada NO SERVIDOR — não confia no que o navegador mandou, porque
 * entre abrir o calendário e clicar em gravar alguém pode ter vendido a data.
 */

const ERRO_SESSAO_EXPIRADA = 'Sessão expirada. Entre de novo.'
const ERRO_SEM_PERMISSAO_REGIONAL = 'Você não tem permissão para consultar disponibilidade regional.'
const ERRO_PROGRAMA = 'Programa não encontrado.'
const ERRO_CLIENTE = 'Cliente não encontrado.'
const ERRO_GRAVACAO = 'Não foi possível gravar a consulta. Tente novamente.'

type LinhaDeCliente = {
  id: string
  nome: string
  setor: string | null
  industria: string | null
}

function anoMesDeData(dataIso: string): { ano: number; mes: number } {
  const [ano, mes] = dataIso.split('-').map(Number)
  return { ano, mes }
}

/**
 * Todos os meses distintos que os itens da consulta tocam — normalmente um
 * só, mas o executivo pode ter navegado entre meses do calendário antes de
 * fechar a consulta, e cada um precisa da própria carga.
 */
function mesesDistintosDosItens(itens: ConsultaEmMontagem['itens']): { ano: number; mes: number }[] {
  const chaves = new Map<string, { ano: number; mes: number }>()
  for (const item of itens) {
    const { ano, mes } = anoMesDeData(item.data)
    chaves.set(`${ano}-${mes}`, { ano, mes })
  }
  return [...chaves.values()]
}

/** Avisos de retrato: datas selecionadas cuja concorrência não pôde ser conferida (R14) por anunciante não classificado. */
function montarAvisos(
  itens: ConsultaEmMontagem['itens'],
  dias: DiaDeDisponibilidade[],
): { data: string; acoes_sem_classificacao: number }[] {
  const porData = new Map(dias.map((dia) => [dia.data, dia]))
  const avisos: { data: string; acoes_sem_classificacao: number }[] = []
  for (const item of itens) {
    const dia = porData.get(item.data)
    if (dia && dia.acoes_sem_classificacao > 0) {
      avisos.push({ data: item.data, acoes_sem_classificacao: dia.acoes_sem_classificacao })
    }
  }
  return avisos
}

export async function gravarConsulta(
  consulta: ConsultaEmMontagem,
): Promise<{ id: string | null; erros: string[] }> {
  // 1. Sem sessão, nada acontece.
  const sessao = await obterSessao()
  if (!sessao) return { id: null, erros: [ERRO_SESSAO_EXPIRADA] }

  // 2. Regional exige o perfil — esconder o botão na tela é conveniência,
  // isto é a proteção real (junto com o RLS de `consultas`/`consulta_itens`).
  if (consulta.modalidade === 'regional' && !podeConsultarRegional(sessao.perfis)) {
    return { id: null, erros: [ERRO_SEM_PERMISSAO_REGIONAL] }
  }

  if (!consulta.clienteId || !consulta.programaId) {
    return { id: null, erros: validarConsulta(consulta, [], 0, 0, 0) }
  }

  const programa = await obterPrograma(consulta.programaId)
  if (!programa) return { id: null, erros: [ERRO_PROGRAMA] }

  const supabase = await criarClienteServidor()

  const { data: clienteLinha, error: erroCliente } = await supabase
    .from('clientes')
    .select('id, nome, setor, industria')
    .eq('id', consulta.clienteId)
    .maybeSingle()

  if (erroCliente) {
    console.error('Falha ao carregar cliente para gravação da consulta:', erroCliente.message)
    return { id: null, erros: [ERRO_GRAVACAO] }
  }
  const cliente = clienteLinha as LinhaDeCliente | null
  if (!cliente) return { id: null, erros: [ERRO_CLIENTE] }

  // 3. Recarrega a disponibilidade NO SERVIDOR, um mês por vez (nunca uma
  // consulta por célula), e revalida a consulta de novo sobre os dias
  // recém-calculados. O que o navegador mandou não é confiável.
  const meses = mesesDistintosDosItens(consulta.itens)
  const cargas = await Promise.all(
    meses.map((am) =>
      carregarDisponibilidade({
        programaId: consulta.programaId!,
        clienteId: consulta.clienteId!,
        modalidade: consulta.modalidade,
        ano: am.ano,
        mes: am.mes,
      }),
    ),
  )

  const cargaComErro = cargas.find((carga) => carga.erro !== null)
  if (cargaComErro) return { id: null, erros: [cargaComErro.erro!] }

  const dias = cargas.flatMap((carga) => carga.dias)

  const erros = validarConsulta(
    consulta,
    dias,
    programa.acoes_minimas,
    programa.acoes_maximas,
    programa.max_pracas_por_acao,
  )
  if (erros.length > 0) return { id: null, erros }

  // 4. Grava o retrato: `consultas` primeiro, `consulta_itens` depois, num
  // lote só, com o `id` que a policy de inserção de `consulta_itens` exige.
  const valorTotal = totalDaConsulta(consulta, dias)
  const avisos = montarAvisos(consulta.itens, dias)

  const { data: consultaGravada, error: erroConsulta } = await supabase
    .from('consultas')
    .insert({
      usuario_id: sessao.usuarioId,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      cliente_setor: cliente.setor,
      cliente_industria: cliente.industria,
      programa_id: programa.id,
      programa_nome: programa.nome,
      modalidade: consulta.modalidade,
      valor_total: valorTotal,
      avisos,
    })
    .select('id')
    .single()

  if (erroConsulta || !consultaGravada) {
    console.error('Falha ao gravar consulta:', erroConsulta?.message)
    return { id: null, erros: [ERRO_GRAVACAO] }
  }

  const porData = new Map(dias.map((dia) => [dia.data, dia]))

  // Itens agrupados por data — a tabela tem `unique (consulta_id, data)`, e a
  // tela pode ter mandado mais de um item para a mesma data (ex.: praças
  // adicionadas em passos diferentes do wizard).
  const itensPorData = new Map<string, { quantidade: number; pracas: Set<string> }>()
  for (const item of consulta.itens) {
    const acumulado = itensPorData.get(item.data) ?? { quantidade: 0, pracas: new Set<string>() }
    acumulado.quantidade += item.quantidade
    for (const praca of item.pracas) acumulado.pracas.add(praca)
    itensPorData.set(item.data, acumulado)
  }

  const linhas = [...itensPorData.entries()].map(([data, acumulado]) => {
    const dia = porData.get(data)
    const valorUnitario = dia?.valor_unitario ?? null
    return {
      consulta_id: consultaGravada.id as string,
      data,
      quantidade: acumulado.quantidade,
      pracas: [...acumulado.pracas],
      valor_unitario: valorUnitario,
      valor_total: valorUnitario !== null ? valorUnitario * acumulado.quantidade : 0,
      periodo_especial_nome: dia?.periodo_especial?.nome ?? null,
      periodo_especial_percentual: dia?.periodo_especial?.percentual ?? null,
    }
  })

  const { error: erroItens } = await supabase.from('consulta_itens').insert(linhas)

  if (erroItens) {
    console.error('Falha ao gravar itens da consulta:', erroItens.message)
    // A consulta já existe sem os itens — melhor avisar do que deixar a tela
    // achar que nada foi gravado e o executivo tentar de novo, duplicando.
    return { id: consultaGravada.id as string, erros: [ERRO_GRAVACAO] }
  }

  return { id: consultaGravada.id as string, erros: [] }
}
