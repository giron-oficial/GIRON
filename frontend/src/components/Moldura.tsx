import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { carregarBarra, resumoGuardado, type ResumoBarra } from '../lib/barra'
import { supabase } from '../lib/supabase'
import Icone, { type NomeIcone } from './Icone'

const itens: { to: string; rotulo: string; icone: NomeIcone }[] = [
  { to: '/', rotulo: 'Início', icone: 'inicio' },
  { to: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
]

const emBreve: { rotulo: string; icone: NomeIcone }[] = [
  { rotulo: 'Contratos', icone: 'contratos' },
  { rotulo: 'Relatórios', icone: 'relatorios' },
  { rotulo: 'Configurações', icone: 'ajustes' },
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
        <span className="text-xs font-bold text-[#FF8A7A]">{r.statusAcesso === 'bloqueio_total' ? 'Acesso bloqueado' : 'Mensalidade atrasada'}</span>
        <span className="text-xs text-[#B7BDC8]">Fale com o suporte do GIRON</span>
      </div>
    )
  }
  if (r.testeGratisAte) {
    const faltam = r.testeFaltam
    const usado = Math.min(100, Math.round(((TESTE_DIAS - faltam) / TESTE_DIAS) * 100))
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-white/6 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[#9AA1AD]">Teste grátis</span>
          <span className="text-sm font-bold">{faltam === 0 ? 'Termina hoje' : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca-brilho" style={{ width: `${usado}%` }} />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/6 p-3.5 text-sm font-bold">
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

// Estrutura de todas as telas internas: menu lateral preto no computador, barra preta flutuante no celular
export default function Moldura({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [resumo, setResumo] = useState<ResumoBarra | null>(resumoGuardado)

  useEffect(() => {
    carregarBarra()
      .then(setResumo)
      .catch(() => {})
  }, [])

  const contadores: Record<string, ReactNode> = {
    '/': <Contador n={resumo?.cobrarAteHoje ?? 0} cor="bg-vencido text-white" titulo="Cobranças atrasadas ou de hoje" />,
    '/clientes': resumo?.cadastrosPendentes ? (
      <Contador n={resumo.cadastrosPendentes} cor="bg-amanha text-sobre-amanha" titulo="Cadastros esperando aprovação" />
    ) : (
      <span className="ml-auto text-xs text-[#6F7682]">{resumo?.clientes || ''}</span>
    ),
  }

  return (
    <div
      className="min-h-dvh lg:flex lg:gap-5 lg:p-5"
      style={{
        backgroundImage: 'radial-gradient(700px 380px at 15% 0%, #D3F5E4, transparent 70%), radial-gradient(600px 380px at 100% 0%, #E7E1FF, transparent 70%)',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-60 shrink-0 flex-col gap-5 overflow-y-auto rounded-3xl bg-tinta p-4 text-white shadow-xl shadow-black/15 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pt-1">
          <span className="verde flex size-9 items-center justify-center rounded-xl font-display font-extrabold">G</span>
          <span className="font-display text-lg font-bold tracking-wider">GIRON</span>
        </div>

        {resumo && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/6 p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white font-display text-sm font-bold text-tinta">{iniciais(resumo.nome)}</span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold">{resumo.nome}</span>
              <span className="flex items-center gap-1 truncate text-[11px] text-[#9AA1AD]">
                <Icone nome="globo" tamanho={12} />
                {resumo.subdominio}.gironga.com.br
              </span>
            </div>
          </div>
        )}

        <nav aria-label="Menu principal" className="flex flex-col gap-1">
          <span className="px-3 pb-1 text-[10px] font-bold tracking-widest text-[#6F7682] uppercase">Menu</span>
          {itens.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? 'bg-marca-brilho/15 font-bold text-marca-brilho' : 'text-[#B7BDC8] hover:bg-white/5'}`
              }
            >
              <Icone nome={i.icone} />
              {i.rotulo}
              {contadores[i.to]}
            </NavLink>
          ))}
          <span className="px-3 pt-3 pb-1 text-[10px] font-bold tracking-widest text-[#6F7682] uppercase">Em breve</span>
          {emBreve.map((i) => (
            <span key={i.rotulo} aria-disabled="true" className="flex h-10 cursor-default items-center gap-3 rounded-xl px-3 text-sm text-[#6F7682]">
              <Icone nome={i.icone} />
              {i.rotulo}
            </span>
          ))}
        </nav>

        <Link to="/clientes/novo" className="verde flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-lg shadow-marca-clara/30">
          <Icone nome="mais" tamanho={18} />
          Novo cliente
        </Link>

        <div className="mt-auto flex flex-col gap-2">
          {resumo && <Plano r={resumo} />}
          <div className="flex items-center gap-2 rounded-xl px-2 py-1">
            <span className="min-w-0 flex-1 truncate text-[11px] text-[#9AA1AD]">{session?.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#B7BDC8] hover:bg-white/5"
            >
              <Icone nome="sair" tamanho={16} />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</div>

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-4 bottom-[calc(0.875rem+env(safe-area-inset-bottom,0px))] z-10 flex h-16 items-center justify-around rounded-3xl bg-tinta shadow-2xl shadow-black/25 lg:hidden"
      >
        {itens.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            className={({ isActive }) => `relative flex min-w-14 flex-col items-center gap-1 text-[11px] ${isActive ? 'font-bold text-marca-brilho' : 'text-[#9AA1AD]'}`}
          >
            <Icone nome={i.icone} tamanho={22} />
            {i.rotulo}
            {i.to === '/clientes' && !!resumo?.cadastrosPendentes && (
              <span className="absolute -top-1 right-2 flex size-4.5 items-center justify-center rounded-full bg-amanha text-[10px] font-extrabold text-sobre-amanha">
                {resumo.cadastrosPendentes > 9 ? '9+' : resumo.cadastrosPendentes}
              </span>
            )}
          </NavLink>
        ))}
        <Link to="/clientes/novo" aria-label="Novo cliente" className="verde flex size-12.5 items-center justify-center rounded-2xl shadow-lg shadow-marca-clara/40">
          <Icone nome="mais" tamanho={24} />
        </Link>
        <button onClick={() => supabase.auth.signOut()} className="flex min-w-14 flex-col items-center gap-1 text-[11px] text-[#9AA1AD]">
          <Icone nome="sair" tamanho={22} />
          Sair
        </button>
      </nav>
    </div>
  )
}
