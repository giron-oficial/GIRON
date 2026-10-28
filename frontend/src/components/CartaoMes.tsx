import type { ReactNode } from 'react'

// Cartão da faixa do mês (pedido de clientes, 28/10/2026): borda e fundo na cor do assunto
const coresMes = {
  roxo: { cartao: 'border-critico/45 from-critico/12', valor: 'text-[#C7AEFF]', destaque: 'text-[#D8C7FF]' },
  azul: { cartao: 'border-marca-clara/40 from-marca-clara/10', valor: 'text-marca-clara', destaque: 'text-marca-clara' },
  verdeAgua: { cartao: 'border-[#2EE6D6]/35 from-[#2EE6D6]/8', valor: 'text-[#5FF2E2]', destaque: 'text-[#5FF2E2]' },
  verde: { cartao: 'border-sucesso/40 from-sucesso/10', valor: 'text-sucesso', destaque: 'text-sucesso' },
  amarelo: { cartao: 'border-amanha/45 from-amanha/12', valor: 'text-amanha', destaque: 'text-amanha' },
}

export default function CartaoMes({ rotulo, valor, sub, cor, barra, destaque, className = '' }: { rotulo: string; valor: string; sub: string; cor: keyof typeof coresMes; barra?: number; destaque?: ReactNode; className?: string }) {
  const c = coresMes[cor]
  return (
    <div className={`@container flex min-w-0 flex-col gap-1 rounded-[18px] border bg-linear-160 to-superficie/40 p-4 ${c.cartao} ${className}`}>
      <span className="truncate text-[11px] tracking-[0.12em] text-suave uppercase">{rotulo}</span>
      <span className={`truncate font-display text-[clamp(22px,13cqi,30px)] leading-tight font-extrabold tabular-nums ${c.valor}`}>{valor}</span>
      <span className="text-xs text-suave">{sub}</span>
      {barra !== undefined && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-superficie-2">
          <div className="h-full rounded-full bg-sucesso" style={{ width: `${barra}%` }} />
        </div>
      )}
      {destaque && <span className={`mt-1 text-[13px] font-semibold ${c.destaque}`}>{destaque}</span>}
    </div>
  )
}
