import { useEffect, useRef, useState } from 'react'
import { reais } from '../lib/formatos'
import type { PontoCapital } from '../lib/painel'

// Gráfico do cartão "Capital em trânsito": quanto tinha na rua no fim de cada mês, até hoje.
// Linha com área em degradê; tocar/passar o mouse num ponto mostra o valor.

const ALTURA = 96
const TOPO = 12
const BASE = 18 // rótulos dos meses

export default function LinhaCapital({ pontos }: { pontos: PontoCapital[] }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(0)
  const [ativo, setAtivo] = useState<number | null>(null)

  useEffect(() => {
    const el = caixa.current
    if (!el) return
    setLargura(Math.floor(el.getBoundingClientRect().width))
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const valores = pontos.map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const folga = (max - min) * 0.15 || max * 0.1 || 1
  const piso = Math.max(0, min - folga)
  const teto = max + folga
  const margem = 8
  const x = (i: number) => margem + (i * (largura - margem * 2)) / Math.max(1, pontos.length - 1)
  const y = (v: number) => TOPO + (ALTURA - TOPO - BASE) * (1 - (v - piso) / (teto - piso))
  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join('')
  const area = `${linha}L${x(pontos.length - 1)},${ALTURA - BASE}L${x(0)},${ALTURA - BASE}Z`
  const ultimo = pontos.length - 1
  const sel = ativo ?? ultimo
  const primeiro = pontos[0]?.valor ?? 0
  const variacao = primeiro >= 1 ? Math.round(((pontos[ultimo].valor - primeiro) / primeiro) * 100) : null

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-suave">Últimos 6 meses</span>
        {variacao !== null && variacao !== 0 && (
          <span className={`font-semibold ${variacao > 0 ? 'text-sucesso' : 'text-vencido'}`}>
            {variacao > 0 ? '↑' : '↓'} {Math.abs(variacao)}%
          </span>
        )}
      </div>
      <div ref={caixa} className="relative w-full min-w-0 select-none" style={{ height: ALTURA }} onMouseLeave={() => setAtivo(null)}>
        {largura > 0 && pontos.length > 1 && (
          <svg width={largura} height={ALTURA} className="absolute top-0 left-0" role="img" aria-label={`Capital na rua nos últimos meses: ${pontos.map((p) => `${p.rotulo} ${reais(p.valor)}`).join(', ')}`}>
            <defs>
              <linearGradient id="area-capital" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4CC2FF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4CC2FF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={0} x2={largura} y1={ALTURA - BASE} y2={ALTURA - BASE} stroke="#1B2D4F" strokeWidth={1} />
            <path d={area} fill="url(#area-capital)" />
            <path d={linha} fill="none" stroke="#4CC2FF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <line x1={x(sel)} x2={x(sel)} y1={y(pontos[sel].valor)} y2={ALTURA - BASE} stroke="#4CC2FF" strokeOpacity={0.35} strokeDasharray="2 3" />
            {pontos.map((p, i) => (
              <g key={p.data}>
                <circle cx={x(i)} cy={y(p.valor)} r={i === sel ? 5 : 3} fill={i === sel ? '#4CC2FF' : '#0A1426'} stroke="#4CC2FF" strokeWidth={2} />
                <text x={x(i)} y={ALTURA - 4} textAnchor={i === 0 ? 'start' : i === ultimo ? 'end' : 'middle'} fontSize={10} fill={i === sel ? '#EEF4FF' : '#8EA3C4'} fontWeight={i === sel ? 700 : 400}>
                  {p.rotulo}
                </text>
                <rect
                  x={x(i) - (largura / pontos.length) / 2} y={0} width={largura / pontos.length} height={ALTURA} fill="transparent" className="cursor-pointer"
                  onMouseEnter={() => setAtivo(i)} onClick={() => setAtivo(ativo === i ? null : i)}
                />
              </g>
            ))}
          </svg>
        )}
        {ativo !== null && (
          <div
            className="vidro pointer-events-none absolute -top-1 z-10 rounded-xl px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-xl"
            style={{ left: Math.min(Math.max(0, x(ativo) - 60), Math.max(0, largura - 120)) }}
          >
            <span className="text-suave">{ativo === ultimo ? 'Hoje' : `Fim de ${pontos[ativo].rotulo}`} · </span>
            <span className="font-bold tabular-nums">{reais(pontos[ativo].valor)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
