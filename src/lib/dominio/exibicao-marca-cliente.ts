import { normalizarNome } from './texto'

export function nomePrincipalDaProposta(marcaNome: string | null | undefined, clienteNome: string): string {
  return marcaNome?.trim() || clienteNome.trim()
}

export function deveExibirClienteComMarca(
  marcaNome: string | null | undefined,
  clienteNome: string,
): boolean {
  const marca = marcaNome?.trim()
  const cliente = clienteNome.trim()
  if (!marca || !cliente) return false
  return normalizarNome(marca) !== normalizarNome(cliente)
}
