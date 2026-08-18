'use server'

import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { obterPrograma } from '../dados/programas'
import { listarDatasEspeciais } from '../dados/datas-especiais'
import { listarPrecos } from '../dados/regional'
import { carregarDisponibilidade } from '../dados/disponibilidade'
import { calcularResumoFinanceiro, type ItemParaResumoFinanceiro } from '../dominio/resumo-financeiro'
import { gravarConsulta } from './consultas'
import { gerarPdfDaProposta } from '../propostas/pdf'
import { enviarPropostaPorEmail, emailMicrosoftConfigurado } from '../propostas/email-microsoft'

export type EntradaGerarProposta = {
  marcaId: string | null
  marcaNome: string | null
  clienteId: string
  clienteNome: string
  programaId: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  itens: ItemParaResumoFinanceiro[]
  incluirDigital: boolean
  incluirRedesSociais: boolean
}

export type ResultadoGerarProposta = {
  propostaId: string | null
  consultaId: string | null
  pdfGerado: boolean
  emailEnviado: boolean
  emailConfigurado: boolean
  destinatarios: string[]
  erro: string | null
}

type DestinatarioRpc = {
  usuario_id: string
  email: string
  tipo: 'executivo' | 'consultor_programa'
}

function resultadoFalha(erro: string, extras: Partial<ResultadoGerarProposta> = {}): ResultadoGerarProposta {
  return {
    propostaId: null,
    consultaId: null,
    pdfGerado: false,
    emailEnviado: false,
    emailConfigurado: emailMicrosoftConfigurado(),
    destinatarios: [],
    erro,
    ...extras,
  }
}

function mesesDaEntrada(itens: ItemParaResumoFinanceiro[]): { ano: number; mes: number; quantidade: number }[] {
  const mapa = new Map<string, Set<string>>()
  for (const item of itens) {
    const chave = item.data.slice(0, 7)
    const datas = mapa.get(chave) ?? new Set<string>()
    datas.add(item.data)
    mapa.set(chave, datas)
  }
  return [...mapa.entries()].map(([chave, datas]) => {
    const [ano, mes] = chave.split('-').map(Number)
    return { ano, mes, quantidade: datas.size }
  })
}

