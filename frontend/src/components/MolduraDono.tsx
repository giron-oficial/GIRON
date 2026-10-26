import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import FogoAzul from './FogoAzul'
import Icone from './Icone'
import { Logo } from './Logo'

// Estrutura das telas do dono do GIRON: o mesmo menu lateral (computador) e barra do topo (celular)
// das financeiras, mas só com o Painel do Dono
export default function MolduraDono({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const sair = () => supabase.auth.signOut()

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 isolate hidden h-dvh w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-borda px-3.5 py-5 lg:flex">
        <FogoAzul />
        <div className="flex items-center gap-2.5 px-2">
          <Logo tamanho={32} />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-extrabold tracking-wider">GIRON</span>
            <span className="text-[11px] text-suave">Painel do Dono</span>
          </span>
        </div>

        <nav aria-label="Menu do dono" className="flex flex-col gap-0.5">
          <NavLink
            to="/dono"
            className={({ isActive }) =>
              `flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${isActive ? 'vidro-menu font-bold text-marca-brilho' : 'border border-transparent font-medium text-suave hover:bg-white/5 hover:text-texto'}`
            }
          >
            <Icone nome="inicio" />
            Financeiras
          </NavLink>
        </nav>

        <div className="mt-auto vidro-menu flex items-center gap-2 rounded-xl py-0.5 pr-0.5 pl-2.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-texto/80">{session?.user.email}</span>
          <button onClick={sair} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-suave hover:bg-superficie-2 hover:text-texto">
            <Icone nome="sair" tamanho={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-10 lg:px-7 lg:py-6 lg:pb-8">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 lg:hidden">
          <Link to="/dono" className="flex shrink-0 items-center gap-2">
            <Logo tamanho={30} />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-[15px] font-extrabold tracking-wider">GIRON</span>
              <span className="text-[10px] text-suave">Painel do Dono</span>
            </span>
          </Link>
          <button onClick={sair} className="flex h-11 items-center gap-1.5 rounded-xl bg-superficie-2 px-3.5 text-sm font-semibold text-suave">
            <Icone nome="sair" tamanho={16} />
            Sair
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
