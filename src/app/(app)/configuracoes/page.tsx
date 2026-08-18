import Link from 'next/link'
import { obterSessao, podeAdministrar } from '@/lib/sessao-servidor'

type Secao = { href: string; titulo: string; descricao: string }

const SECOES: Secao[] = [
  {
    href: '/configuracoes/programas',
    titulo: 'Programas',
    descricao:
      'Cadastro dos programas, suas regras comerciais e os apelidos que casam com o nome vindo da API.',
  },
  {
    href: '/configuracoes/importacao',
    titulo: 'Importação',
    descricao:
      'Quando foi a última carga das vendas do Globo Take, quantas ações vieram e quais formatos ainda não têm categoria.',
  },
  {
    href: '/configuracoes/clientes-regionais',
    titulo: 'Clientes regionais',
    descricao:
      'Quem pode comprar ação regional — elegibilidade do cliente, válida para todos os programas que aceitam regional.',
  },
  {
    href: '/configuracoes/marcas',
    titulo: 'Marcas e anunciantes',
    descricao:
      'Relacionamentos aprendidos do Globo Take e pendências entre o nome do anunciante na API e o cliente oficial da carteira.',
  },
]

export default async function PaginaConfiguracoes() {
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
        <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 26, fontWeight: 700 }}>
          Configurações
        </h1>
        <p style={{ color: 'var(--concorrencia)', marginTop: 8 }}>
          Você não tem permissão para ver esta página.
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="text-[26px] font-bold text-[var(--texto)]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Configurações
        </h1>
        <p className="mt-1 text-[13px] text-[var(--texto-3)]">
          Cadastros e fontes que alimentam as regras comerciais, a disponibilidade e as propostas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECOES.map((secao) => (
          <Link
            key={secao.href}
            href={secao.href}
            className="flex flex-col gap-2 rounded-[var(--raio-card)] border border-[var(--borda)] p-6 transition-shadow hover:shadow-[var(--sombra-janela)]"
            style={{ background: 'var(--superficie)' }}
          >
            <span
              aria-hidden
              className="h-[7px] w-[34px] rounded-full"
              style={{ background: 'var(--marca)' }}
            />
            <h2
              className="text-[17px] font-bold text-[var(--texto)]"
              style={{ fontFamily: 'var(--fonte-titulo)' }}
            >
              {secao.titulo}
            </h2>
            <p className="text-[13px] leading-[1.5] text-[var(--texto-2)]">{secao.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
