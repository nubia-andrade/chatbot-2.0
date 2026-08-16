import Link from 'next/link'
import type { Programa } from '@/lib/dominio/cadastro'
import { urlDeImagemSegura } from '@/lib/seguranca/url-imagem'

/**
 * Cabeçalho da área do programa — Task 10.
 *
 * Faixa com a imagem do programa ao fundo, escurecida por um gradiente para
 * garantir contraste com o texto branco por cima (WCAG AA, 4.5:1) mesmo em
 * imagens claras. Sem imagem, cai no gradiente da marca — o mesmo usado na
 * capa do cartão da lista (`CartaoDePrograma.tsx`) quando falta imagem.
 */
export function CabecalhoDoPrograma({ programa }: { programa: Programa }) {
  const imagem = urlDeImagemSegura(programa.imagem_url)

  return (
    <div
      className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-cover bg-center"
      style={{
        backgroundImage: imagem
          ? `linear-gradient(rgba(15, 10, 25, .72), rgba(15, 10, 25, .58)), url("${imagem}")`
          : 'var(--marca)',
      }}
    >
      <div className="flex flex-col gap-3 p-6">
        <Link
          href="/configuracoes/programas"
          className="w-fit text-[12.5px] font-semibold text-white/85 hover:text-white"
        >
          ← Voltar para Programas
        </Link>

        <div>
          <h1
            className="text-[26px] font-bold text-white"
            style={{ fontFamily: 'var(--fonte-titulo)' }}
          >
            {programa.nome}
          </h1>
          <p className="mt-1 text-[13px] font-semibold text-white/85">
            {programa.mnemonico} · {programa.canal}
          </p>
        </div>
      </div>
    </div>
  )
}
