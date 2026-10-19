import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { botaoVerde, erroCaixa, rotulo } from '../components/estilo'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Logo } from '../components/Logo'

// Criar senha nova. Chega aqui pelo link do e-mail (já logado por esse link) ou pelo menu, logado normal.
// Sem login depois de 4 segundos = link velho ou já usado.

const caixaSenha = 'mt-1.5 flex rounded-2xl border border-borda bg-superficie-2 focus-within:border-marca focus-within:ring-4 focus-within:ring-marca/15'
const entradaSenha = 'w-full rounded-2xl bg-transparent px-4 py-3 text-base outline-none'

export default function NovaSenha() {
  const { session, carregando } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [esperou, setEsperou] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEsperou(true), 4000)
    return () => clearTimeout(t)
  }, [])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    if (senha !== confirma) return setErro('As duas senhas não são iguais.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      const m = error.message.toLowerCase()
      return setErro(m.includes('same') ? 'Essa é a sua senha atual. Escolha uma diferente.' : m.includes('weak') || m.includes('short') ? 'Senha fraca demais. Use pelo menos 8 caracteres.' : 'Não foi possível salvar a senha. Peça um link novo.')
    }
    setPronto(true)
    setTimeout(() => navegar('/', { replace: true }), 1500)
  }

  const semLogin = !carregando && !session && esperou

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(600px_380px_at_50%_0%,rgb(124_255_178/0.12),transparent_70%)] px-4">
      <form onSubmit={salvar} className="cartao w-full max-w-sm rounded-[18px] p-6">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-wider">
          <Logo tamanho={36} />
          GIRON
        </h1>
        {pronto ? (
          <p className="mt-4 rounded-2xl bg-marca/15 px-4 py-3 text-sm font-semibold text-marca">Senha salva! Entrando…</p>
        ) : semLogin ? (
          <>
            <p className="mt-4 text-lg font-bold">Este link não vale mais</p>
            <p className="mt-2 text-sm text-suave">Ele já foi usado ou passou de 1 hora. Peça um link novo.</p>
            <Link to="/esqueci-senha" className={`mt-6 w-full ${botaoVerde}`}>Pedir link novo</Link>
          </>
        ) : !session ? (
          <p className="mt-4 text-sm text-suave">Conferindo o link…</p>
        ) : (
          <>
            <p className="mt-2 text-suave">Crie sua nova senha{session.user.email ? <> pra <strong className="text-texto">{session.user.email}</strong></> : ''}.</p>
            <label className={`mt-6 ${rotulo}`} htmlFor="senha">Nova senha</label>
            <div className={caixaSenha}>
              <input id="senha" type={ver ? 'text' : 'password'} autoComplete="new-password" required minLength={8} autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} className={entradaSenha} />
              <button type="button" onClick={() => setVer(!ver)} className="px-4 text-sm font-semibold text-suave hover:text-texto">{ver ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            <label className={`mt-4 ${rotulo}`} htmlFor="confirma">Repita a senha</label>
            <div className={caixaSenha}>
              <input id="confirma" type={ver ? 'text' : 'password'} autoComplete="new-password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} className={entradaSenha} />
            </div>
            <p className="mt-2 text-xs text-suave">Pelo menos 8 caracteres. Vale misturar letras e números.</p>
            {erro && <p role="alert" className={`mt-4 ${erroCaixa}`}>{erro}</p>}
            <button type="submit" disabled={salvando} className={`mt-6 w-full ${botaoVerde}`}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
          </>
        )}
      </form>
    </main>
  )
}
