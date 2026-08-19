type Destinatario = { email: string }

const REMETENTE_TEMPORARIO = 'nubia.andrade@g.globo'

function configuracao() {
  return {
    tenantId: process.env.MICROSOFT_TENANT_ID ?? '',
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    senderEmail: process.env.MICROSOFT_SENDER_EMAIL ?? REMETENTE_TEMPORARIO,
  }
}

export function emailMicrosoftConfigurado(): boolean {
  const c = configuracao()
  return Boolean(c.tenantId && c.clientId && c.clientSecret && c.senderEmail)
}

export function remetenteMicrosoft(): string {
  return configuracao().senderEmail
}

async function obterToken(): Promise<string> {
  const c = configuracao()
  const corpo = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const resposta = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corpo,
    cache: 'no-store',
  })

  if (!resposta.ok) throw new Error(`Falha ao autenticar no Microsoft 365 (${resposta.status}).`)
  const json = await resposta.json() as { access_token?: string }
  if (!json.access_token) throw new Error('Microsoft 365 não retornou token de acesso.')
  return json.access_token
}

export async function enviarEmailMicrosoft(params: {
  para: Destinatario[]
  cc?: Destinatario[]
  assunto: string
  html: string
}): Promise<void> {
  if (!emailMicrosoftConfigurado()) {
    throw new Error('Envio de e-mail ainda não configurado no Microsoft 365.')
  }
  if (params.para.length === 0) throw new Error('O e-mail precisa de ao menos um destinatário principal.')

  const c = configuracao()
  const token = await obterToken()
  const emailsPara = new Set(params.para.map((item) => item.email.trim().toLowerCase()).filter(Boolean))
  const ccSemDuplicar = (params.cc ?? []).filter((item) => {
    const email = item.email.trim().toLowerCase()
    return Boolean(email) && !emailsPara.has(email)
  })

  const resposta = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.senderEmail)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: params.assunto,
          body: { contentType: 'HTML', content: params.html },
          toRecipients: params.para.map((destinatario) => ({
            emailAddress: { address: destinatario.email },
          })),
          ccRecipients: ccSemDuplicar.map((destinatario) => ({
            emailAddress: { address: destinatario.email },
          })),
        },
        saveToSentItems: true,
      }),
      cache: 'no-store',
    },
  )

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => '')
    throw new Error(`Falha ao enviar e-mail pelo Microsoft 365 (${resposta.status})${detalhe ? `: ${detalhe.slice(0, 300)}` : '.'}`)
  }
}

export async function enviarPropostaPorEmail(params: {
  para: Destinatario[]
  cc?: Destinatario[]
  assunto: string
  html: string
}): Promise<void> {
  return enviarEmailMicrosoft(params)
}
