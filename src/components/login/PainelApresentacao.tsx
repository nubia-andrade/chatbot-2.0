/**
 * O lado colorido da tela de login (52% da largura no desktop).
 *
 * Só apresentação — sem estado nem interação. Reproduz a seção #1a do
 * handoff: gradiente de marca, três tiles flutuantes e a promessa do
 * produto em três passos.
 */
export function PainelApresentacao() {
  return (
    <div
      className="relative flex min-h-[280px] flex-col justify-between gap-10 overflow-hidden p-8 sm:p-12 lg:min-h-[640px]"
      style={{ background: 'var(--marca)' }}
    >
      {/*
        A inclinação de cada tile viaja pela custom property `--r`, lida pelo
        keyframe `floaty` (ver globals.css). `transform` é a propriedade
        animada — se a rotação fosse fixada ali por fora, a animação a
        sobrescreveria a cada quadro e todos os tiles cairiam para 0deg.
      */}
      <div
        aria-hidden
        className="absolute -right-6 top-14 h-[120px] w-[120px] rounded-[28px]"
        style={{
          background: 'var(--tile-a)',
          animation: 'floaty 7s ease-in-out infinite',
          boxShadow: '0 20px 40px rgba(0, 0, 0, .22)',
          ['--r' as string]: '9deg',
        }}
      />
      <div
        aria-hidden
        className="absolute right-24 top-[230px] h-[120px] w-[120px] rounded-[28px]"
        style={{
          background: 'var(--tile-b)',
          animation: 'floaty 8s ease-in-out .6s infinite',
          boxShadow: '0 20px 40px rgba(0, 0, 0, .22)',
          ['--r' as string]: '-7deg',
        }}
      />
      <div
        aria-hidden
        className="absolute right-2 top-[380px] h-[120px] w-[120px] rounded-[28px]"
        style={{
          background: 'var(--tile-c)',
          animation: 'floaty 6.4s ease-in-out .3s infinite',
          boxShadow: '0 20px 40px rgba(0, 0, 0, .22)',
          ['--r' as string]: '6deg',
        }}
      />

      <div
        className="relative z-10 text-[18px] font-extrabold tracking-[.5px] text-white"
        style={{ fontFamily: 'var(--fonte-titulo)' }}
      >
        chatbot <span className="opacity-70">2.0</span>
      </div>

      <div className="relative z-10 max-w-[400px]">
        <h1
          className="text-[32px] font-extrabold leading-[1.08] tracking-[-1px] text-white sm:text-[44px]"
          style={{ fontFamily: 'var(--fonte-titulo)' }}
        >
          Posso vender?
          <br />
          Quando? Quanto?
        </h1>
      </div>

      <p className="relative z-10 text-[12px] font-semibold text-white/75">
        Disponibilidade → Proposta → PDF
      </p>
    </div>
  )
}
