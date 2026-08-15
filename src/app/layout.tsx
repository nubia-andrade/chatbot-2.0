import type { Metadata } from 'next'
import { Space_Grotesk, Manrope } from 'next/font/google'
import './globals.css'

const tituloFonte = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-titulo',
})

const corpoFonte = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--fonte-corpo',
})

export const metadata: Metadata = {
  title: 'CHATBOT 2.0',
  description: 'Consulta de disponibilidade e geração de propostas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${tituloFonte.variable} ${corpoFonte.variable}`}>
      <body>{children}</body>
    </html>
  )
}
