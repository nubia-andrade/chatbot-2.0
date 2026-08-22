import { criarClienteServico } from '../supabase/cliente-servico'
import { enviarEmailMicrosoft, emailMicrosoftConfigurado } from '../propostas/email-microsoft'

type LinhaMarca = {
  marca_id: string
  cliente_id: string
  criado_por: string | null
  criado_em: string
  revisao_status: 'pendente' | 'revisada'
  marca: { nome: string } | null
  cliente: { nome: string } | null
}

type MarcaDoRelatorio = {
  marca: string
  anunciante: string
  executivo: string
  criadoEm: string
  revisaoStatus: 'pendente' | 'revisada'
}

function escapar(valor: string): string {
  return valor.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function dataIsoNoFusoBrasilia(referencia = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(referencia)
}

function diaAnterior(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10)
}

function intervaloUtcDoDiaBrasilia(dataIso: string): { inicio: string; fim: string } {
  const inicio = new Date(`${dataIso}T03:00:00.000Z`)
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function formatarDataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(valor))
}

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function emailsAdicionais(): string[] {
  return (process.env.RELATORIO_MARCAS_EMAILS ?? '').split(/[;,]/).map((email) => email.trim().toLowerCase()).filter(Boolean)
}

async function destinatariosProprietarios(): Promise<string[]> {
  const supabase = criarClienteServico()
  const { data: perfis } = await supabase.from('perfil_usuario').select('usuario_id').eq('perfil', 'proprietario')
  const ids = new Set((perfis ?? []).map((item) => item.usuario_id as string))
  const { data: usuariosAuth } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })

  const emails = usuariosAuth.users.filter((usuario) => ids.has(usuario.id) && usuario.email).map((usuario) => usuario.email!.trim().toLowerCase())
  for (const email of emailsAdicionais()) emails.push(email)
  if (emails.length === 0) emails.push('nubia.andrade@g.globo')
  return [...new Set(emails)]
}

async function nomesDosExecutivos(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (ids.length === 0) return mapa
  const supabase = criarClienteServico()
  const { data } = await supabase.from('usuario').select('usuario_id, nome').in('usuario_id', ids)
  for (const item of data ?? []) mapa.set(item.usuario_id as string, String(item.nome ?? 'Executivo'))
  return mapa
}

function montarHtml(dataReferencia: string, marcas: MarcaDoRelatorio[]): string {
  const pendentes = marcas.filter((item) => item.revisaoStatus === 'pendente').length
  const linhas = marcas.map((item) => `<tr><td style="padding:12px 10px;border-bottom:1px solid #eceef1;font-weight:700;color:#14161a">${escapar(item.marca)}</td><td style="padding:12px 10px;border-bottom:1px solid #eceef1;color:#5a606a">${escapar(item.anunciante)}</td><td style="padding:12px 10px;border-bottom:1px solid #eceef1;color:#5a606a">${escapar(item.executivo)}</td><td style="padding:12px 10px;border-bottom:1px solid #eceef1;color:#8a909a;white-space:nowrap">${escapar(formatarDataHora(item.criadoEm))}</td><td style="padding:12px 10px;border-bottom:1px solid #eceef1;color:${item.revisaoStatus === 'pendente' ? '#8A5700' : '#087A55'};font-weight:700">${item.revisaoStatus === 'pendente' ? 'Pendente' : 'Revisada'}</td></tr>`).join('')

  const urlBase = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  const botao = urlBase ? `<a href="${escapar(urlBase)}/configuracoes/marcas" style="display:inline-block;background:#14161a;color:white;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Revisar marcas</a>` : ''
  const conteudo = marcas.length === 0
    ? '<div style="padding:22px;background:#f7f8f9;border-radius:12px;color:#5a606a">Nenhuma nova marca foi cadastrada por executivos neste período.</div>'
    : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f7f8f9;text-align:left"><th style="padding:10px">Marca</th><th style="padding:10px">Anunciante</th><th style="padding:10px">Cadastrada por</th><th style="padding:10px">Data</th><th style="padding:10px">Revisão</th></tr></thead><tbody>${linhas}</tbody></table></div>`

  return `<!doctype html><html><body style="margin:0;background:#eceef1;font-family:Arial,sans-serif;color:#14161a"><div style="max-width:900px;margin:0 auto;padding:28px 18px"><div style="background:#14161a;padding:24px;border-radius:18px 18px 0 0;color:white"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ff826c">Globo Slots · Governança</div><h1 style="margin:8px 0 0;font-size:25px">Novas marcas cadastradas</h1><p style="margin:8px 0 0;opacity:.7">Relatório de ${formatarData(dataReferencia)}</p></div><div style="background:white;padding:24px;border-radius:0 0 18px 18px"><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px"><div style="background:#f7f8f9;border-radius:12px;padding:14px 18px"><div style="font-size:11px;color:#8a909a;text-transform:uppercase;font-weight:700">Novas marcas</div><div style="font-size:24px;font-weight:800;margin-top:3px">${marcas.length}</div></div><div style="background:#FFF8EC;border-radius:12px;padding:14px 18px"><div style="font-size:11px;color:#8A5700;text-transform:uppercase;font-weight:700">Pendentes de revisão</div><div style="font-size:24px;font-weight:800;margin-top:3px;color:#8A5700">${pendentes}</div></div></div>${conteudo}${botao ? `<div style="margin-top:22px">${botao}</div>` : ''}<p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#8a909a">Marcas cadastradas na Nova Consulta ficam disponíveis imediatamente para não interromper a jornada comercial. Revise apenas grafia e associação ao anunciante quando necessário.</p></div></div></body></html>`
}

