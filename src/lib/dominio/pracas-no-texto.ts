import { PRACAS } from './regional'

/**
 * A API não tem campo de praça: a informação está em texto livre, escrito por
 * pessoas, com pelo menos 15 grafias diferentes ("- RJ", "SP/BH", "(praça:
 * SP)", "SP1, RJ + BH"). Esta função SUGERE o que reconheceu; quem decide é o
 * consultor, na tela. Nunca use o resultado como verdade.
 */
const APELIDOS: Record<string, string> = {
  SP: 'SP',
  SP1: 'SP',
  RJ: 'RJ',
  BH: 'BH',
  DF: 'DF',
  PE: 'PE1',
  PE1: 'PE1',
}

export function pracasNoTexto(texto: string | null | undefined): string[] {
  if (!texto) return []

  const encontradas = new Set<string>()
  // \b garante sigla isolada: "DFX" e "BHZ" não contam.
  const padrao = new RegExp(`\\b(${Object.keys(APELIDOS).join('|')})\\b`, 'gi')

  for (const achado of texto.matchAll(padrao)) {
    const canonica = APELIDOS[achado[1].toUpperCase()]
    if (canonica) encontradas.add(canonica)
  }

  return PRACAS.filter((praca) => encontradas.has(praca))
}
