import { NextResponse } from 'next/server'
import { enviarRelatorioDiarioDeMarcas } from '@/lib/marcas/relatorio-diario'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) {
    return NextResponse.json({ erro: 'CRON_SECRET não configurado.' }, { status: 503 })
  }

  const autorizacao = request.headers.get('authorization')
  if (autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const resultado = await enviarRelatorioDiarioDeMarcas()
    return NextResponse.json(resultado)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao gerar relatório diário de marcas.'
    console.error('Relatório diário de marcas:', mensagem)
    return NextResponse.json({ erro: mensagem }, { status: 500 })
  }
}
