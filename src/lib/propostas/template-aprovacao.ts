import { deveExibirClienteComMarca, nomePrincipalDaProposta } from '../dominio/exibicao-marca-cliente'

type ItemData = { data: string; pracas?: string[] }

export type DadosEmailAprovacao = {
  executivoNome: string
  clienteNome: string
  marcaNome: string | null
  produto: string
  programaNome: string
  modalidade: 'nacional' | 'regional'
  objetivo: string
  itens: ItemData[]
  totalComercial: number
  linkAprovacoes?: string | null
  linkPdf?: string | null
  justificativa?: string | null
}

function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataPtBr(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

function resumoDatas(itens: ItemData[]): string {
  const ordenadas = [...new Set(itens.map((item) => item.data))].sort()
  if (ordenadas.length === 0) return 'Não informada'
  if (ordenadas.length <= 4) return ordenadas.map(dataPtBr).join(', ')
  return `${ordenadas.length} datas · ${dataPtBr(ordenadas[0])} a ${dataPtBr(ordenadas[ordenadas.length - 1])}`
}

function pracas(itens: ItemData[]): string | null {
  const codigos = [...new Set(itens.flatMap((item) => item.pracas ?? []))]
  return codigos.length ? codigos.join(', ') : null
}

function linha(rotulo: string, valor: string): string {
  return `<tr><td style="padding:8px 0;color:#777082;font-size:12px;width:145px;vertical-align:top">${escapar(rotulo)}</td><td style="padding:8px 0;color:#221D2B;font-size:13px;font-weight:600;vertical-align:top">${escapar(valor)}</td></tr>`
}

function estrutura(params: {
  etiqueta: string
  titulo: string
  introducao: string
  dados: DadosEmailAprovacao
  chamada?: string
  link?: string | null
  rodape: string
  destaque?: string | null
}): string {
  const p = pracas(params.dados.itens)
  const marca = nomePrincipalDaProposta(params.dados.marcaNome, params.dados.clienteNome)
  const exibirCliente = deveExibirClienteComMarca(params.dados.marcaNome, params.dados.clienteNome)
  return `<!doctype html><html><body style="margin:0;background:#F4F2F8;font-family:Arial,Helvetica,sans-serif;color:#221D2B">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F2F8;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#fff;border-radius:20px;overflow:hidden">
      <tr><td style="height:10px;background:linear-gradient(90deg,#FF195F,#9B2CF3,#436CFF)"></td></tr>
      <tr><td style="padding:30px 34px 10px">
        <div style="font-size:12px;font-weight:700;color:#8C2EF4;letter-spacing:.08em;text-transform:uppercase">Globo · ${escapar(params.etiqueta)}</div>
        <h1 style="margin:10px 0 8px;font-size:26px;line-height:1.15">${escapar(params.titulo)}</h1>
        <p style="margin:0;color:#777082;font-size:14px;line-height:1.55">${escapar(params.introducao)}</p>
      </td></tr>
      <tr><td style="padding:16px 34px">
        <div style="background:#F8F6FC;border:1px solid #ECE7F3;border-radius:14px;padding:16px 18px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${linha('Executivo', params.dados.executivoNome)}
            ${linha('Marca', marca)}
            ${exibirCliente ? linha('Anunciante', params.dados.clienteNome) : ''}
            ${linha('Produto', params.dados.produto)}
            ${linha('Programa', params.dados.programaNome)}
            ${linha('Modalidade', params.dados.modalidade === 'regional' ? 'Regional' : 'Nacional')}
            ${p ? linha('Praças', p) : ''}
            ${linha('Exibição', resumoDatas(params.dados.itens))}
            ${linha('Objetivo', params.dados.objetivo)}
          </table>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #E4DEEC">
            <div style="font-size:11px;color:#777082;text-transform:uppercase;font-weight:700">Total comercial</div>
            <div style="margin-top:4px;font-size:22px;font-weight:800;color:#F51668">${escapar(moeda(params.dados.totalComercial))}</div>
          </div>
        </div>
        ${params.destaque ? `<div style="margin-top:14px;background:#FFF5F7;border:1px solid #FFD4E1;border-radius:12px;padding:14px 16px"><div style="font-size:11px;font-weight:700;color:#C51952;text-transform:uppercase">Justificativa</div><div style="margin-top:5px;font-size:13px;line-height:1.5">${escapar(params.destaque)}</div></div>` : ''}
      </td></tr>
      ${params.chamada && params.link ? `<tr><td align="center" style="padding:5px 34px 25px"><a href="${escapar(params.link)}" style="display:inline-block;background:linear-gradient(90deg,#EF2170,#6250FF);color:white;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:12px">${escapar(params.chamada)}</a></td></tr>` : ''}
      <tr><td style="padding:18px 34px 26px;border-top:1px solid #F0ECF4;color:#958E9E;font-size:11px;line-height:1.45">${escapar(params.rodape)}</td></tr>
    </table>
  </td></tr></table></body></html>`
}

function assuntoBase(prefixo: string, d: DadosEmailAprovacao): string {
  return `${prefixo} · ${d.programaNome} · ${nomePrincipalDaProposta(d.marcaNome, d.clienteNome)}`
}

export function assuntoSolicitacaoAprovacao(d: DadosEmailAprovacao): string {
  return assuntoBase('Aprovação pendente', d)
}

export function montarEmailSolicitacaoAprovacao(d: DadosEmailAprovacao): string {
  return estrutura({
    etiqueta: 'Aprovação de proposta',
    titulo: 'Nova proposta aguardando sua aprovação',
    introducao: `${d.executivoNome} concluiu uma consulta de ${d.programaNome}. Revise os dados e aprove ou rejeite a proposta no Chatbot 2.0.`,
    dados: d,
    chamada: 'Revisar proposta',
    link: d.linkAprovacoes,
    rodape: 'Esta mensagem é uma notificação interna do fluxo de aprovação do Chatbot 2.0.',
  })
}

export function assuntoPropostaAprovada(d: DadosEmailAprovacao): string {
  return assuntoBase('Proposta aprovada', d)
}

export function montarEmailPropostaAprovada(d: DadosEmailAprovacao): string {
  return estrutura({
    etiqueta: 'Proposta aprovada',
    titulo: 'Sua proposta foi aprovada',
    introducao: `A proposta de ${d.programaNome} foi aprovada e o PDF já está liberado para consulta.`,
    dados: d,
    chamada: 'Abrir proposta',
    link: d.linkPdf,
    rodape: 'O link é seguro e possui validade limitada. Uma nova versão exigirá nova aprovação quando o programa mantiver esse fluxo.',
  })
}

export function assuntoPropostaRejeitada(d: DadosEmailAprovacao): string {
  return assuntoBase('Ajuste solicitado', d)
}

export function montarEmailPropostaRejeitada(d: DadosEmailAprovacao): string {
  return estrutura({
    etiqueta: 'Revisão necessária',
    titulo: 'Sua proposta precisa de ajustes',
    introducao: `A proposta de ${d.programaNome} não foi aprovada nesta versão. A justificativa está abaixo; você pode criar uma nova versão para corrigir e reenviar.`,
    dados: d,
    destaque: d.justificativa ?? 'Ajustes solicitados pelo consultor do programa.',
    rodape: 'A versão rejeitada permanece registrada para auditoria, mas o PDF não é liberado ao executivo.',
  })
}