async function validarLimiteMensal(entrada: EntradaGerarProposta): Promise<string | null> {
  if (entrada.modalidade !== 'nacional') return null

  for (const mes of mesesDaEntrada(entrada.itens)) {
    const carga = await carregarDisponibilidade({
      programaId: entrada.programaId,
      clienteId: entrada.clienteId,
      modalidade: entrada.modalidade,
      ano: mes.ano,
      mes: mes.mes,
    })
    if (carga.erro) return carga.erro
    if (carga.limiteMensal > 0 && carga.acoesDoAnuncianteNoMes + mes.quantidade > carga.limiteMensal) {
      return `O anunciante ultrapassaria o limite de ${carga.limiteMensal} ações no programa em ${String(mes.mes).padStart(2, '0')}/${mes.ano}.`
    }
  }

  return null
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function gerarProposta(entrada: EntradaGerarProposta): Promise<ResultadoGerarProposta> {
  const sessao = await obterSessao()
  if (!sessao) return resultadoFalha('Sessão expirada. Entre de novo.')
  if (entrada.itens.length === 0) return resultadoFalha('Selecione ao menos uma data para gerar a proposta.')

  const erroLimite = await validarLimiteMensal(entrada)
  if (erroLimite) return resultadoFalha(erroLimite)

  const consulta = await gravarConsulta({
    clienteId: entrada.clienteId,
    programaId: entrada.programaId,
    modalidade: entrada.modalidade,
    itens: entrada.itens,
  })

  if (!consulta.id || consulta.erros.length > 0) {
    return resultadoFalha(consulta.erros[0] ?? 'Não foi possível validar a consulta antes da proposta.')
  }

  const programa = await obterPrograma(entrada.programaId)
  if (!programa) return resultadoFalha('Programa não encontrado.', { consultaId: consulta.id })

  const [periodosEspeciais, precosRegionais] = await Promise.all([
    listarDatasEspeciais(entrada.programaId),
    entrada.modalidade === 'regional' ? listarPrecos(entrada.programaId) : Promise.resolve([]),
  ])

  const resumo = calcularResumoFinanceiro({
    programa,
    modalidade: entrada.modalidade,
    itens: entrada.itens,
    periodosEspeciais,
    precosRegionais,
    incluirDigital: entrada.incluirDigital,
    incluirRedesSociais: entrada.incluirRedesSociais,
  })

  const supabase = await criarClienteServidor()

  const { data: proposta, error: erroProposta } = await supabase
    .from('propostas')
    .insert({
      consulta_id: consulta.id,
      usuario_id: sessao.usuarioId,
      marca_id: entrada.marcaId,
      marca_nome: entrada.marcaNome,
      cliente_id: entrada.clienteId,
      cliente_nome: entrada.clienteNome,
      programa_id: entrada.programaId,
      programa_nome: entrada.programaNome,
      modalidade: entrada.modalidade,
      inclui_digital: resumo.incluir_digital,
      inclui_redes_sociais: resumo.incluir_redes_sociais,
      valor_midia_tv: resumo.midia_tv,
      valor_midia_digital: resumo.midia_digital,
      valor_redes_sociais: resumo.redes_sociais,
      valor_simulcast: resumo.simulcast,
      valor_total_comercial: resumo.total_comercial,
      valor_producao_tv: resumo.producao_tv,
      valor_producao_digital: resumo.producao_digital,
      valor_producao_redes_sociais: resumo.producao_redes_sociais,
      valor_producao: resumo.producao,
      valor_direitos_tv: resumo.direitos_tv,
      valor_direitos_digital: resumo.direitos_digital,
      valor_direitos_total: resumo.direitos_total,
      valor_total_geral: resumo.total_geral,
      status: 'gerando',
    })
    .select('id')
    .single()

  if (erroProposta || !proposta?.id) {
    console.error('Falha ao criar proposta:', erroProposta?.message)
    return resultadoFalha('Não foi possível criar a proposta.', { consultaId: consulta.id })
  }

  const propostaId = proposta.id as string
  const pdfPath = `${sessao.usuarioId}/${propostaId}.pdf`

  let pdf: Uint8Array
  try {
    pdf = await gerarPdfDaProposta({
      propostaId,
      marcaNome: entrada.marcaNome,
      clienteNome: entrada.clienteNome,
      programaNome: entrada.programaNome,
      modalidade: entrada.modalidade,
      resumo,
    })

    const { error: erroUpload } = await supabase.storage
      .from('propostas')
      .upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true })

    if (erroUpload) throw new Error(erroUpload.message)

    await supabase.from('propostas').update({ pdf_path: pdfPath, status: 'gerada', erro: null }).eq('id', propostaId)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gerar o PDF.'
    await supabase.from('propostas').update({ status: 'falha', erro: mensagem }).eq('id', propostaId)
    return resultadoFalha(mensagem, { propostaId, consultaId: consulta.id })
  }

  const { data: destinatariosRpc, error: erroDestinatarios } = await supabase.rpc('destinatarios_da_proposta', {
    p_programa_id: entrada.programaId,
  })

  if (erroDestinatarios) {
    const mensagem = 'PDF gerado, mas não foi possível resolver os destinatários.'
    await supabase.from('propostas').update({ status: 'falha', erro: mensagem }).eq('id', propostaId)
    return resultadoFalha(mensagem, { propostaId, consultaId: consulta.id, pdfGerado: true })
  }

  const destinatarios = ((destinatariosRpc ?? []) as DestinatarioRpc[]).filter((item) => Boolean(item.email))

  if (destinatarios.length > 0) {
    await supabase.from('proposta_destinatarios').upsert(
      destinatarios.map((item) => ({
        proposta_id: propostaId,
        usuario_id: item.usuario_id,
        email: item.email,
        tipo: item.tipo,
        status: 'pendente',
      })),
      { onConflict: 'proposta_id,email' },
    )
  }

  if (!emailMicrosoftConfigurado()) {
    const mensagem = 'PDF gerado. O envio por e-mail aguarda configuração do Microsoft 365.'
    await supabase.from('propostas').update({ status: 'gerada', erro: mensagem }).eq('id', propostaId)
    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: true,
      emailEnviado: false,
      emailConfigurado: false,
      destinatarios: destinatarios.map((item) => item.email),
      erro: null,
    }
  }

  if (destinatarios.length === 0) {
    const mensagem = 'PDF gerado, mas não há destinatários com e-mail para este programa.'
    await supabase.from('propostas').update({ status: 'gerada', erro: mensagem }).eq('id', propostaId)
    return resultadoFalha(mensagem, { propostaId, consultaId: consulta.id, pdfGerado: true, emailConfigurado: true })
  }

  try {
    await supabase.from('propostas').update({ status: 'enviando', erro: null }).eq('id', propostaId)

    await enviarPropostaPorEmail({
      destinatarios,
      assunto: `Proposta ${entrada.marcaNome ?? entrada.clienteNome} · ${entrada.programaNome}`,
      html: `
        <p>Olá,</p>
        <p>Uma nova proposta foi gerada para <strong>${escaparHtml(entrada.marcaNome ?? entrada.clienteNome)}</strong> no programa <strong>${escaparHtml(entrada.programaNome)}</strong>.</p>
        <p>Total comercial: <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.total_comercial)}</strong>.</p>
        <p>O PDF da proposta segue em anexo.</p>
      `,
      pdf,
      nomeArquivo: `proposta-${propostaId.slice(0, 8)}.pdf`,
    })

    const agora = new Date().toISOString()
    await Promise.all([
      supabase.from('propostas').update({ status: 'enviada', erro: null, enviado_em: agora }).eq('id', propostaId),
      supabase.from('proposta_destinatarios').update({ status: 'enviado', erro: null, enviado_em: agora }).eq('proposta_id', propostaId),
    ])

    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: true,
      emailEnviado: true,
      emailConfigurado: true,
      destinatarios: destinatarios.map((item) => item.email),
      erro: null,
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao enviar a proposta por e-mail.'
    await Promise.all([
      supabase.from('propostas').update({ status: 'falha', erro: mensagem }).eq('id', propostaId),
      supabase.from('proposta_destinatarios').update({ status: 'falha', erro: mensagem }).eq('proposta_id', propostaId),
    ])

    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: true,
      emailEnviado: false,
      emailConfigurado: true,
      destinatarios: destinatarios.map((item) => item.email),
      erro: mensagem,
    }
  }
}
