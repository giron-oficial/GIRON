// Classes do tema Pulso Claro usadas em várias telas (ver skill giron-frontend)

export const campo =
  'mt-1.5 w-full rounded-2xl border border-borda bg-white px-4 py-3 text-base outline-none transition placeholder:text-[#A0A6B1] focus:border-marca focus:ring-4 focus:ring-marca-clara/20'

export const rotulo = 'block text-sm font-semibold'

export const botaoVerde =
  'verde inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-bold shadow-lg shadow-marca/25 transition active:scale-[0.98] disabled:opacity-60'

export const botaoClaro =
  'cartao inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition hover:text-marca active:scale-[0.98] disabled:opacity-60'

export const botaoEscuro =
  'inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-tinta px-5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60'

export const tituloSecao = 'text-xs font-bold tracking-wider text-suave uppercase'

export const erroCaixa = 'rounded-2xl bg-[#FFE9E8] px-4 py-3 text-sm font-semibold text-[#B42318]'

// Situação do cadastro do cliente
export const seloCadastro: Record<string, { texto: string; classe: string; avatar: string }> = {
  pendente: { texto: 'Esperando aprovação', classe: 'bg-[#FFF3D1] text-[#8A5A00]', avatar: 'bg-[#FFF3D1] text-[#C27C00]' },
  aprovado: { texto: 'Aprovado', classe: 'bg-[#DDF7EA] text-marca', avatar: 'bg-[#DDF7EA] text-marca' },
  reprovado: { texto: 'Reprovado', classe: 'bg-[#FFE9E8] text-[#B42318]', avatar: 'bg-[#FFE9E8] text-[#D13438]' },
}

// Situação do contrato
export const seloContrato: Record<string, { texto: string; classe: string }> = {
  ativo: { texto: 'Ativo', classe: 'bg-[#E4EEFF] text-hoje' },
  quitado: { texto: 'Quitado', classe: 'bg-[#DDF7EA] text-marca' },
  cancelado: { texto: 'Cancelado', classe: 'bg-superficie-2 text-suave' },
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
