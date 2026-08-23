'use client'

import Link from 'next/link'

type Props = {
  inversa?: boolean
  compacta?: boolean
  href?: string
}

export function MarcaGloboSlots({ compacta = false, href = '/oportunidades' }: Props) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2.5" aria-label="Globo Slots">
      <span
        aria-hidden
        className={`globo-slots-gradient-logo ${compacta ? 'h-7 w-11' : 'h-9 w-14'}`}
      />
      <span className={`${compacta ? 'text-[17px]' : 'text-[20px]'} globo-slots-gradient-text vitrine-pop font-extrabold tracking-[-.5px]`}>
        Globo Slots
      </span>
    </Link>
  )
}
