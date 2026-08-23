'use client'

import { useMemo, useState, useTransition } from 'react'
import { salvarConfiguracaoEmailPrograma } from '@/lib/acoes/email-programa'
import type { UsuarioDeEmailDoPrograma } from '@/lib/dados/email-programa'

type Props = {
  programaId: string
  programaNome: string
  ativoInicial: boolean
  usuarios: UsuarioDeEmailDoPrograma[]
  schemaDisponivel: boolean
  microsoftConfigurado: boolean
  remetente: string
}

export function ConfiguracaoEmailDoPrograma({
  programaId,
  programaNome,
  ativoInicial,
  usuarios,
  schemaDisponivel,
  microsoftConfigurado,
  remetente,
}: Props) {
  const [ativo, setAtivo] = useState(ativoInicial)
  const [selecionados, setSelecionados] = useState<string[]>(usuarios.filter((item) => item.selecionado).map((item) => item.usuario_id))
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pendente, iniciarTransicao] = useTransition()

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return usuarios
    return usuarios.filter((item) => `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(termo))
  }, [usuarios, busca])

  function alternar(usuarioId: string) {
    setSalvo(false)
    setSelecionados((atuais) => atuais.includes(usuarioId)
      ? atuais.filter((id) => id !== usuarioId)
      : [...atuais, usuarioId])
  }

  function salvar() {
    setErro(null)
    setSalvo(false)
    iniciarTransicao(async () => {
      const retorno = await salvarConfiguracaoEmailPrograma({
        programaId,
        ativo,
        responsaveis: selecionados,
      })
      if (retorno.erro) {
        setErro(retorno.erro)
        return
      }
      setSalvo(true)
    })
  }

  if (!schemaDisponivel) {
    return (
      <section className="rounded-[var(--raio-card)] border border-[#F3C7D9] bg-[#FFF7FA] p-5">
        <h2 className="text-[16px] font-bold text-[var(--texto)]">Configuração de e-mail ainda não habilitada</h2>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--texto-2)]">
          Execute <strong>supabase/schema-entrega-4-fechamento-propostas.sql</strong> no Supabase. Depois recarregue esta página.
        </p>
      </section>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--roxo)]">Distribuição automática</p>
            <h2 className="mt-1 text-[18px] font-bold text-[var(--texto)]">E-mail ao gerar proposta</h2>
            <p className="mt-1 max-w-[680px] text-[12.5px] leading-[1.55] text-[var(--texto-3)]">
              O executivo que gerar a proposta será sempre o destinatário principal. Os usuários selecionados abaixo recebem cópia.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-full border border-[var(--borda)] bg-[var(--superficie-suave)] px-4 py-2.5">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(evento) => { setAtivo(evento.target.checked); setSalvo(false) }}
              className="h-4 w-4 accent-[#F20A6B]"
            />
            <span className="text-[12px] font-bold text-[var(--texto)]">Disparo automático</span>
          </label>
        </div>

        <div className="mt-5 rounded-[12px] border border-[var(--borda)] bg-[var(--superficie-suave)] p-4">
          <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Para</p>
          <p className="mt-1 text-[13px] font-bold text-[var(--texto)]">Executivo que gerou a proposta</p>
          <p className="mt-1 text-[11px] text-[var(--texto-3)]">Automático — usa o e-mail do usuário logado.</p>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-bold uppercase text-[var(--texto-3)]">Cópia (CC)</p>
              <h3 className="mt-1 text-[14px] font-bold text-[var(--texto)]">Responsáveis por {programaNome}</h3>
              <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Somente usuários já cadastrados no Globo Slots podem ser selecionados.</p>
            </div>
            <span className="rounded-full bg-[#F5F3FF] px-3 py-1 text-[10.5px] font-bold text-[var(--roxo)]">{selecionados.length} selecionado{selecionados.length === 1 ? '' : 's'}</span>
          </div>

          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="mt-4 h-[42px] w-full rounded-[var(--raio-campo)] border border-[var(--borda-forte)] bg-white px-3 text-[13px] outline-none focus:border-[#A031F5]"
          />

          <div className="mt-3 max-h-[360px] overflow-y-auto rounded-[12px] border border-[var(--borda)]">
            {filtrados.length === 0 ? (
              <p className="p-4 text-[12px] text-[var(--texto-3)]">Nenhum usuário encontrado.</p>
            ) : filtrados.map((usuario) => {
              const marcado = selecionados.includes(usuario.usuario_id)
              return (
                <label key={usuario.usuario_id} className="flex cursor-pointer items-center gap-3 border-b border-[var(--borda)] px-4 py-3 last:border-0 hover:bg-[var(--superficie-suave)]">
                  <input type="checkbox" checked={marcado} onChange={() => alternar(usuario.usuario_id)} className="h-4 w-4 accent-[#F20A6B]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-bold text-[var(--texto)]">{usuario.nome}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-[var(--texto-3)]">{usuario.email}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--borda)] pt-5">
          <div>
            {!microsoftConfigurado && <p className="text-[11px] font-semibold text-[#A65A00]">Microsoft 365 ainda sem credenciais completas. A configuração pode ser salva, mas o envio ficará pendente.</p>}
            {erro && <p role="alert" className="text-[11.5px] font-semibold text-[var(--concorrencia-texto)]">{erro}</p>}
            {salvo && <p className="text-[11.5px] font-semibold text-[var(--disponivel-texto)]">Configuração salva.</p>}
          </div>
          <button
            type="button"
            onClick={salvar}
            disabled={pendente}
            className="rounded-[10px] px-5 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--marca)' }}
          >
            {pendente ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      </section>

      <aside className="h-fit rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4 xl:sticky xl:top-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[.07em] text-[var(--texto-3)]">Prévia do e-mail</p>
        <div className="mt-3 overflow-hidden rounded-[16px] border border-[#E8E3EB] bg-[#F6F3F7] p-3">
          <div className="overflow-hidden rounded-[13px] bg-white shadow-sm">
            <div className="bg-[#F20A6B] px-5 py-5 text-white">
              <p className="text-[23px] font-bold leading-tight">{programaNome}</p>
              <p className="mt-1 text-[10.5px] opacity-90">Nova proposta comercial pronta para consulta</p>
            </div>
            <div className="p-5">
              <p className="text-[14px] font-bold text-[var(--texto)]">Olá, Executivo.</p>
              <div className="mt-4 rounded-[10px] bg-[#FAF8FB] p-3 text-[10.5px] leading-[1.65] text-[var(--texto-2)]">
                <p><strong>ANUNCIANTE</strong><br />Nome do anunciante</p>
                <p className="mt-2"><strong>MARCA</strong><br />Nome da marca</p>
                <p className="mt-2"><strong>PRODUTO</strong><br />Produto da proposta</p>
                <p className="mt-2"><strong>EXIBIÇÃO</strong><br />Datas selecionadas</p>
              </div>
              <p className="mt-4 text-[9px] font-bold uppercase text-[var(--texto-3)]">Total comercial</p>
              <p className="mt-1 text-[21px] font-bold text-[#F20A6B]">R$ 0,00</p>
              <div className="mt-4 rounded-[9px] bg-[#F20A6B] py-3 text-center text-[11px] font-bold text-white">Abrir proposta</div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-[10px] bg-[var(--superficie-suave)] p-3">
          <p className="text-[10px] font-bold uppercase text-[var(--texto-3)]">Remetente atual</p>
          <p className="mt-1 break-all text-[11.5px] font-semibold text-[var(--texto)]">{remetente}</p>
          <p className="mt-2 text-[10.5px] leading-[1.45] text-[var(--texto-3)]">O PDF não vai anexado. O botão usa um link seguro válido por 30 dias.</p>
        </div>
      </aside>
    </div>
  )
}
