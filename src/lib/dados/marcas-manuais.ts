import { criarClienteServidor } from '../supabase/cliente-servidor'

export type VinculoManualDeMarca = {
  marca_id: string
  marca_nome: string
  cliente_id: string
  cliente_nome: string
  criado_em: string
}

type Linha = {
  marca_id: string
  cliente_id: string
  criado_em: string
  marca: { nome: string } | null
  cliente: { nome: string } | null
}

export async function listarVinculosManuaisDeMarca(): Promise<VinculoManualDeMarca[]> {
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase
    .from('marca_cliente_manual')
    .select('marca_id, cliente_id, criado_em, marca:marcas(nome), cliente:clientes(nome)')
    .order('criado_em', { ascending: false })
    .limit(100)

  if (error) {
    // Antes da migration nova, a seção simplesmente começa vazia e a própria
    // tela orienta a execução do schema.
    if (error.message.toLowerCase().includes('marca_cliente_manual')) return []
    console.error('Falha ao listar vínculos manuais de marca:', error.message)
    return []
  }

  return ((data ?? []) as unknown as Linha[])
    .filter((linha) => Boolean(linha.marca?.nome && linha.cliente?.nome))
    .map((linha) => ({
      marca_id: linha.marca_id,
      marca_nome: linha.marca!.nome,
      cliente_id: linha.cliente_id,
      cliente_nome: linha.cliente!.nome,
      criado_em: linha.criado_em,
    }))
}
