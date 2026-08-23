'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '../supabase/cliente-servidor'
import { carregarInventarioDaOportunidade, type InventarioDaOportunidade } from '../dados/inventario-oportunidades'
import { obterSessao } from '../sessao-servidor'
import { temPerfil } from '../dominio/perfis'

const BUCKET = 'oportunidades'
const TAMANHO_MAXIMO = 5 * 1024 * 1024

export async function consultarInventarioDaOportunidade(programaId: string, dataISO: string): Promise<InventarioDaOportunidade> {
  const sessao = await obterSessao()
  if (!sessao) return { slotsTotal: 0, slotsOcupados: 0, slotsLivres: 0, setoresCompradores: [], erro: 'Sua sessão expirou.' }
  return carregarInventarioDaOportunidade(programaId, dataISO)
}

function extensao(nome: string) {
  const valor = nome.split('.').pop()?.toLowerCase() ?? 'img'
  return /^[a-z0-9]{1,5}$/.test(valor) ? valor : 'img'
}

function moeda(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  const normalizado = texto
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

function dataValida(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

type DadosOportunidade = {
  programaId: string
  categoriaId: string
  formatoId: string
  tipoExibicao: string
  dataEvento: string
  dataInicio: string
  dataFim: string
  expiraEm: string
  prazoEnvioPi: string
  valorAcao: number | null
  direitosConexos: number | null
  custoProducaoTipo: 'valor' | 'sob_consulta'
  custoProducao: number | null
  titulo: string
  descricao: string
  primeiraExibicao: string
  ultimaExibicao: string
}

function lerDados(formulario: FormData): Omit<DadosOportunidade, 'primeiraExibicao' | 'ultimaExibicao'> {
  const custoProducaoTipo = String(formulario.get('custoProducaoTipo') ?? 'valor') === 'sob_consulta' ? 'sob_consulta' : 'valor'
  return {
    programaId: String(formulario.get('programaId') ?? '').trim(),
    categoriaId: String(formulario.get('categoriaId') ?? '').trim(),
    formatoId: String(formulario.get('formatoId') ?? '').trim(),
    tipoExibicao: String(formulario.get('tipoExibicao') ?? '').trim(),
    dataEvento: String(formulario.get('dataEvento') ?? '').trim(),
    dataInicio: String(formulario.get('dataInicio') ?? '').trim(),
    dataFim: String(formulario.get('dataFim') ?? '').trim(),
    expiraEm: String(formulario.get('expiraEm') ?? '').trim(),
    prazoEnvioPi: String(formulario.get('prazoEnvioPi') ?? '').trim(),
    valorAcao: moeda(formulario.get('valorAcao')),
    direitosConexos: moeda(formulario.get('direitosConexos')),
    custoProducaoTipo,
    custoProducao: custoProducaoTipo === 'sob_consulta' ? null : moeda(formulario.get('custoProducao')),
    titulo: String(formulario.get('titulo') ?? '').trim(),
    descricao: String(formulario.get('descricao') ?? '').trim(),
  }
}

function validarDados(dados: Omit<DadosOportunidade, 'primeiraExibicao' | 'ultimaExibicao'>, hoje: string): { ok: true; dados: DadosOportunidade } | { ok: false; erro: string } {
  if (!dados.categoriaId) return { ok: false, erro: 'Escolha uma categoria.' }
  if (!dados.formatoId) return { ok: false, erro: 'Escolha um formato.' }
  if (!['data_unica', 'periodo'].includes(dados.tipoExibicao)) return { ok: false, erro: 'Escolha se a exibição será em uma data única ou em um período.' }
  if (!dataValida(dados.expiraEm)) return { ok: false, erro: 'Escolha a data de expiração da oportunidade.' }
  if (!dataValida(dados.prazoEnvioPi)) return { ok: false, erro: 'Informe o prazo de envio da PI.' }
  if (!dados.titulo || dados.titulo.length > 160) return { ok: false, erro: 'O título deve ter entre 1 e 160 caracteres.' }
  if (!dados.descricao || dados.descricao.length > 600) return { ok: false, erro: 'A descrição deve ter entre 1 e 600 caracteres.' }
  if (dados.valorAcao === null) return { ok: false, erro: 'Informe o valor da ação.' }
  if (dados.direitosConexos === null) return { ok: false, erro: 'Informe o valor de Direitos e Conexos.' }
  if (dados.custoProducaoTipo === 'valor' && dados.custoProducao === null) return { ok: false, erro: 'Informe o custo de produção ou marque Sob consulta.' }

  let primeiraExibicao: string
  let ultimaExibicao: string

  if (dados.tipoExibicao === 'data_unica') {
    if (!dataValida(dados.dataEvento)) return { ok: false, erro: 'Escolha a data de exibição.' }
    if (dados.dataEvento < hoje) return { ok: false, erro: 'A exibição não pode estar no passado.' }
    primeiraExibicao = dados.dataEvento
    ultimaExibicao = dados.dataEvento
  } else {
    if (!dataValida(dados.dataInicio) || !dataValida(dados.dataFim)) return { ok: false, erro: 'Informe o início e o fim do período de exibição.' }
    if (dados.dataInicio > dados.dataFim) return { ok: false, erro: 'O início do período não pode ser posterior ao fim.' }
    if (dados.dataFim < hoje) return { ok: false, erro: 'O período de exibição não pode estar integralmente no passado.' }
    primeiraExibicao = dados.dataInicio
    ultimaExibicao = dados.dataFim
  }

  if (dados.expiraEm < hoje) return { ok: false, erro: 'A data de expiração não pode estar no passado.' }
  if (dados.expiraEm > ultimaExibicao) return { ok: false, erro: 'A oportunidade deve expirar até, no máximo, a última data de exibição.' }
  if (dados.prazoEnvioPi < hoje) return { ok: false, erro: 'O prazo de envio da PI não pode estar no passado.' }
  if (dados.prazoEnvioPi > primeiraExibicao) return { ok: false, erro: 'O prazo de envio da PI deve ser anterior ou igual à primeira exibição.' }

  return { ok: true, dados: { ...dados, primeiraExibicao, ultimaExibicao } }
}

async function enviarImagem(formulario: FormData, usuarioId: string) {
  const supabase = await criarClienteServidor()
  const arquivo = formulario.get('imagem')
  if (!(arquivo instanceof File) || arquivo.size <= 0) return { ok: true as const, imagemUrl: undefined as string | undefined }
  if (!arquivo.type.startsWith('image/')) return { ok: false as const, erro: 'A imagem deve ser PNG, JPG ou WEBP.' }
  if (arquivo.size > TAMANHO_MAXIMO) return { ok: false as const, erro: 'A imagem passa de 5 MB.' }
  const caminho = `${usuarioId}/${crypto.randomUUID()}.${extensao(arquivo.name)}`
  const upload = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
  if (upload.error) return { ok: false as const, erro: `Não foi possível enviar a imagem: ${upload.error.message}` }
  return { ok: true as const, imagemUrl: supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl }
}

export async function publicarOportunidade(formulario: FormData): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.' }

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  if (!proprietario && !consultor) return { ok: false, erro: 'Você não tem permissão para publicar oportunidades.' }

  const hoje = new Date().toISOString().slice(0, 10)
  const validacao = validarDados(lerDados(formulario), hoje)
  if (!validacao.ok) return { ok: false, erro: validacao.erro }
  const dados = validacao.dados

  if (!dados.programaId || (!proprietario && !sessao.programasVinculados.includes(dados.programaId))) return { ok: false, erro: 'Escolha um programa que você administra.' }

  const supabase = await criarClienteServidor()
  const [categoria, formato, programa] = await Promise.all([
    supabase.from('oportunidade_categorias').select('id').eq('id', dados.categoriaId).eq('ativo', true).maybeSingle(),
    supabase.from('oportunidade_formatos').select('id').eq('id', dados.formatoId).eq('ativo', true).maybeSingle(),
    supabase.from('programas').select('id, mnemonico').eq('id', dados.programaId).maybeSingle(),
  ])
  if (categoria.error || !categoria.data) return { ok: false, erro: 'A categoria escolhida não está disponível.' }
  if (formato.error || !formato.data) return { ok: false, erro: 'O formato escolhido não está disponível.' }
  if (programa.error || !programa.data) return { ok: false, erro: 'Programa não encontrado.' }

  if (dados.tipoExibicao === 'data_unica') {
    const inventario = await carregarInventarioDaOportunidade(dados.programaId, dados.dataEvento)
    if (inventario.erro) return { ok: false, erro: inventario.erro }
    if (inventario.slotsLivres <= 0) return { ok: false, erro: 'Esta data está sem slots livres. Escolha outra data.' }
  }

  const imagem = await enviarImagem(formulario, sessao.usuarioId)
  if (!imagem.ok) return { ok: false, erro: imagem.erro }

  const insercao = await supabase.from('oportunidades').insert({
    programa_id: dados.programaId,
    categoria_id: dados.categoriaId,
    formato_id: dados.formatoId,
    tipo_exibicao: dados.tipoExibicao,
    data_evento: dados.tipoExibicao === 'data_unica' ? dados.dataEvento : null,
    data_inicio: dados.tipoExibicao === 'periodo' ? dados.dataInicio : null,
    data_fim: dados.tipoExibicao === 'periodo' ? dados.dataFim : null,
    expira_em: dados.expiraEm,
    prazo_envio_pi: dados.prazoEnvioPi,
    sigla: programa.data.mnemonico,
    valor_acao: dados.valorAcao,
    direitos_conexos: dados.direitosConexos,
    custo_producao_tipo: dados.custoProducaoTipo,
    custo_producao: dados.custoProducao,
    titulo: dados.titulo,
    descricao: dados.descricao,
    imagem_url: imagem.imagemUrl ?? null,
    criado_por: sessao.usuarioId,
    criado_por_nome: sessao.nome,
    ativo: true,
  }).select('id').single()

  if (insercao.error) return { ok: false, erro: `Não foi possível publicar: ${insercao.error.message}` }
  revalidatePath('/oportunidades')
  revalidatePath('/calendario')
  return { ok: true, id: insercao.data.id as string }
}

export async function editarOportunidade(formulario: FormData): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.' }

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  if (!proprietario && !consultor) return { ok: false, erro: 'Você não tem permissão para editar oportunidades.' }

  const id = String(formulario.get('id') ?? '').trim()
  if (!id) return { ok: false, erro: 'Oportunidade não informada.' }

  const hoje = new Date().toISOString().slice(0, 10)
  const validacao = validarDados(lerDados(formulario), hoje)
  if (!validacao.ok) return { ok: false, erro: validacao.erro }
  const dados = validacao.dados

  const supabase = await criarClienteServidor()
  const atual = await supabase
    .from('oportunidades')
    .select('id, programa_id, criado_por')
    .eq('id', id)
    .maybeSingle()
  if (atual.error || !atual.data) return { ok: false, erro: 'Oportunidade não encontrada.' }
  if (!proprietario && !sessao.programasVinculados.includes(atual.data.programa_id)) return { ok: false, erro: 'Você não administra o programa desta oportunidade.' }
  if (!dados.programaId || (!proprietario && !sessao.programasVinculados.includes(dados.programaId))) return { ok: false, erro: 'Escolha um programa que você administra.' }

  const [categoria, formato, programa] = await Promise.all([
    supabase.from('oportunidade_categorias').select('id').eq('id', dados.categoriaId).eq('ativo', true).maybeSingle(),
    supabase.from('oportunidade_formatos').select('id').eq('id', dados.formatoId).eq('ativo', true).maybeSingle(),
    supabase.from('programas').select('id, mnemonico').eq('id', dados.programaId).maybeSingle(),
  ])
  if (categoria.error || !categoria.data) return { ok: false, erro: 'A categoria escolhida não está disponível.' }
  if (formato.error || !formato.data) return { ok: false, erro: 'O formato escolhido não está disponível.' }
  if (programa.error || !programa.data) return { ok: false, erro: 'Programa não encontrado.' }

  const imagem = await enviarImagem(formulario, sessao.usuarioId)
  if (!imagem.ok) return { ok: false, erro: imagem.erro }

  const atualizacao: Record<string, unknown> = {
    programa_id: dados.programaId,
    categoria_id: dados.categoriaId,
    formato_id: dados.formatoId,
    tipo_exibicao: dados.tipoExibicao,
    data_evento: dados.tipoExibicao === 'data_unica' ? dados.dataEvento : null,
    data_inicio: dados.tipoExibicao === 'periodo' ? dados.dataInicio : null,
    data_fim: dados.tipoExibicao === 'periodo' ? dados.dataFim : null,
    expira_em: dados.expiraEm,
    prazo_envio_pi: dados.prazoEnvioPi,
    sigla: programa.data.mnemonico,
    valor_acao: dados.valorAcao,
    direitos_conexos: dados.direitosConexos,
    custo_producao_tipo: dados.custoProducaoTipo,
    custo_producao: dados.custoProducao,
    titulo: dados.titulo,
    descricao: dados.descricao,
    atualizado_em: new Date().toISOString(),
  }
  if (imagem.imagemUrl !== undefined) atualizacao.imagem_url = imagem.imagemUrl

  const resultado = await supabase.from('oportunidades').update(atualizacao).eq('id', id)
  if (resultado.error) return { ok: false, erro: `Não foi possível editar: ${resultado.error.message}` }
  revalidatePath('/oportunidades')
  revalidatePath('/calendario')
  return { ok: true, id }
}