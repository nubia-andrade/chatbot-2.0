import type { Metadata } from 'next'
import { Space_Grotesk, Manrope, Poppins } from 'next/font/google'
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

const vitrineTituloFonte = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--fonte-vitrine-titulo',
})

export const metadata: Metadata = {
  title: 'CHATBOT 2.0',
  description: 'Consulta de disponibilidade e geração de propostas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${tituloFonte.variable} ${corpoFonte.variable} ${vitrineTituloFonte.variable}`}>
      {/*
        suppressHydrationWarning apenas no <body>: extensões de navegador
        (ColorZilla, Grammarly e afins) injetam atributos aqui depois que a
        página carrega, e o React acusa diferença entre servidor e cliente por
        algo que não é nosso. A supressão vale só para os atributos deste
        elemento — qualquer diferença de verdade, dentro da árvore, continua
        sendo reportada.
      */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
