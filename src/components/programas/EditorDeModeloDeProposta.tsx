'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  adicionarSlideAoModelo,
  moverSlideDoModelo,
  removerSlideDoModelo,
} from '@/lib/acoes/modelo-proposta'
import type { SlideDoModeloDeProposta } from '@/lib/dados/modelo-proposta'

type Props = {
  programaId: string
  slides: SlideDoModeloDeProposta[]
}

export function EditorDeModeloDeProposta({ programaId, slides }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adicionar(arquivo: File) {
    setOcupado(true)
    setErro(null)
    const formulario = new FormData()
    formulario.append('arquivo', arquivo)
    const resultado = await adicionarSlideAoModelo(programaId, formulario)
    setOcupado(false)
    if (input.current) input.current.value = ''
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  async function mover(slideId: string, direcao: 'subir' | 'descer') {
    setOcupado(true)
    setErro(null)
    const resultado = await moverSlideDoModelo(programaId, slideId, direcao)
    setOcupado(false)
    if (resultado.erro) setErro(resultado.erro)
    else router.refresh()
  }

  async function remover(slideId: string) {
    if (!window.confirm('Remover este slide do modelo de proposta?')) return
    setOcupado(true)
    setErro(null)
    const resultado = await removerSlideDoModelo(programaId, slideId)
    setOcupado(false)
    if (resultado.erro) setErro(resultado.erro)
    else router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--texto)]">Modelo visual da proposta</h2>
            <p className="mt-1 max-w-[680px] text-[12.5px] leading-[1.55] text-[var(--texto-3)]">
              Adicione os slides institucionais do programa como imagens PNG ou JPG. Na proposta final, eles aparecem nesta ordem e são seguidos pelas páginas dinâmicas com cliente, datas e valores.
            </p>
          </div>
          <div>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0]
                if (arquivo) void adicionar(arquivo)
              }}
            />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => input.current?.click()}
              className="h-[42px] rounded-[11px] px-5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--marca)', boxShadow: 'var(--sombra-botao)' }}
            >
              {ocupado ? 'Processando…' : '+ Adicionar slide'}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[11px] bg-[var(--prazo-fundo)] px-4 py-3 text-[11.5px] leading-[1.5] text-[var(--texto-2)]">
          Recomendação: exporte os slides em proporção 16:9. O PDF preserva a imagem inteira e centraliza automaticamente quando a proporção for diferente.
        </div>

        {erro && (
          <p role="alert" className="mt-3 rounded-[10px] border border-[var(--concorrencia)] bg-[var(--concorrencia-fundo)] px-4 py-3 text-[12px] font-semibold text-[var(--concorrencia-texto)]">
            {erro}
          </p>
        )}
      </section>

      {slides.length === 0 ? (
        <section className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-6 py-10 text-center">
          <p className="text-[14px] font-bold text-[var(--texto)]">Nenhum slide cadastrado</p>
          <p className="mt-1 text-[12px] text-[var(--texto-3)]">
            A proposta ainda pode ser gerada, usando apenas as páginas dinâmicas do sistema.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide, indice) => (
            <article key={slide.id} className="overflow-hidden rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)]">
              <div className="relative aspect-video bg-[var(--superficie-suave)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.imagem_url} alt={`Slide ${indice + 1}`} className="h-full w-full object-contain" />
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10.5px] font-bold text-white">
                  Slide {indice + 1}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-[var(--borda)] p-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={ocupado || indice === 0}
                    onClick={() => void mover(slide.id, 'subir')}
                    className="h-8 rounded-[9px] border border-[var(--borda-forte)] px-3 text-[11.5px] font-bold text-[var(--texto-2)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ← Antes
                  </button>
                  <button
                    type="button"
                    disabled={ocupado || indice === slides.length - 1}
                    onClick={() => void mover(slide.id, 'descer')}
                    className="h-8 rounded-[9px] border border-[var(--borda-forte)] px-3 text-[11.5px] font-bold text-[var(--texto-2)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Depois →
                  </button>
                </div>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void remover(slide.id)}
                  className="h-8 px-2 text-[11.5px] font-bold text-[var(--concorrencia-texto)] disabled:opacity-40"
                >
                  Remover
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
