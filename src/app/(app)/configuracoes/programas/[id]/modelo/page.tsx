/**
 * Aba Modelo de propostas — aparece desabilitada em `AbasDoPrograma`
 * ("Disponível na próxima entrega"), mas a rota existe mesmo assim: a spec
 * decidiu mostrar em vez de esconder, para que o consultor saiba que a
 * funcionalidade existe. Quem chegar aqui pela URL vê a mesma explicação.
 */
export default function PaginaDeModeloDeProposta() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--raio-card)] border border-dashed border-[var(--borda-forte)] bg-[var(--superficie-suave)] px-6 py-12 text-center">
      <h3 className="text-[15px] font-bold text-[var(--texto)]">Modelo de propostas</h3>
      <p className="max-w-[420px] text-[13px] text-[var(--texto-3)]">
        Disponível na próxima entrega.
      </p>
    </div>
  )
}
