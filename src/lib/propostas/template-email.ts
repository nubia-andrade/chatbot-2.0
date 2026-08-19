import type { ItemParaResumoFinanceiro } from '../dominio/resumo-financeiro'

function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function imagemExternaSegura(valor: string | null | undefined): string | null {
  const url = (valor ?? '').trim()
  if (!/^https?:\/\//i.test(url)) return null
  try {
    const analisada = new URL(url)
    if (analisada.protocol !== 'http:' && analisada.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function moeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function datasDaProposta(itens: ItemParaResumoFinanceiro[]): string {
  const datas = [...new Set(itens.map((item) => item.data))].sort()
  return datas.map(formatarData).join(' · ')
}

function pracasDaProposta(itens: ItemParaResumoFinanceiro[]): string {
  const pracas = [...new Set(itens.flatMap((item) => item.pracas))]
  return pracas.join(' · ')
}

function linhaResumo(rotulo: string, valor: string): string {
  return `
    <tr>
      <td style="padding:0 0 12px 0;vertical-align:top;width:145px;font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#7a7480;text-transform:uppercase;font-weight:700;letter-spacing:.35px;">${escaparHtml(rotulo)}</td>
      <td style="padding:0 0 12px 0;vertical-align:top;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#211d24;font-weight:700;">${escaparHtml(valor)}</td>
    </tr>
  `
}

export type DadosDoEmailDaProposta = {
  executivoNome: string
  clienteNome: string
  marcaNome: string | null
  produto: string
  programaNome: string
  programaImagemUrl?: string | null
  modalidade: 'nacional' | 'regional'
  objetivo: string
  itens: ItemParaResumoFinanceiro[]
  totalComercial: number
  linkPdf: string
}

export function assuntoDoEmailDaProposta(dados: DadosDoEmailDaProposta): string {
  return `Proposta comercial · ${dados.marcaNome ?? dados.clienteNome} · ${dados.programaNome}`
}

export function montarEmailDaProposta(dados: DadosDoEmailDaProposta): string {
  const marca = dados.marcaNome?.trim() || null
  const datas = datasDaProposta(dados.itens)
  const pracas = dados.modalidade === 'regional' ? pracasDaProposta(dados.itens) : ''
  const modalidade = dados.modalidade === 'regional' ? 'Regional' : 'Nacional'
  const imagemPrograma = imagemExternaSegura(dados.programaImagemUrl)
  const hero = imagemPrograma
    ? `<tr><td style="padding:0;background:#211d24;"><img src="${escaparHtml(imagemPrograma)}" width="640" alt="${escaparHtml(dados.programaNome)}" style="display:block;width:100%;max-width:640px;height:auto;max-height:220px;border:0;outline:none;text-decoration:none;object-fit:cover;"></td></tr>`
    : ''

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f2f7;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f2f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e7e3ea;">
          ${hero}
          <tr>
            <td style="background:#f20a6b;padding:${imagemPrograma ? '20px 34px 19px 34px' : '28px 34px 24px 34px'};">
              <div style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#ffffff;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.88;">Globo Publicidade</div>
              <div style="margin-top:6px;font-family:Arial,sans-serif;font-size:${imagemPrograma ? '25px' : '30px'};line-height:${imagemPrograma ? '30px' : '34px'};color:#ffffff;font-weight:700;">${escaparHtml(dados.programaNome)}</div>
              <div style="margin-top:6px;font-family:Arial,sans-serif;font-size:13px;line-height:19px;color:#ffffff;opacity:.92;">Nova proposta comercial pronta para consulta</div>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 34px 8px 34px;">
              <div style="font-family:Arial,sans-serif;font-size:20px;line-height:26px;color:#211d24;font-weight:700;">Olá, ${escaparHtml(dados.executivoNome)}.</div>
              <div style="margin-top:8px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#716a76;">A proposta abaixo foi gerada no Chatbot 2.0 e já está disponível para abertura.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 34px 6px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#faf8fb;border:1px solid #ece8ef;border-radius:14px;">
                <tr>
                  <td style="padding:22px 22px 8px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${linhaResumo('Anunciante', dados.clienteNome)}
                      ${marca ? linhaResumo('Marca', marca) : ''}
                      ${linhaResumo('Produto', dados.produto)}
                      ${linhaResumo('Programa', dados.programaNome)}
                      ${linhaResumo('Modalidade', modalidade)}
                      ${pracas ? linhaResumo('Praças', pracas) : ''}
                      ${linhaResumo('Exibição', datas)}
                      ${linhaResumo('Objetivo', dados.objetivo)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 34px 0 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-family:Arial,sans-serif;font-size:11px;line-height:16px;color:#7a7480;text-transform:uppercase;font-weight:700;letter-spacing:.35px;">Total comercial</td>
                </tr>
                <tr>
                  <td style="padding-top:5px;font-family:Arial,sans-serif;font-size:28px;line-height:34px;color:#f20a6b;font-weight:700;">${escaparHtml(moeda(dados.totalComercial))}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:26px 34px 30px 34px;">
              <a href="${escaparHtml(dados.linkPdf)}" target="_blank" style="display:inline-block;background:#f20a6b;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;line-height:18px;font-weight:700;padding:15px 28px;border-radius:12px;">Abrir proposta</a>
              <div style="margin-top:14px;font-family:Arial,sans-serif;font-size:10.5px;line-height:16px;color:#948e98;">O link é seguro e fica disponível por 30 dias a partir deste envio.</div>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #ece8ef;padding:18px 34px 22px 34px;font-family:Arial,sans-serif;font-size:10.5px;line-height:16px;color:#948e98;">Proposta gerada no Chatbot 2.0 · Globo Publicidade</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
