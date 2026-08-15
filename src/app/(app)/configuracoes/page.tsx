import { SecaoEmConstrucao } from '@/components/layout/SecaoEmConstrucao'

/**
 * O item "Configurações" só aparece na barra lateral para quem passa em
 * `podeAdministrar` (ver `BarraLateral.tsx`) — mas isso é só conveniência de
 * interface, não uma checagem de permissão. Esta página, de propósito, não
 * repete nenhuma verificação de perfil: quem protege de verdade os dados de
 * configuração é o RLS do banco (`supabase/schema.sql`), aplicado em toda
 * consulta que as próximas entregas fizerem a partir daqui.
 */
export default function PaginaConfiguracoes() {
  return <SecaoEmConstrucao titulo="Configurações" />
}
