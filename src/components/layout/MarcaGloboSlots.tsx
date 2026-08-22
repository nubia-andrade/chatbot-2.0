'use client'

import Link from 'next/link'

type Props = {
  inversa?: boolean
  compacta?: boolean
  href?: string
}

export function MarcaGloboSlots({ inversa = false, compacta = false, href = '/oportunidades' }: Props) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2.5" aria-label="Globo Slots">
      <img
        src="/brand/globo-slots-mark.svg"
        alt=""
        aria-hidden
        className={compacta ? 'h-7 w-11 object-contain' : 'h-9 w-14 object-contain'}
        style={{ filter: inversa ? 'none' : 'brightness(0)' }}
      />
      <span className={`${compacta ? 'text-[17px]' : 'text-[20px]'} vitrine-pop font-extrabold tracking-[-.5px] ${inversa ? 'text-white' : 'text-[#14161a]'}`}>
        Globo Slots
      </span>
    </Link>
  )
}
