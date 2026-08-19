import { criarClienteServidor } from '../supabase/cliente-servidor'

export type VinculoManualDeMarca = {
  marca_id: string
  marca_nome: string
  cliente_id: string
  cliente_nome: string
  criado_em: string
  origem: 'administracao' | 'consulta'
  revisao_status: 'pendente' | 'revisada'
}

type Linha = {
  marca_id: string
  cliente_id: string
  criado_em: string
  origem?: 'administracao' | 'consulta'
  revisao_status?: 'pendente' | 'revisada'
  marca: { nome: string } | null
  cliente: { nome: string } | null
}

function mapear(linhas: Linha[]): VinculoManualDeMarca[] {
  return linhas
    .filter((linha) => Boolean(linha.marca?.nome && linha.cliente?.nome))
    .map((linha) => ({
      marca_id: linha.marca_id,
      marca_nome: linha.marca!.nome,
      cliente_id: linha.cliente_id,
      cliente_nome: linha.cliente!.nome,
      criado_em: linha.criado_em,
      origem: linha.origem ?? 'administracao',
      revisao_status: linha.revisao_status ?? 'revisada',
    }))
}

export async function listarVinculosManuaisDeMarca(): Promise<VinculoManualDeMarca[]> {
  const supabase = await criarClienteServidor()
  const consultaNova = await supabase
    .from('marca_cliente_manual')
    .select('marca_id, cliente_id, criado_em, origem, revisao_status, marca:marcas(nome), cliente:clientes(nome)')
    .order('criado_em', { ascending: false })
    .limit(100)

  if (!consultaNova.error) return mapear((consultaNova.data ?? []) as unknown as Linha[])

  const texto = consultaNova.error.message.toLowerCase()
  const schemaGovernancaAusente = texto.includes('origem') || texto.includes('revisao_status') || texto.includes('could not find')

  if (schemaGovernancaAusente) {
    const antiga = await supabase
      .from('marca_cliente_manual')
      .select('marca_id, cliente_id, criado_em, marca:marcas(nome), cliente:clientes(nome)')
      .order('criado_em', { ascending: false })
      .limit(100)

    if (!antiga.error) return mapear((antiga.data ?? []) as unknown as Linha[])
  }

  if (texto.includes('marca_cliente_manual')) return []
  console.error('Falha ao listar vínculos manuais de marca:', consultaNova.error.message)
  return []
}
