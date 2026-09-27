import { useEffect, useState } from 'react'
import { anonKey, supabaseUrl } from '../lib/supabase'

type Situacao = 'conferindo' | 'ok' | 'erro'

export default function Status() {
  const [banco, setBanco] = useState<Situacao>('conferindo')

  useEffect(() => {
    fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey } })
      .then((r) => setBanco(r.ok ? 'ok' : 'erro'))
      .catch(() => setBanco('erro'))
  }, [])

  const texto = { conferindo: 'Conferindo…', ok: 'Conectado ✅', erro: 'Sem conexão ❌' }[banco]

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">GIRON</h1>
        <p className="mt-1 text-slate-600">Gestão e Automação — em construção</p>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
          <span>Banco de dados</span>
          <strong>{texto}</strong>
        </div>
      </div>
    </main>
  )
}
