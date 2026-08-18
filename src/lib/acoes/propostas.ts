'use server'

import { criarClienteServidor } from '../supabase/cliente-servidor'
import { obterSessao } from '../sessao-servidor'
import { obterPrograma } from '../dados/programas'
import { listarDatasEspeciais } from '../dados/datas-especiais'
import { listarPrecos } from '../dados/regional'
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

export async function gerarProposta(entrada: EntradaGerarProposta): Promise<ResultadoGerarProposta> {
  const sessao = await obterSessao()
  if (!sessao) {
    return {
      propostaId: null,
      consultaId: null,
      pdfGerado: false,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: 'Sessão expirada. Entre de novo.',
    }
  }

  // Primeiro portão: revalidação e gravação do retrato da consulta.
  const consulta = await gravarConsulta({
    clienteId: entrada.clienteId,
    programaId: entrada.programaId,
    modalidade: entrada.modalidade,
    itens: entrada.itens,
  })

  if (!consulta.id || consulta.erros.length > 0) {
    return {
      propostaId: null,
      consultaId: null,
      pdfGerado: false,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: consulta.erros[0] ?? 'Não foi possível validar a consulta antes da proposta.',
    }
  }

  const programa = await obterPrograma(entrada.programaId)
  if (!programa) {
    return {
      propostaId: null,
      consultaId: consulta.id,
      pdfGerado: false,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: 'Programa não encontrado.',
    }
  }

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
      valor_midia_tv: resumo.midia_tv,
      valor_midia_digital: resumo.midia_digital,
      valor_simulcast: resumo.simulcast,
      valor_total_comercial: resumo.total_comercial,
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
    return {
      propostaId: null,
      consultaId: consulta.id,
      pdfGerado: false,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: 'Não foi possível criar a proposta.',
    }
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

    await supabase
      .from('propostas')
      .update({ pdf_path: pdfPath, status: 'gerada', erro: null })
      .eq('id', propostaId)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gerar o PDF.'
    await supabase.from('propostas').update({ status: 'falha', erro: mensagem }).eq('id', propostaId)
    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: false,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: mensagem,
    }
  }

  const { data: destinatariosRpc, error: erroDestinatarios } = await supabase.rpc('destinatarios_da_proposta', {
    p_programa_id: entrada.programaId,
  })

  if (erroDestinatarios) {
    const mensagem = 'PDF gerado, mas não foi possível resolver os destinatários.'
    await supabase.from('propostas').update({ status: 'falha', erro: mensagem }).eq('id', propostaId)
    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: true,
      emailEnviado: false,
      emailConfigurado: emailMicrosoftConfigurado(),
      destinatarios: [],
      erro: mensagem,
    }
  }

  const destinatarios = ((destinatariosRpc ?? []) as DestinatarioRpc[])
    .filter((item) => Boolean(item.email))

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
    return {
      propostaId,
      consultaId: consulta.id,
      pdfGerado: true,
      emailEnviado: false,
      emailConfigurado: true,
      destinatarios: [],
      erro: mensagem,
    }
  }

  try {
    await supabase.from('propostas').update({ status: 'enviando', erro: null }).eq('id', propostaId)

    await enviarPropostaPorEmail({
      destinatarios,
      assunto: `Proposta ${entrada.marcaNome ?? entrada.clienteNome} · ${entrada.programaNome}`,
      html: `
        <p>Olá,</p>
        <p>Uma nova proposta foi gerada para <strong>${entrada.marcaNome ?? entrada.clienteNome}</strong> no programa <strong>${entrada.programaNome}</strong>.</p>
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
