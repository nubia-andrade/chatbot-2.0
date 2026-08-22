import type { Metadata } from 'next'
import { Manrope, Poppins } from 'next/font/google'
import './globals.css'

const tituloFonte = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--fonte-titulo',
})

const corpoFonte = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--fonte-corpo',
})

export const metadata: Metadata = {
  title: 'Globo Slots',
  description: 'Oportunidades, disponibilidade e propostas comerciais dos programas Globo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${tituloFonte.variable} ${corpoFonte.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
