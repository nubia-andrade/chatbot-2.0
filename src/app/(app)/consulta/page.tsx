import { redirect } from 'next/navigation'

/**
 * `/consulta` não é mais uma tela própria — é a entrada do wizard de 7
 * passos (Task 9). Manda direto para o primeiro passo em vez de deixar a
 * rota sem conteúdo: a barra lateral (`BarraLateral.tsx`) aponta "Nova
 * consulta" para cá.
 */
export default function PaginaConsulta() {
  redirect('/consulta/cliente')
}
