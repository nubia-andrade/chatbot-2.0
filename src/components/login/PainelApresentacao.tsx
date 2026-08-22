import { MarcaGloboSlots } from '@/components/layout/MarcaGloboSlots'

/** Apresentação da marca Globo Slots no login. */
export function PainelApresentacao() {
  return (
    <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[#14161a] p-8 sm:p-12 lg:min-h-[640px]">
      <div className="vitrine-pop pointer-events-none absolute -right-5 top-14 select-none text-[160px] font-extrabold leading-none tracking-[-8px] text-white/[.035]">2026</div>
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,90,60,.34),rgba(124,58,237,.12)_45%,transparent_70%)]" />

      <div className="relative z-10">
        <MarcaGloboSlots inversa href="/login" />
      </div>

      <div className="relative z-10 max-w-[430px]">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[2px] text-[#ff795f]">Oportunidades comerciais Globo</p>
        <h1 className="vitrine-pop text-[34px] font-extrabold leading-[1.04] tracking-[-1.4px] text-white sm:text-[46px]">
          Descubra onde sua marca pode entrar.
        </h1>
        <p className="mt-5 max-w-[370px] text-[14px] leading-[1.6] text-white/60">
          Encontre oportunidades, consulte slots disponíveis e transforme uma ação em proposta comercial.
        </p>
      </div>

      <p className="relative z-10 text-[12px] font-semibold text-white/55">
        Oportunidades → Disponibilidade → Proposta
      </p>
    </div>
  )
}
