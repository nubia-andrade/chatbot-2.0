export type Perfil =
  | 'executivo'
  | 'executivo_regional'
  | 'consultor_programa'
  | 'proprietario'

export function temPerfil(perfis: Perfil[], procurado: Perfil): boolean {
  return perfis.includes(procurado)
}

export function podeAdministrarProgramas(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'consultor_programa') || temPerfil(perfis, 'proprietario')
}

// Excluir programa leva junto datas bloqueadas, restrições, preços e ações
// regionais. É a única ação irreversível da entrega.
export function podeExcluirPrograma(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'proprietario')
}

export function podeConsultarRegional(perfis: Perfil[]): boolean {
  return temPerfil(perfis, 'executivo_regional') || temPerfil(perfis, 'proprietario')
}

/** Consultor edita só os programas a que está vinculado; proprietário, todos. */
export function podeEditarPrograma(
  perfis: Perfil[],
  programasVinculados: string[],
  programaId: string,
): boolean {
  if (temPerfil(perfis, 'proprietario')) return true
  if (!temPerfil(perfis, 'consultor_programa')) return false
  return programasVinculados.includes(programaId)
}
