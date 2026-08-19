'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  salvarAcessosUsuario,
  salvarSecoesDoPerfil,
  type PermissaoDeSecao,
  type UsuarioComAcessos,
} from '@/lib/acoes/perfis-acessos'
import { SECOES_DO_APP, type Perfil, type SecaoApp } from '@/lib/dominio/perfis'

type ProgramaOpcao = { id: string; nome: string }

type Props = {
  usuarios: UsuarioComAcessos[]
  programas: ProgramaOpcao[]
  permissoesSecoes: PermissaoDeSecao[]
}

const OPCOES_DE_PERFIL: { valor: Perfil; rotulo: string; descricao: string }[] = [
  { valor: 'executivo', rotulo: 'Executivo', descricao: 'Consulta disponibilidade e gera as próprias propostas nacionais.' },
  { valor: 'executivo_regional', rotulo: 'Executivo regional', descricao: 'Libera também consultas e propostas regionais.' },
  { valor: 'consultor_programa', rotulo: 'Consultor do programa', descricao: 'Administra os programas vinculados e acompanha suas propostas.' },
  { valor: 'proprietario', rotulo: 'Proprietário', descricao: 'Acesso administrativo completo, inclusive perfis e acessos.' },
]

function secoesDoPerfil(permissoes: PermissaoDeSecao[], perfil: Perfil): SecaoApp[] {
  return SECOES_DO_APP
    .filter(({ valor }) => permissoes.some((item) => item.perfil === perfil && item.secao === valor && item.permitido))
    .map(({ valor }) => valor)
}

