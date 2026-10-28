import type { ReactNode } from 'react'

// Cartão da faixa do mês no Início (pedido de clientes, 28/10/2026), nas cores do tema: vidro, número branco, destaque azul
export default function CartaoMes({ rotulo, valor, sub, barra, destaque, className = '' }: { rotulo: string; valor: string; sub: string; barra?: number; destaque?: ReactNode; className?: string }) {
  return (
    <div className={`vidro @container flex min-w-0 flex-col gap-1 rounded-[18px] p-4 ${className}`}>
      <span className="truncate text-[11px] tracking-[0.12em] text-suave uppercase">{rotulo}</span>
      <span className="truncate font-display text-[clamp(22px,13cqi,30px)] leading-tight font-extrabold tabular-nums">{valor}</span>
      <span className="text-xs text-suave">{sub}</span>
      {barra !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-2">
          <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${barra}%` }} />
        </div>
      )}
      {destaque && <span className="mt-1 text-[13px] font-semibold text-marca-brilho">{destaque}</span>}
    </div>
  )
}