export async function enviarRelatorioDiarioDeMarcas(referencia = new Date()): Promise<{ dataReferencia: string; quantidade: number; enviado: boolean; motivo?: string }> {
  if (!emailMicrosoftConfigurado()) throw new Error('Microsoft 365 ainda não está configurado para o relatório diário de marcas.')

  const hojeBrasilia = dataIsoNoFusoBrasilia(referencia)
  const dataReferencia = diaAnterior(hojeBrasilia)
  const { inicio, fim } = intervaloUtcDoDiaBrasilia(dataReferencia)
  const supabase = criarClienteServico()

  const { data: execucao } = await supabase.from('relatorio_marcas_diario').select('data_referencia').eq('data_referencia', dataReferencia).maybeSingle()
  if (execucao) return { dataReferencia, quantidade: 0, enviado: false, motivo: 'Relatório já enviado para esta data.' }

  const { data, error } = await supabase.from('marca_cliente_manual').select('marca_id, cliente_id, criado_por, criado_em, revisao_status, marca:marcas(nome), cliente:clientes(nome)').eq('origem', 'consulta').gte('criado_em', inicio).lt('criado_em', fim).order('criado_em', { ascending: true })
  if (error) throw new Error(`Falha ao carregar novas marcas: ${error.message}`)

  const linhas = (data ?? []) as unknown as LinhaMarca[]
  const ids = [...new Set(linhas.map((item) => item.criado_por).filter((id): id is string => Boolean(id)))]
  const nomes = await nomesDosExecutivos(ids)
  const marcas: MarcaDoRelatorio[] = linhas.map((linha) => ({ marca: linha.marca?.nome ?? 'Marca', anunciante: linha.cliente?.nome ?? 'Anunciante', executivo: linha.criado_por ? nomes.get(linha.criado_por) ?? 'Executivo' : 'Executivo', criadoEm: linha.criado_em, revisaoStatus: linha.revisao_status }))

  const destinatarios = await destinatariosProprietarios()
  await enviarEmailMicrosoft({ para: destinatarios.map((email) => ({ email })), assunto: `[Globo Slots] Novas marcas · ${formatarData(dataReferencia)} · ${marcas.length}`, html: montarHtml(dataReferencia, marcas) })

  const { error: erroRegistro } = await supabase.from('relatorio_marcas_diario').insert({ data_referencia: dataReferencia, quantidade: marcas.length })
  if (erroRegistro) console.error('Relatório enviado, mas falhou ao registrar execução:', erroRegistro.message)

  return { dataReferencia, quantidade: marcas.length, enviado: true }
}
