import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { botaoVerde, campo, erroCaixa, rotulo } from '../components/estilo'
import { erroEmPortugues } from '../lib/auth'
import { supabase } from '../lib/supabase'

// "Esqueci minha senha": o dono digita o e-mail e recebe um link. O link volta pro site já logado e
// o AuthProvider manda pra /nova-senha. Sempre mostramos a mesma mensagem (com conta ou sem), pra ninguém
// descobrir quais e-mails têm conta.

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/nova-senha` })
    setEnviando(false)
    if (error) return setErro(erroEmPortugues(error.message))
    setEnviado(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(600px_380px_at_50%_0%,rgb(124_255_178/0.12),transparent_70%)] px-4">
      <form onSubmit={enviar} className="cartao w-full max-w-sm rounded-[18px] p-6">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-wider">
          <span className="verde flex size-9 items-center justify-center rounded-xl text-base">G</span>
          GIRON
        </h1>
        {enviado ? (
          <>
            <p className="mt-4 text-lg font-bold">Confira seu e-mail</p>
            <p className="mt-2 text-sm text-suave">Se <strong className="text-texto">{email.trim()}</strong> tiver conta no GIRON, chegou um link pra criar uma senha nova. Vale por 1 hora. Olhe também o spam.</p>
            <Link to="/login" className={`mt-6 w-full ${botaoVerde}`}>Voltar pro login</Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-suave">Esqueceu a senha? Digite seu e-mail e a gente manda um link pra criar outra.</p>
            <label className={`mt-6 ${rotulo}`} htmlFor="email">E-mail</label>
            <input
              id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)} className={campo}
            />
            {erro && <p role="alert" className={`mt-4 ${erroCaixa}`}>{erro}</p>}
            <button type="submit" disabled={enviando} className={`mt-6 w-full ${botaoVerde}`}>
              {enviando ? 'Enviando…' : 'Enviar link'}
            </button>
            <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-suave hover:text-texto">Voltar pro login</Link>
          </>
        )}
      </form>
    </main>
  )
}
