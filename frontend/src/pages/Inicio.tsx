import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Empresa = { nome_empresa: string; subdominio: string; status_acesso: string; teste_gratis_ate: string | null }

const statusTexto: Record<string, string> = {
  ativo: 'Em dia ✅',
  bloqueio_parcial: 'Mensalidade atrasada — só consulta ⚠️',
  bloqueio_total: 'Acesso bloqueado ⛔',
}

export default function Inicio() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase
      .from('fomentados')
      .select('nome_empresa, subdominio, status_acesso, teste_gratis_ate')
      .maybeSingle()
      .then(({ data }) => {
        setEmpresa(data)
        setCarregando(false)
      })
  }, [])

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">GIRON</h1>
          <button onClick={() => supabase.auth.signOut()} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">
            Sair
          </button>
        </header>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          {carregando ? (
            <p className="text-slate-600">Carregando…</p>
          ) : empresa ? (
            <>
              <p className="text-slate-600">Olá! 👋</p>
              <h2 className="mt-1 text-xl font-semibold">{empresa.nome_empresa}</h2>
              <p className="mt-1 text-sm text-slate-500">{empresa.subdominio}.gironga.com.br</p>
              <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                <span>Situação</span>
                <strong className="text-right">{statusTexto[empresa.status_acesso] ?? empresa.status_acesso}</strong>
              </div>
              {empresa.teste_gratis_ate && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                  <span>Teste grátis até</span>
                  <strong>{new Date(empresa.teste_gratis_ate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                </div>
              )}
              <Link to="/clientes" className="mt-6 block w-full rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
                👥 Clientes
              </Link>
              <p className="mt-4 text-sm text-slate-500">Em breve: empréstimos e painel do dia.</p>
            </>
          ) : (
            <p className="text-slate-600">Sua conta ainda não está ligada a uma empresa. Fale com o suporte do GIRON.</p>
          )}
        </section>
      </div>
    </main>
  )
}
