export type ItemParaTextoDaProposta = {
  data: string
  quantidade: number
  pracas?: string[]
}

function dataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${ano}`
}

function dataCurta(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}`
}

function juntarComE(itens: string[]): string {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

function descreverDatas(datas: string[]): string {
  const unicas = [...new Set(datas)].sort()
  if (unicas.length === 0) return ''
  if (unicas.length === 1) return `em ${dataBr(unicas[0])}`

  if (unicas.length <= 5) {
    const [anoPrimeira, mesPrimeira] = unicas[0].split('-')
    const mesmoMesAno = unicas.every((data) => {
      const [ano, mes] = data.split('-')
      return ano === anoPrimeira && mes === mesPrimeira
    })

    if (mesmoMesAno) {
      const dias = unicas.map((data) => String(Number(data.slice(8, 10))))
      return `nos dias ${juntarComE(dias)}/${mesPrimeira}/${anoPrimeira}`
    }

    return `nas datas ${juntarComE(unicas.map(dataBr))}`
  }

  const primeira = unicas[0]
  const ultima = unicas.at(-1)!
  const mesmoAno = primeira.slice(0, 4) === ultima.slice(0, 4)
  const inicio = mesmoAno ? dataCurta(primeira) : dataBr(primeira)
  return `em ${unicas.length} datas entre ${inicio} e ${dataBr(ultima)}`
}

function quantidadeDeAcoes(itens: ItemParaTextoDaProposta[]): number {
  return itens.reduce((total, item) => total + Math.max(0, item.quantidade), 0)
}

function acao(quantidade: number, meio: string): string {
  return `${quantidade} ${quantidade === 1 ? 'ação' : 'ações'} ${meio}`
}

export function descreverAcaoDaProposta(params: {
  programaNome: string
  modalidade: 'nacional' | 'regional'
  itens: ItemParaTextoDaProposta[]
  incluirDigital: boolean
  incluirRedesSociais: boolean
}): string {
  const quantidade = quantidadeDeAcoes(params.itens)
  const datas = descreverDatas(params.itens.map((item) => item.data))
  const entregas = [
    acao(quantidade, 'na TV'),
    params.incluirDigital ? acao(quantidade, 'no Digital') : null,
    params.incluirRedesSociais ? acao(quantidade, 'em Redes Sociais') : null,
  ].filter((item): item is string => Boolean(item))

  const pracas = [...new Set(params.itens.flatMap((item) => item.pracas ?? []))]
  const complementoRegional = params.modalidade === 'regional'
    ? pracas.length > 0
      ? `, nas praças ${juntarComE(pracas)}`
      : ', em formato regional'
    : ''

  return `No programa ${params.programaNome.toUpperCase()}, previsto no ar ${datas}${complementoRegional}, com ${juntarComE(entregas)}.`
}
