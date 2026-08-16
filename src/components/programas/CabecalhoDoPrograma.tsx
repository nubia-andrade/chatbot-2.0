import Link from 'next/link'
import type { Programa } from '@/lib/dominio/cadastro'
import { urlDeImagemSegura } from '@/lib/seguranca/url-imagem'

/**
 * Cabeçalho da área do programa — Task 10.
 *
 * A máscara sobre a imagem é HORIZONTAL, não uniforme: escura à esquerda, onde
 * mora o texto branco, e transparente à direita, onde a imagem do programa
 * aparece com a cor que ela tem. Uma máscara uniforme garantia contraste, mas
 * apagava a imagem inteira e deixava a faixa sombria — o oposto do que a marca
 * pede.
 *
 * Os 86% de opacidade no início mantêm o contraste do texto acima de WCAG AA
 * (4.5:1) mesmo sobre imagem branca; o texto ocupa no máximo 55% da largura,
 * então nunca alcança a região clara. Sem imagem, cai no gradiente da marca —
 * o mesmo da capa do cartão da lista (`CartaoDePrograma.tsx`).
 */
const MASCARA_HORIZONTAL =
  'linear-gradient(to right, rgba(15, 10, 25, .86) 0%, rgba(15, 10, 25, .74) 28%, rgba(15, 10, 25, .34) 62%, rgba(15, 10, 25, 0) 100%)'

export function CabecalhoDoPrograma({ programa }: { programa: Programa }) {
  const imagem = urlDeImagemSegura(programa.imagem_url)

  return (
    <div
      className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-cover bg-center"
      style={{
        backgroundImage: imagem ? `${MASCARA_HORIZONTAL}, url("${imagem}")` : 'var(--marca)',
      }}
    >
      <div className="flex max-w-[55%] flex-col gap-3 p-6">
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
