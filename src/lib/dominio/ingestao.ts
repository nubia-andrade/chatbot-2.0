import { normalizarFormato, type MapaDeFormatos } from './formatos'

// R4 — sentinela usado na origem para ação ainda sem data definida.
export const DATA_SEM_DEFINICAO = '2999-01-01'

export type RegistroBruto = Record<string, unknown>

export type AcaoImportada = {
  numero_da_entrega: string
  programa: string
  data_de_exibicao: string
  anunciante: string
  marca: string
  formato: string
  tipo_da_entrega: string
  status_aprovacao: string
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

export function converterData(entrada: string | null | undefined): string | null {
  const bruto = texto(entrada)
  const partes = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (partes === null) return null
  const [, dia, mes, ano] = partes
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) return null
  // Rejeita datas que o construtor normaliza silenciosamente, como 31/02.
  if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() + 1 !== Number(mes)) return null
  return `${ano}-${mes}-${dia}`
}

/**
 * R3 — só o futuro interessa; R4 — a sentinela fica de fora, por decisão da
 * área, sem aviso na interface.
 */
export function deveImportar(bruto: RegistroBruto, hoje: string): boolean {
  const data = converterData(texto(bruto.data_de_exibicao))
  if (data === null) return false
  if (data === DATA_SEM_DEFINICAO) return false
  return data >= hoje
}

/**
 * R5 — grava o formato como veio; a categoria é resolvida na leitura, para que
 * reclassificar um formato ajuste todo o histórico sem reimportar nada.
 */
export function projetar(bruto: RegistroBruto): AcaoImportada {
  return {
    numero_da_entrega: texto(bruto.numero_da_entrega),
    programa: texto(bruto.programa),
    data_de_exibicao: converterData(texto(bruto.data_de_exibicao)) ?? '',
    anunciante: texto(bruto.anunciante),
    marca: texto(bruto.marca),
    formato: texto(bruto.formatos),
    tipo_da_entrega: texto(bruto.tipo_da_entrega),
    status_aprovacao: texto(bruto.status_aprovacao),
  }
}

/**
 * Sem este alerta, um formato criado na origem entraria mudo, seria tratado
 * como ação de conteúdo por R2 e distorceria a ocupação sem ninguém perceber.
 */
export function formatosNovos(
  acoes: Pick<AcaoImportada, 'formato'>[],
  mapa: MapaDeFormatos,
): string[] {
  const novos = new Set<string>()
  for (const acao of acoes) {
    const chave = normalizarFormato(acao.formato)
    if (chave === '' || chave === '-') continue
    if (!mapa.has(chave)) novos.add(chave)
  }
  return [...novos].sort()
}