export function PainelDePerfisEAcessos({ usuarios, programas, permissoesSecoes }: Props) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<UsuarioComAcessos | null>(usuarios[0] ?? null)
  const [perfis, setPerfis] = useState<Perfil[]>(usuarios[0]?.perfis ?? [])
  const [programasSelecionados, setProgramasSelecionados] = useState<string[]>(usuarios[0]?.programas ?? [])
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [matriz, setMatriz] = useState<PermissaoDeSecao[]>(permissoesSecoes)
  const [mensagemMatriz, setMensagemMatriz] = useState<string | null>(null)
  const [salvando, iniciarTransicao] = useTransition()
  const [salvandoMatriz, iniciarTransicaoMatriz] = useTransition()

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return usuarios
    return usuarios.filter((usuario) =>
      `${usuario.nome} ${usuario.email} ${usuario.cargo ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo),
    )
  }, [busca, usuarios])

  function escolherUsuario(usuario: UsuarioComAcessos) {
    setSelecionado(usuario)
    setPerfis(usuario.perfis)
    setProgramasSelecionados(usuario.programas)
    setMensagem(null)
  }

  function alternarPerfil(perfil: Perfil) {
    setPerfis((atuais) =>
      atuais.includes(perfil) ? atuais.filter((item) => item !== perfil) : [...atuais, perfil],
    )
    if (perfil === 'consultor_programa' && perfis.includes(perfil)) setProgramasSelecionados([])
    setMensagem(null)
  }

  function alternarPrograma(programaId: string) {
    setProgramasSelecionados((atuais) =>
      atuais.includes(programaId)
        ? atuais.filter((item) => item !== programaId)
        : [...atuais, programaId],
    )
    setMensagem(null)
  }

  function alternarSecao(perfil: Perfil, secao: SecaoApp) {
    if (perfil === 'proprietario' || secao === 'inicio') return
    setMatriz((atual) => {
      const existe = atual.find((item) => item.perfil === perfil && item.secao === secao)
      if (!existe) return [...atual, { perfil, secao, permitido: true }]
      return atual.map((item) =>
        item.perfil === perfil && item.secao === secao
          ? { ...item, permitido: !item.permitido }
          : item,
      )
    })
    setMensagemMatriz(null)
  }

  function salvarMatriz() {
    iniciarTransicaoMatriz(async () => {
      for (const opcao of OPCOES_DE_PERFIL) {
        const resposta = await salvarSecoesDoPerfil({
          perfil: opcao.valor,
          secoes: secoesDoPerfil(matriz, opcao.valor),
        })
        if (resposta.erro) {
          setMensagemMatriz(resposta.erro)
          return
        }
      }
      setMensagemMatriz('Permissões de seções atualizadas com sucesso.')
    })
  }

  function salvar() {
    if (!selecionado) return
    iniciarTransicao(async () => {
      const resposta = await salvarAcessosUsuario({
        usuarioId: selecionado.usuario_id,
        perfis,
        programas: programasSelecionados,
      })
      setMensagem(resposta.erro ?? 'Acessos atualizados com sucesso.')
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--texto)]">Seções visíveis por perfil</h2>
            <p className="mt-1 max-w-[760px] text-[11.5px] leading-[1.5] text-[var(--texto-3)]">
              As permissões de perfis acumulam. Início é obrigatório para todos e Proprietário mantém acesso completo para evitar bloqueio administrativo.
            </p>
          </div>
          <button
            type="button"
            onClick={salvarMatriz}
            disabled={salvandoMatriz}
            className="rounded-[10px] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--marca)' }}
          >
            {salvandoMatriz ? 'Salvando…' : 'Salvar matriz'}
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="border-b border-[var(--borda)] px-3 py-2 text-[11px] uppercase text-[var(--texto-3)]">Perfil</th>
                {SECOES_DO_APP.map((secao) => (
                  <th key={secao.valor} className="border-b border-[var(--borda)] px-3 py-2 text-center text-[11px] uppercase text-[var(--texto-3)]">
                    {secao.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OPCOES_DE_PERFIL.map((opcao) => (
                <tr key={opcao.valor}>
                  <td className="border-b border-[var(--borda)] px-3 py-3">
                    <p className="text-[12.5px] font-bold text-[var(--texto)]">{opcao.rotulo}</p>
                  </td>
                  {SECOES_DO_APP.map((secao) => {
                    const marcado = matriz.some((item) => item.perfil === opcao.valor && item.secao === secao.valor && item.permitido)
                    const bloqueado = opcao.valor === 'proprietario' || secao.valor === 'inicio'
                    return (
                      <td key={secao.valor} className="border-b border-[var(--borda)] px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={bloqueado}
                          onChange={() => alternarSecao(opcao.valor, secao.valor)}
                          aria-label={`${opcao.rotulo}: ${secao.rotulo}`}
                          className="h-4 w-4 accent-[var(--roxo)] disabled:opacity-55"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mensagemMatriz && (
          <div className="mt-4 rounded-[10px] bg-[var(--superficie-suave)] px-4 py-3 text-[12px] text-[var(--texto-2)]">
            {mensagemMatriz}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-4">
          <label className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">Usuários</label>
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="mt-2 h-10 w-full rounded-[10px] border border-[var(--borda-forte)] bg-white px-3 text-[13px] outline-none focus:ring-2 focus:ring-[var(--roxo)]"
          />

          <div className="mt-3 flex max-h-[560px] flex-col gap-2 overflow-y-auto">
            {usuariosFiltrados.map((usuario) => {
              const ativo = selecionado?.usuario_id === usuario.usuario_id
              return (
                <button
                  key={usuario.usuario_id}
                  type="button"
                  onClick={() => escolherUsuario(usuario)}
                  className="rounded-[10px] border p-3 text-left"
                  style={{ borderColor: ativo ? 'var(--roxo)' : 'var(--borda)', background: ativo ? '#F5F3FF' : 'white' }}
                >
                  <p className="text-[13px] font-bold text-[var(--texto)]">{usuario.nome}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--texto-3)]">{usuario.email}</p>
                  {usuario.cargo && <p className="mt-1 text-[10.5px] text-[var(--texto-3)]">{usuario.cargo}</p>}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="rounded-[var(--raio-card)] border border-[var(--borda)] bg-[var(--superficie)] p-5 sm:p-6">
          {!selecionado ? (
            <p className="text-[13px] text-[var(--texto-3)]">Nenhum usuário disponível.</p>
          ) : (
            <>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--texto-3)]">Acessos de</p>
                <h2 className="mt-1 text-[18px] font-bold text-[var(--texto)]">{selecionado.nome}</h2>
                <p className="mt-1 text-[12px] text-[var(--texto-3)]">{selecionado.email}</p>
              </div>

              <div className="mt-6">
                <h3 className="text-[13.5px] font-bold text-[var(--texto)]">Perfis</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {OPCOES_DE_PERFIL.map((opcao) => {
                    const marcado = perfis.includes(opcao.valor)
                    return (
                      <label key={opcao.valor} className="flex cursor-pointer gap-3 rounded-[11px] border p-3" style={{ borderColor: marcado ? 'var(--roxo)' : 'var(--borda)' }}>
                        <input type="checkbox" checked={marcado} onChange={() => alternarPerfil(opcao.valor)} className="mt-0.5 h-4 w-4 accent-[var(--roxo)]" />
                        <span>
                          <span className="block text-[12.5px] font-bold text-[var(--texto)]">{opcao.rotulo}</span>
                          <span className="mt-0.5 block text-[10.5px] leading-[1.45] text-[var(--texto-3)]">{opcao.descricao}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {perfis.includes('consultor_programa') && (
                <div className="mt-6 border-t border-[var(--borda)] pt-5">
                  <h3 className="text-[13.5px] font-bold text-[var(--texto)]">Programas do consultor</h3>
                  <p className="mt-1 text-[11.5px] text-[var(--texto-3)]">Esses vínculos definem quais programas ele administra e quais propostas consegue acompanhar.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {programas.map((programa) => {
                      const marcado = programasSelecionados.includes(programa.id)
                      return (
                        <label key={programa.id} className="flex cursor-pointer items-center gap-2 rounded-[9px] border border-[var(--borda)] px-3 py-2.5">
                          <input type="checkbox" checked={marcado} onChange={() => alternarPrograma(programa.id)} className="h-4 w-4 accent-[var(--roxo)]" />
                          <span className="text-[12px] font-semibold text-[var(--texto-2)]">{programa.nome}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {mensagem && <div className="mt-5 rounded-[10px] bg-[var(--superficie-suave)] px-4 py-3 text-[12px] text-[var(--texto-2)]">{mensagem}</div>}

              <div className="mt-6 flex justify-end border-t border-[var(--borda)] pt-5">
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvando || perfis.length === 0}
                  className="rounded-[11px] px-6 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--marca)' }}
                >
                  {salvando ? 'Salvando…' : 'Salvar acessos'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
