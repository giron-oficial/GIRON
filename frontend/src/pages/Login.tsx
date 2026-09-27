import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { erroEmPortugues, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha.trim() })
    setEnviando(false)
    if (error) setErro(erroEmPortugues(error.message))
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-slate-900">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">GIRON</h1>
        <p className="mt-1 text-slate-600">Entre na sua conta</p>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">E-mail</label>
        <input
          id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-900"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="senha">Senha</label>
        <div className="mt-1 flex rounded-xl border border-slate-300 focus-within:border-slate-900">
          <input
            id="senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
            value={senha} onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base outline-none"
          />
          <button type="button" onClick={() => setVerSenha(!verSenha)} className="px-4 text-sm text-slate-600">
            {verSenha ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

        <button
          type="submit" disabled={enviando}
          className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
