import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icone, { type NomeIcone } from './Icone'

const itens: { to: string; rotulo: string; icone: NomeIcone }[] = [
  { to: '/', rotulo: 'Início', icone: 'inicio' },
  { to: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
]

// Estrutura de todas as telas internas: menu lateral preto no computador, barra preta flutuante no celular
export default function Moldura({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh lg:flex lg:gap-5 lg:p-5"
      style={{
        backgroundImage: 'radial-gradient(700px 380px at 15% 0%, #D3F5E4, transparent 70%), radial-gradient(600px 380px at 100% 0%, #E7E1FF, transparent 70%)',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-56 shrink-0 flex-col gap-7 rounded-3xl bg-tinta p-4 text-white shadow-xl shadow-black/15 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="verde flex size-9 items-center justify-center rounded-xl font-display font-extrabold">G</span>
          <span className="font-display text-lg font-bold tracking-wider">GIRON</span>
        </div>
        <nav aria-label="Menu principal" className="flex flex-col gap-1">
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
            </NavLink>
          ))}
        </nav>
        <Link to="/clientes/novo" className="verde flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-lg shadow-marca-clara/30">
          <Icone nome="mais" tamanho={18} />
          Novo cliente
        </Link>
        <button onClick={() => supabase.auth.signOut()} className="mt-auto flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-[#9AA1AD] hover:bg-white/5">
          <Icone nome="sair" />
          Sair
        </button>
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
            className={({ isActive }) => `flex min-w-14 flex-col items-center gap-1 text-[11px] ${isActive ? 'font-bold text-marca-brilho' : 'text-[#9AA1AD]'}`}
          >
            <Icone nome={i.icone} tamanho={22} />
            {i.rotulo}
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
