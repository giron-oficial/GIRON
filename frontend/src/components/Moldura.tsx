import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icone, { type NomeIcone } from './Icone'

const itens: { to: string; rotulo: string; icone: NomeIcone }[] = [
  { to: '/', rotulo: 'Início', icone: 'inicio' },
  { to: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
]

// Estrutura de todas as telas internas: menu lateral no computador, barra embaixo no celular
export default function Moldura({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh lg:flex lg:gap-5 lg:p-5"
      style={{
        backgroundImage:
          'radial-gradient(700px 420px at 10% 0%, rgb(61 220 151 / 0.13), transparent 70%), radial-gradient(600px 420px at 100% 60%, rgb(96 165 250 / 0.09), transparent 70%)',
        backgroundAttachment: 'fixed',
      }}
    >
      <aside className="vidro sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-56 shrink-0 flex-col gap-7 rounded-3xl p-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-135 from-marca to-marca-escura font-display font-bold text-sobre-marca">G</span>
          <span className="font-display text-lg font-bold tracking-wide">GIRON</span>
        </div>
        <nav aria-label="Menu principal" className="flex flex-col gap-1">
          {itens.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? 'bg-marca/15 font-semibold text-marca' : 'text-slate-600 hover:bg-superficie-2'}`
              }
            >
              <Icone nome={i.icone} />
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/clientes/novo"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-135 from-marca to-marca-escura text-sm font-bold text-sobre-marca shadow-lg shadow-marca/25"
        >
          <Icone nome="mais" tamanho={18} />
          Novo cliente
        </Link>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-suave hover:bg-superficie-2"
        >
          <Icone nome="sair" />
          Sair
        </button>
      </aside>

      <div className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</div>

      <nav
        aria-label="Menu principal"
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-10 flex h-16 items-center justify-around rounded-3xl border border-white/10 bg-[#161c28]/85 backdrop-blur-lg lg:hidden"
      >
        {itens.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            className={({ isActive }) => `flex min-w-14 flex-col items-center gap-1 text-[11px] ${isActive ? 'text-marca' : 'text-suave'}`}
          >
            <Icone nome={i.icone} tamanho={22} />
            {i.rotulo}
          </NavLink>
        ))}
        <Link
          to="/clientes/novo"
          aria-label="Novo cliente"
          className="flex size-13 items-center justify-center rounded-2xl bg-linear-135 from-marca to-marca-escura text-sobre-marca shadow-lg shadow-marca/35"
        >
          <Icone nome="mais" tamanho={24} />
        </Link>
        <button onClick={() => supabase.auth.signOut()} className="flex min-w-14 flex-col items-center gap-1 text-[11px] text-suave">
          <Icone nome="sair" tamanho={22} />
          Sair
        </button>
      </nav>
    </div>
  )
}
