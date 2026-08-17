/**
 * Estado de espera de uma página de passo, entre a montagem e o instante
 * em que `useGuardaDoPasso` decide se fica ou redireciona — achado
 * Important #2 da revisão da Task 9.
 *
 * Sem isso, a página pintava o conteúdo inteiro (título, descrição, ações)
 * antes de a guarda rodar em `useEffect`, e se a guarda decidisse
 * redirecionar, esse conteúdo tinha piscado à toa. Hoje é só o texto de
 * espaço reservado do esqueleto, mas a partir da Task 10 seria dado de
 * negócio de verdade (nome de cliente, valor) — daí corrigir aqui, uma
 * vez, para as Tasks 10-14 herdarem o comportamento certo.
 *
 * Não é uma tela em branco: `role="status"` + texto visível avisam que
 * algo está acontecendo, para quem usa leitor de tela e para quem só está
 * olhando.
 */
export function CarregandoDoPasso() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] p-10 text-center text-[13.5px] text-[var(--texto-3)]"
      style={{ background: 'var(--superficie)' }}
    >
      Carregando sua consulta…
    </div>
  )
}
