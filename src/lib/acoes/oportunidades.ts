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
  let normalizado = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (normalizado.includes(',')) normalizado = normalizado.replace(/\./g, '').replace(',', '.')
  normalizado = normalizado.replace(/[^0-9.-]/g, '')
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

function dataValida(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
}

export async function publicarOportunidade(formulario: FormData): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const sessao = await obterSessao()
  if (!sessao) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.' }

  const proprietario = temPerfil(sessao.perfis, 'proprietario')
  const consultor = temPerfil(sessao.perfis, 'consultor_programa')
  if (!proprietario && !consultor) return { ok: false, erro: 'Você não tem permissão para publicar oportunidades.' }

  const programaId = String(formulario.get('programaId') ?? '').trim()
  const categoriaId = String(formulario.get('categoriaId') ?? '').trim()
  const formatoId = String(formulario.get('formatoId') ?? '').trim()
  const tipoExibicao = String(formulario.get('tipoExibicao') ?? '').trim()
  const dataEvento = String(formulario.get('dataEvento') ?? '').trim()
  const dataInicio = String(formulario.get('dataInicio') ?? '').trim()
  const dataFim = String(formulario.get('dataFim') ?? '').trim()
  const expiraEm = String(formulario.get('expiraEm') ?? '').trim()
  const prazoEnvioPi = String(formulario.get('prazoEnvioPi') ?? '').trim()
  const valorAcao = moeda(formulario.get('valorAcao'))
  const direitosConexos = moeda(formulario.get('direitosConexos'))
  const custoProducaoTipo = String(formulario.get('custoProducaoTipo') ?? 'valor') === 'sob_consulta' ? 'sob_consulta' : 'valor'
  const custoProducao = custoProducaoTipo === 'sob_consulta' ? null : moeda(formulario.get('custoProducao'))
  const titulo = String(formulario.get('titulo') ?? '').trim()
  const descricao = String(formulario.get('descricao') ?? '').trim()

  if (!programaId || (!proprietario && !sessao.programasVinculados.includes(programaId))) return { ok: false, erro: 'Escolha um programa que você administra.' }
  if (!categoriaId) return { ok: false, erro: 'Escolha uma categoria.' }
  if (!formatoId) return { ok: false, erro: 'Escolha um formato.' }
  if (!['data_unica', 'periodo'].includes(tipoExibicao)) return { ok: false, erro: 'Escolha se a exibição será em uma data única ou em um período.' }
  if (!dataValida(expiraEm)) return { ok: false, erro: 'Escolha a data de expiração da oportunidade.' }
  if (!dataValida(prazoEnvioPi)) return { ok: false, erro: 'Informe o prazo de envio da PI.' }
  if (!titulo || titulo.length > 160) return { ok: false, erro: 'O título deve ter entre 1 e 160 caracteres.' }
  if (!descricao || descricao.length > 300) return { ok: false, erro: 'A descrição deve ter entre 1 e 300 caracteres.' }
  if (valorAcao === null) return { ok: false, erro: 'Informe o valor da ação.' }
  if (direitosConexos === null) return { ok: false, erro: 'Informe o valor de Direitos e Conexos.' }
  if (custoProducaoTipo === 'valor' && custoProducao === null) return { ok: false, erro: 'Informe o custo de produção ou marque Sob consulta.' }

  const hoje = new Date().toISOString().slice(0, 10)
  let primeiraExibicao: string
  let ultimaExibicao: string

  if (tipoExibicao === 'data_unica') {
    if (!dataValida(dataEvento)) return { ok: false, erro: 'Escolha a data de exibição.' }
    if (dataEvento < hoje) return { ok: false, erro: 'A exibição não pode estar no passado.' }
    primeiraExibicao = dataEvento
    ultimaExibicao = dataEvento
  } else {
    if (!dataValida(dataInicio) || !dataValida(dataFim)) return { ok: false, erro: 'Informe o início e o fim do período de exibição.' }
    if (dataInicio > dataFim) return { ok: false, erro: 'O início do período não pode ser posterior ao fim.' }
    if (dataFim < hoje) return { ok: false, erro: 'O período de exibição não pode estar integralmente no passado.' }
    primeiraExibicao = dataInicio
    ultimaExibicao = dataFim
  }

  if (expiraEm < hoje) return { ok: false, erro: 'A data de expiração não pode estar no passado.' }
  if (expiraEm > ultimaExibicao) return { ok: false, erro: 'A oportunidade deve expirar até, no máximo, a última data de exibição.' }
  if (prazoEnvioPi > primeiraExibicao) return { ok: false, erro: 'O prazo de envio da PI deve ser anterior ou igual à primeira exibição.' }

  const supabase = await criarClienteServidor()
  const [categoria, formato, programa] = await Promise.all([
    supabase.from('oportunidade_categorias').select('id').eq('id', categoriaId).eq('ativo', true).maybeSingle(),
    supabase.from('oportunidade_formatos').select('id').eq('id', formatoId).eq('ativo', true).maybeSingle(),
    supabase.from('programas').select('id, mnemonico').eq('id', programaId).maybeSingle(),
  ])
  if (categoria.error || !categoria.data) return { ok: false, erro: 'A categoria escolhida não está disponível.' }
  if (formato.error || !formato.data) return { ok: false, erro: 'O formato escolhido não está disponível.' }
  if (programa.error || !programa.data) return { ok: false, erro: 'Programa não encontrado.' }

  if (tipoExibicao === 'data_unica') {
    const inventario = await carregarInventarioDaOportunidade(programaId, dataEvento)
    if (inventario.erro) return { ok: false, erro: inventario.erro }
    if (inventario.slotsLivres <= 0) return { ok: false, erro: 'Esta data está sem slots livres. Escolha outra data.' }
  }

  let imagemUrl: string | null = null
  const arquivo = formulario.get('imagem')
  if (arquivo instanceof File && arquivo.size > 0) {
    if (!arquivo.type.startsWith('image/')) return { ok: false, erro: 'A imagem deve ser PNG, JPG ou WEBP.' }
    if (arquivo.size > TAMANHO_MAXIMO) return { ok: false, erro: 'A imagem passa de 5 MB.' }
    const caminho = `${sessao.usuarioId}/${crypto.randomUUID()}.${extensao(arquivo.name)}`
    const upload = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })
    if (upload.error) return { ok: false, erro: `Não foi possível enviar a imagem: ${upload.error.message}` }
    imagemUrl = supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl
  }

  const insercao = await supabase.from('oportunidades').insert({
    programa_id: programaId,
    categoria_id: categoriaId,
    formato_id: formatoId,
    tipo_exibicao: tipoExibicao,
    data_evento: tipoExibicao === 'data_unica' ? dataEvento : null,
    data_inicio: tipoExibicao === 'periodo' ? dataInicio : null,
    data_fim: tipoExibicao === 'periodo' ? dataFim : null,
    expira_em: expiraEm,
    prazo_envio_pi: prazoEnvioPi,
    sigla: programa.data.mnemonico,
    valor_acao: valorAcao,
    direitos_conexos: direitosConexos,
    custo_producao_tipo: custoProducaoTipo,
    custo_producao: custoProducao,
    titulo,
    descricao,
    imagem_url: imagemUrl,
    criado_por: sessao.usuarioId,
    criado_por_nome: sessao.nome,
    ativo: true,
  }).select('id').single()

  if (insercao.error) return { ok: false, erro: `Não foi possível publicar: ${insercao.error.message}` }
  revalidatePath('/oportunidades')
  revalidatePath('/calendario')
  return { ok: true, id: insercao.data.id as string }
}
