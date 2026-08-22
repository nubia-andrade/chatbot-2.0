/** Apresentação editorial clara do Globo Slots no login. */
export function PainelApresentacao() {
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[26px] bg-[#f4f5f6] p-8 sm:p-10 lg:min-h-[560px] lg:p-12">
      <div className="pointer-events-none absolute -left-10 top-12 h-72 w-72 rounded-full bg-white/75 blur-2xl" />
      <div className="pointer-events-none absolute bottom-8 left-[36%] h-64 w-64 rounded-full bg-[#efeaff] blur-3xl" />

      <div className="relative z-10 max-w-[500px]">
        <p className="vitrine-pop text-[11px] font-bold uppercase tracking-[2px] text-[#ff5a3c]">
          Oportunidades comerciais Globo
        </p>
        <h1 className="vitrine-pop mt-5 max-w-[470px] text-[38px] font-semibold leading-[1.05] tracking-[-1.6px] text-[#111318] sm:text-[48px] lg:text-[54px]">
          Descubra onde sua marca pode entrar.
        </h1>
        <p className="mt-5 max-w-[430px] text-[14px] leading-[1.7] text-[#5f6670] sm:text-[15px]">
          Encontre oportunidades de ação, consulte disponibilidade e transforme uma ideia em proposta comercial.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {['Oportunidades', 'Disponibilidade', 'Propostas'].map((item) => (
            <span key={item} className="rounded-full border border-[#d9dce1] bg-white px-4 py-2 text-[11px] font-semibold text-[#363b43] shadow-[0_6px_18px_-15px_rgba(20,22,26,.45)]">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-8 right-[-16px] hidden h-[390px] w-[410px] lg:block">
        <div className="absolute right-2 top-0 h-[220px] w-[180px] rotate-[8deg] rounded-[22px] bg-gradient-to-br from-[#ff6a45] via-[#ff8750] to-[#ffb14b] p-5 shadow-[0_24px_55px_-30px_rgba(20,22,26,.45)]">
          <p className="vitrine-pop text-[13px] font-bold text-white/90">É de Casa</p>
          <div className="mt-20 h-14 rounded-[12px] bg-white/22" />
        </div>
        <div className="absolute bottom-5 right-[150px] h-[210px] w-[174px] -rotate-[7deg] rounded-[22px] bg-gradient-to-br from-[#6d42ff] via-[#8b3dff] to-[#e647a6] p-5 shadow-[0_24px_55px_-30px_rgba(20,22,26,.4)]">
          <p className="vitrine-pop text-[13px] font-bold text-white/90">BBB</p>
          <div className="mt-20 h-12 rounded-[12px] bg-white/20" />
        </div>
        <div className="absolute bottom-[-5px] right-[-20px] h-[170px] w-[150px] rotate-[4deg] rounded-[22px] bg-gradient-to-br from-[#2eb5ff] to-[#2468ff] p-5 shadow-[0_24px_55px_-30px_rgba(20,22,26,.38)]">
          <p className="vitrine-pop text-[13px] font-bold text-white/90">SporTV</p>
        </div>
      </div>
    </div>
  )
}
