export type Perfil =
  | 'executivo'
  | 'executivo_regional'
  | 'consultor_programa'
  | 'proprietario'

export type SecaoApp = 'inicio' | 'consulta' | 'propostas' | 'aprovacoes' | 'configuracoes'

export const SECOES_DO_APP: { valor: SecaoApp; rotulo: string }[] = [
  { valor: 'inicio', rotulo: 'Desempenho' },
  { valor: 'consulta', rotulo: 'Nova consulta' },
  { valor: 'propostas', rotulo: 'Propostas' },
  { valor: 'aprovacoes', rotulo: 'Aprovações' },
  { valor: 'configuracoes', rotulo: 'Configurações' },
]

export const SECOES_PADRAO_POR_PERFIL: Record<Perfil, SecaoApp[]> = {
  executivo: ['inicio', 'consulta', 'propostas'],
  executivo_regional: ['inicio', 'consulta', 'propostas'],
  consultor_programa: ['inicio', 'propostas', 'aprovacoes', 'configuracoes'],
  proprietario: ['inicio', 'consulta', 'propostas', 'aprovacoes', 'configuracoes'],
}

export function temPerfil(perfis: Perfil[], procurado: Perfil): boolean {
  return perfis.includes(procurado)
}

export function secoesPadraoDosPerfis(perfis: Perfil[]): SecaoApp[] {
  const secoes = new Set<SecaoApp>(['inicio'])
  for (const perfil of perfis) {
    for (const secao of SECOES_PADRAO_POR_PERFIL[perfil]) secoes.add(secao)
  }
  return SECOES_DO_APP.map((item) => item.valor).filter((secao) => secoes.has(secao))
}

export function podeAcessarSecao(secoes: SecaoApp[], secao: SecaoApp): boolean {
  return secoes.includes(secao)
}

export function podeAdministrarProgramas(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'consultor_programa') || temPerfil(perfis, 'proprietario')
}

/** Governança global afeta toda a base, não apenas um programa. */
export function podeAdministrarGovernancaGlobal(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'proprietario')
}

export function podeExcluirPrograma(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'proprietario')
}

export function podeConsultarRegional(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'executivo_regional') || temPerfil(perfis, 'proprietario')
}

/** Consultor edita só os programas a que está vinculado; proprietário, todos. */
export function podeEditarPrograma(perfis: Perfil[], programasVinculados: string[], programaId: string): boolean {
  if (temPerfil(perfis, 'proprietario')) return true
  if (!temPerfil(perfis, 'consultor_programa')) return false
  return programasVinculados.includes(programaId)
}

/** A decisão de aprovação é restrita ao consultor vinculado ao programa ou proprietário. */
export function podeAprovarPrograma(perfis: Perfil[], programasVinculados: string[], programaId: string): boolean {
  if (temPerfil(perfis, 'proprietario')) return true
  return temPerfil(perfis, 'consultor_programa') && programasVinculados.includes(programaId)
}
