import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type Auth = { session: Session | null; carregando: boolean }
export const AuthContext = createContext<Auth>({ session: null, carregando: true })
export const useAuth = () => useContext(AuthContext)

// Mensagens de erro do login em portugues simples
export function erroEmPortugues(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha errados.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão. Confira sua internet.'
  return 'Não foi possível entrar. Tente de novo.'
}
