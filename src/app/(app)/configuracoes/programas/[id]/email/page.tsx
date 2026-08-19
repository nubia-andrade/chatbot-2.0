import { notFound } from 'next/navigation'
import { obterPrograma } from '@/lib/dados/programas'
import { obterConfiguracaoDeEmailDoPrograma } from '@/lib/dados/email-programa'
import { emailMicrosoftConfigurado, remetenteMicrosoft } from '@/lib/propostas/email-microsoft'
import { ConfiguracaoEmailDoPrograma } from '@/components/programas/ConfiguracaoEmailDoPrograma'

export default async function PaginaEmailDoPrograma({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const programa = await obterPrograma(id)
  if (!programa) notFound()

  const configuracao = await obterConfiguracaoDeEmailDoPrograma(programa.id)

  return (
    <ConfiguracaoEmailDoPrograma
      programaId={programa.id}
      programaNome={programa.nome}
      ativoInicial={configuracao.ativo}
      usuarios={configuracao.usuarios}
      schemaDisponivel={configuracao.schemaDisponivel}
      microsoftConfigurado={emailMicrosoftConfigurado()}
      remetente={remetenteMicrosoft()}
    />
  )
}
