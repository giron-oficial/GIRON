import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Moldura padrao das telas: topo com GIRON / voltar e Sair
export default function Tela({ titulo, voltar, children }: { titulo?: string; voltar?: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 pb-10 pt-6 text-slate-900">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between gap-2">
          {voltar ? (
            <Link to={voltar} className="-ml-2 rounded-xl px-2 py-2 text-slate-600 hover:bg-slate-200">← Voltar</Link>
          ) : (
            <span className="text-2xl font-bold">GIRON</span>
          )}
          <button onClick={() => supabase.auth.signOut()} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">
            Sair
          </button>
        </header>
        {titulo && <h1 className="mt-4 text-2xl font-bold">{titulo}</h1>}
        {children}
      </div>
    </main>
  )
}
