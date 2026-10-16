// Barra de Recuperação de Capital (regra 5.2 da especificação): tudo que o cliente já pagou
// (juro + capital + multa + juro de atraso, sem os estornados) comparado ao que foi emprestado.
// Vermelho = ainda falta voltar o que saiu (em risco); azul = empatou; verde = já deu lucro.

export type Recuperacao = {
  recebido: number
  capital: number
  percentual: number // 0–200+ (100 = empatou)
  cor: 'risco' | 'empate' | 'lucro'
  texto: string
}

export function recuperacao(capital: number, pagamentos: { valor_pago: number; estornado_em: string | null }[]): Recuperacao {
  const recebido = pagamentos.filter((p) => !p.estornado_em).reduce((t, p) => t + Number(p.valor_pago), 0)
  const cap = Number(capital)
  const percentual = cap > 0 ? Math.round((recebido / cap) * 100) : 0
  const dif = Math.round((recebido - cap) * 100) / 100
  const cor = dif < 0 ? 'risco' : dif === 0 ? 'empate' : 'lucro'
  const texto = cor === 'risco' ? 'ainda em risco' : cor === 'empate' ? 'empatou' : 'já deu lucro'
  return { recebido, capital: cap, percentual, cor, texto }
}

export const corRecuperacao: Record<Recuperacao['cor'], { barra: string; texto: string; fundo: string }> = {
  risco: { barra: 'bg-vencido', texto: 'text-vencido', fundo: 'bg-vencido/15' },
  empate: { barra: 'bg-hoje', texto: 'text-hoje', fundo: 'bg-hoje/15' },
  lucro: { barra: 'bg-marca', texto: 'text-marca', fundo: 'bg-marca/15' },
}
