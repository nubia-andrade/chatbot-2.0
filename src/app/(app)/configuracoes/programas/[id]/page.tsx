import Link from 'next/link'
import { listarApelidos, obterPrograma } from '@/lib/dados/programas'
import { FormularioDePrograma } from '@/components/programas/FormularioDePrograma'
import { EditorDeApelidos } from '@/components/programas/EditorDeApelidos'

/**
 * Aba Cadastro da área do programa — Task 10 (antes vivia sozinha nesta
 * rota, Task 9/11 original).
 *
 * `/configuracoes/programas/novo` cai aqui: `novo` não é um `id` de
 * verdade, é o sinal de que o formulário começa em branco. A guarda de
 * acesso e o cabeçalho com nome/mnemônico/canal já ficam por conta de
 * `[id]/layout.tsx` — esta página só cuida do formulário dos 19 (+6
 * regionais) campos. Para "novo" o layout não busca programa nem mostra
 * cabeçalho ou abas (não há o que mostrar antes de o programa existir), daí
 * o título próprio abaixo.
 *
 * O editor de apelidos só aparece depois que o programa existe de fato —
 * `programa_apelidos.programa_id` referencia um `programas.id` real, então
 * não há apelido para editar antes do primeiro "Cadastrar programa".
 */
export default async function PaginaDePrograma({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ehNovo = id === 'novo'

  // O layout já negou acesso (`notFound()`) para qualquer id que não exista
  // ou que a pessoa não edite — `programa` só é `null` aqui quando `ehNovo`.
  const programa = ehNovo ? null : await obterPrograma(id)
  const apelidos = programa ? await listarApelidos(programa.id) : []

  return (
    <div className="flex flex-col gap-6">
      {ehNovo && (
        <div>
          <Link
            href="/configuracoes/programas"
            className="text-[12.5px] font-semibold text-[var(--roxo)] hover:text-[var(--roxo-hover)]"
          >
            ← Voltar para Programas
          </Link>
          <h1
            className="mt-2 text-[26px] font-bold text-[var(--texto)]"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            Novo programa
          </h1>
        </div>
      )}

      <FormularioDePrograma programa={programa} />

      {programa && <EditorDeApelidos programaId={programa.id} apelidosIniciais={apelidos} />}
    </div>
  )
}
