import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { erroEmPortugues, useAuth } from '../lib/auth'
import { botaoVerde, campo, erroCaixa, rotulo } from '../components/estilo'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

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
    if (error) return setErro(erroEmPortugues(error.message))
    rastrear('login_ok')
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(600px_380px_at_50%_0%,rgb(47_128_255/0.12),transparent_70%)] px-4">
      <form onSubmit={entrar} className="cartao w-full max-w-sm rounded-[18px] p-6">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-wider">
          <Logo tamanho={36} />
          GIRON
        </h1>
        <p className="mt-2 text-suave">Entre na sua conta</p>

        <label className={`mt-6 ${rotulo}`} htmlFor="email">E-mail</label>
        <input
          id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
          value={email} onChange={(e) => setEmail(e.target.value)}
          className={campo}
        />

        <label className={`mt-4 ${rotulo}`} htmlFor="senha">Senha</label>
        <div className="mt-1.5 flex rounded-2xl border border-borda bg-superficie-2 focus-within:border-marca focus-within:ring-4 focus-within:ring-marca/15">
          <input
            id="senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
            value={senha} onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-2xl bg-transparent px-4 py-3 text-base outline-none"
          />
          <button type="button" onClick={() => setVerSenha(!verSenha)} className="px-4 text-sm font-semibold text-suave hover:text-texto">
            {verSenha ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {erro && <p role="alert" className={`mt-4 ${erroCaixa}`}>{erro}</p>}

        <button
          type="submit" disabled={enviando}
          className={`mt-6 w-full ${botaoVerde}`}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <Link to="/esqueci-senha" className="mt-4 block text-center text-sm font-semibold text-suave hover:text-texto">Esqueci minha senha</Link>
      </form>
    </main>
  )
}
