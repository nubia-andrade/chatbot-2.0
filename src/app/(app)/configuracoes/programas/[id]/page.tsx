import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'
import { listarApelidos, obterPrograma } from '@/lib/dados/programas'
import { FormularioDePrograma } from '@/components/programas/FormularioDePrograma'
import { EditorDeApelidos } from '@/components/programas/EditorDeApelidos'

/**
 * Edição (ou criação) de um programa — Task 11.
 *
 * `/configuracoes/programas/novo` também cai aqui: `novo` não é um `id` de
 * verdade, é o sinal de que o formulário começa em branco. Isso evita uma
 * segunda página quase idêntica só para o caso de criação.
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
  const sessao = await obterSessao()

  if (!podeAdministrar(sessao)) {
    return (
      <section
        style={{
          background: 'var(--superficie)',
          borderRadius: 'var(--raio-janela)',
          padding: '40px',
          border: '1px solid var(--borda)',
        }}
      >
        <p style={{ color: 'var(--concorrencia)' }}>
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  const ehNovo = id === 'novo'
  const programa = ehNovo ? null : await obterPrograma(id)

  if (!ehNovo && !programa) {
    notFound()
  }

  const apelidos = programa ? await listarApelidos(programa.id) : []

  return (
    <div className="flex flex-col gap-6">
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
          {programa ? programa.nome : 'Novo programa'}
        </h1>
      </div>

      <FormularioDePrograma programa={programa} />

      {programa && <EditorDeApelidos programaId={programa.id} apelidosIniciais={apelidos} />}
    </div>
  )
}
