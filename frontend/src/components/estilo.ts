// Classes do tema visual Azul Espacial usadas em várias telas (ver skill giron-frontend)

export const campo =
  'mt-1.5 w-full rounded-2xl border border-borda bg-superficie-2 px-4 py-3 text-base outline-none transition placeholder:text-suave/70 focus:border-marca focus:ring-4 focus:ring-marca/15'

export const rotulo = 'block text-sm font-semibold'

export const botaoVerde =
  'verde inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-extrabold transition active:scale-[0.98] disabled:opacity-60'

// Botão de WhatsApp: vidro verde
export const botaoZap =
  'zap inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-extrabold transition active:scale-[0.98] disabled:opacity-60'

export const botaoClaro =
  'cartao inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition hover:text-marca active:scale-[0.98] disabled:opacity-60'

export const botaoEscuro =
  'inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-borda bg-superficie-2 px-5 font-semibold transition active:scale-[0.98] disabled:opacity-60'

export const tituloSecao = 'text-xs font-bold tracking-wider text-suave uppercase'

export const erroCaixa = 'rounded-2xl bg-vencido/15 px-4 py-3 text-sm font-semibold text-vencido'

// Situação do cadastro do cliente
export const seloCadastro: Record<string, { texto: string; classe: string; avatar: string }> = {
  pendente: { texto: 'Esperando aprovação', classe: 'bg-amanha/15 text-amanha', avatar: 'bg-amanha/15 text-amanha' },
  aprovado: { texto: 'Aprovado', classe: 'bg-marca/15 text-marca', avatar: 'bg-marca/15 text-marca' },
  reprovado: { texto: 'Reprovado', classe: 'bg-vencido/15 text-vencido', avatar: 'bg-vencido/15 text-vencido' },
}

// Situação do contrato
export const seloContrato: Record<string, { texto: string; classe: string }> = {
  ativo: { texto: 'Ativo', classe: 'bg-hoje/15 text-hoje' },
  quitado: { texto: 'Quitado', classe: 'bg-marca/15 text-marca' },
  cancelado: { texto: 'Cancelado', classe: 'bg-superficie-2 text-suave' },
  convertido: { texto: 'Convertido', classe: 'bg-hoje/15 text-hoje' },
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
