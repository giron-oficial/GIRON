import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { carregarBarra, resumoGuardado, type ResumoBarra } from '../lib/barra'
import { supabase } from '../lib/supabase'
import Icone, { type NomeIcone } from './Icone'
import { Logo } from './Logo'

const itens: { to: string; rotulo: string; icone: NomeIcone }[] = [
  { to: '/', rotulo: 'Início', icone: 'inicio' },
  { to: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { to: '/contratos', rotulo: 'Contratos', icone: 'contratos' },
  { to: '/calculadora', rotulo: 'Calculadora', icone: 'calculadora' },
  { to: '/relatorios', rotulo: 'Relatórios', icone: 'relatorios' },
  { to: '/configuracoes', rotulo: 'Configurações', icone: 'ajustes' },
]

const emBreve: { rotulo: string; icone: NomeIcone }[] = [
]

const TESTE_DIAS = 30

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Cartão do plano: teste grátis (com barrinha), ativo ou bloqueado
function Plano({ r }: { r: ResumoBarra }) {
  if (r.statusAcesso === 'bloqueio_total' || r.statusAcesso === 'bloqueio_parcial') {
    return (
      <div className="flex flex-col gap-1 rounded-2xl bg-vencido/15 p-3.5">
        <span className="text-xs font-bold text-vencido">{r.statusAcesso === 'bloqueio_total' ? 'Acesso bloqueado' : 'Mensalidade atrasada'}</span>
        <span className="text-xs text-suave">Fale com o suporte do GIRON</span>
      </div>
    )
  }
  if (r.testeGratisAte) {
    const faltam = r.testeFaltam
    const usado = Math.min(100, Math.round(((TESTE_DIAS - faltam) / TESTE_DIAS) * 100))
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-superficie-2 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-suave">Teste grátis</span>
          <span className="text-sm font-bold">{faltam === 0 ? 'Termina hoje' : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-borda">
          <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${usado}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-superficie-2 p-3.5 text-sm font-bold">
      <span className="size-2 rounded-full bg-marca-brilho" />
      Plano ativo
    </div>
  )
}

// Número pequeno ao lado do item do menu
function Contador({ n, cor, titulo }: { n: number; cor: string; titulo: string }) {
  if (!n) return null
  return (
    <span title={titulo} className={`ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-extrabold ${cor}`}>
      {n > 99 ? '99+' : n}
    </span>
  )
}

// Estrutura de todas as telas internas (visual escuro com verde):
// computador = menu lateral fixo (opção A); celular = barra no topo + barra de baixo com o "+" no meio (opção B)
export default function Moldura({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { pathname, hash } = useLocation()
  const [resumo, setResumo] = useState<ResumoBarra | null>(resumoGuardado)

  useEffect(() => {
    carregarBarra()
      .then(setResumo)
      .catch(() => {})
  }, [])

  const contadores: Record<string, ReactNode> = {
    '/': <Contador n={resumo?.cobrarAteHoje ?? 0} cor="bg-vencido text-sobre-verde" titulo="Cobranças atrasadas ou de hoje" />,
    '/clientes': resumo?.cadastrosPendentes ? (
      <Contador n={resumo.cadastrosPendentes} cor="bg-amanha text-sobre-amanha" titulo="Cadastros esperando aprovação" />
    ) : (
      <span className="ml-auto text-xs text-suave">{resumo?.clientes || ''}</span>
    ),
  }

  const noResumo = pathname === '/' && hash === '#resumo'
  const baixo = (ativo: boolean) => `relative flex min-w-14 flex-col items-center gap-1 text-[11px] ${ativo ? 'font-bold text-marca' : 'text-suave'}`

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-borda bg-tinta px-3.5 py-5 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <Logo tamanho={32} />
          <span className="font-display text-lg font-extrabold tracking-wider">GIRON</span>
        </div>

        {resumo && (
          <div className="flex items-center gap-3 rounded-2xl bg-superficie-2 p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-borda font-display text-sm font-bold">{iniciais(resumo.nome)}</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold">{resumo.nome}</span>
              <span className="flex items-center gap-1 truncate text-[11px] text-suave">
                <Icone nome="globo" tamanho={12} />
                {resumo.subdominio}.gironga.com.br
              </span>
            </div>
          </div>
        )}

        <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
          {itens.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? 'bg-superficie-2 font-bold text-marca' : 'font-medium text-suave hover:bg-superficie-2/60 hover:text-texto'}`
              }
            >
              <Icone nome={i.icone} />
              {i.rotulo}
              {contadores[i.to]}
            </NavLink>
          ))}
          {emBreve.length > 0 && <span className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-widest text-suave/70 uppercase">Em breve</span>}
          {emBreve.map((i) => (
            <span key={i.rotulo} aria-disabled="true" className="flex h-10 cursor-default items-center gap-3 rounded-xl px-3 text-sm text-suave/60">
              <Icone nome={i.icone} />
              {i.rotulo}
            </span>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5">
          <Link to="/clientes/novo" className="verde flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-extrabold">
            <Icone nome="mais" tamanho={18} />
            Novo cliente
          </Link>
          {resumo && <Plano r={resumo} />}
          <div className="flex items-center gap-2 px-1">
            <span className="min-w-0 flex-1 truncate text-[11px] text-suave">{session?.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-suave hover:bg-superficie-2 hover:text-texto"
            >
              <Icone nome="sair" tamanho={16} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-28 lg:px-7 lg:py-6 lg:pb-8">
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <Logo tamanho={30} />
            <span className="font-display text-[15px] font-extrabold tracking-wider">GIRON</span>
          </Link>
          <details className="relative">
            <summary aria-label="Sua conta" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-[13px] bg-superficie-2 font-display text-[13px] font-bold [&::-webkit-details-marker]:hidden">
              {resumo ? iniciais(resumo.nome) : ''}
            </summary>
            <div className="cartao absolute top-12 right-0 z-20 flex w-64 flex-col gap-2.5 rounded-2xl p-3 shadow-2xl shadow-black/50">
              {resumo && <span className="truncate text-sm font-bold">{resumo.nome}</span>}
              <span className="truncate text-xs text-suave">{session?.user.email}</span>
              {resumo && <Plano r={resumo} />}
              <Link to="/relatorios" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie-2 text-sm font-semibold">
                <Icone nome="relatorios" tamanho={18} />
                Relatórios
              </Link>
              <Link to="/contratos" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie-2 text-sm font-semibold">
                <Icone nome="contratos" tamanho={18} />
                Contratos
              </Link>
              <Link to="/configuracoes" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie-2 text-sm font-semibold">
                <Icone nome="ajustes" tamanho={18} />
                Configurações
              </Link>
              <button onClick={() => supabase.auth.signOut()} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-superficie-2 text-sm font-semibold">
                <Icone nome="sair" tamanho={18} />
                Sair
              </button>
            </div>
          </details>
        </div>
        {children}
      </div>

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 items-end border-t border-borda bg-tinta px-1.5 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden"
      >
        <NavLink to="/" end className={() => baixo(pathname === '/' && !noResumo)}>
          <Icone nome="inicio" tamanho={22} />
          Início
        </NavLink>
        <NavLink to="/clientes" className={({ isActive }) => baixo(isActive)}>
          <Icone nome="clientes" tamanho={22} />
          Clientes
          {!!resumo?.cadastrosPendentes && (
            <span className="absolute -top-1 right-3 flex size-4.5 items-center justify-center rounded-full bg-amanha text-[10px] font-extrabold text-sobre-amanha">
              {resumo.cadastrosPendentes > 9 ? '9+' : resumo.cadastrosPendentes}
            </span>
          )}
        </NavLink>
        <Link to="/clientes/novo" aria-label="Novo cliente" className="flex justify-center">
          <span className="verde -mt-5 flex size-12.5 items-center justify-center rounded-2xl shadow-lg shadow-marca/25">
            <Icone nome="mais" tamanho={24} />
          </span>
        </Link>
        <NavLink to="/calculadora" className={({ isActive }) => baixo(isActive)}>
          <Icone nome="calculadora" tamanho={22} />
          Calcular
        </NavLink>
        <Link to={{ pathname: '/', hash: 'resumo' }} className={baixo(noResumo)}>
          <Icone nome="relatorios" tamanho={22} />
          Resumo
        </Link>
      </nav>
    </div>
  )
}
