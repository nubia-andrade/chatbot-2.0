/**
 * Placeholder reutilizável para as seções que ainda não têm implementação.
 *
 * As tarefas seguintes substituem, uma a uma, os lugares que hoje renderizam
 * este componente por telas reais (busca de cliente, calendário, propostas
 * etc. — ver `design_handoff`).
 */
export function SecaoEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <section
      style={{
        background: 'var(--superficie)',
        borderRadius: 'var(--raio-janela)',
        padding: '40px',
        border: '1px solid var(--borda)',
      }}
    >
      <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: 26, fontWeight: 700 }}>
        {titulo}
      </h1>
      <p style={{ color: 'var(--texto-2)', marginTop: 8 }}>
        Esta seção ainda está em construção. Ela chega nas próximas entregas.
      </p>
    </section>
  )
}
