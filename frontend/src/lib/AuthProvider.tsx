import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { esquecerUsuario, identificarUsuario } from './analytics'
import { AuthContext } from './auth'
import { supabase } from './supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [papel, setPapel] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const usuario = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) identificarUsuario(data.session.user.id)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      if (evento === 'SIGNED_OUT') esquecerUsuario()
      else if (s) identificarUsuario(s.user.id)
      // chegou pelo link de "esqueci minha senha": vai direto criar a senha nova
      if (evento === 'PASSWORD_RECOVERY' && window.location.pathname !== '/nova-senha') window.location.replace('/nova-senha')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Papel de quem entrou (financeira ou dono do GIRON): a tela só abre depois de saber
  useEffect(() => {
    if (!usuario) {
      setPapel(null)
      return
    }
    let vivo = true
    supabase
      .from('usuarios')
      .select('papel')
      .eq('id', usuario)
      .maybeSingle()
      .then(({ data }) => vivo && setPapel(data?.papel ?? 'fomentado'))
    return () => {
      vivo = false
    }
  }, [usuario])

  return <AuthContext.Provider value={{ session, papel, carregando: carregando || (!!session && !papel) }}>{children}</AuthContext.Provider>
}
