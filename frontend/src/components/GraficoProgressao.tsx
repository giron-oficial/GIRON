import { useEffect, useRef, useState } from 'react'
import { reais } from '../lib/formatos'
import type { Barra } from '../lib/relatorio'

// Gráfico "Progressão" dos Relatórios: em cada dia (ou mês), uma barra do que entrou
// (juros embaixo + capital em cima) e, do lado, uma barra do que foi emprestado.
// Cores validadas no fundo escuro e pra daltônico (skill dataviz). Tocar/passar o mouse mostra os valores.

export const CORES = { juros: '#1FA863', capital: '#2F80FF', emprestado: '#C27F0A' }

const ALTURA = 190
const TOPO = 20 // espaço do rótulo do valor máximo
const BASE = 22 // espaço dos rótulos de baixo

// Arredonda o topo pra um número redondo (1, 2, 2,5 ou 5 vezes 10^n)
function teto(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

// Retângulo com só os cantos de cima arredondados (ponta da barra)
function ponta(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export default function GraficoProgressao({ barras }: { barras: Barra[] }) {
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
  useEffect(() => setAtivo(null), [barras])

  const maior = Math.max(0, ...barras.map((b) => Math.max(b.juros + b.capital, b.emprestado)))
  const topo = teto(maior)
  const n = barras.length
  const faixa = largura / Math.max(1, n)
  const w = Math.max(2, Math.min(16, (faixa - 4) / 2 - 1))
  const alturaUtil = ALTURA - TOPO - BASE
  const y = (v: number) => TOPO + alturaUtil - (v / topo) * alturaUtil
  const h = (v: number) => (v / topo) * alturaUtil
  const passo = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(largura / 42))))
  const temDestaque = barras.some((b) => b.destaque)
  const b = ativo === null ? null : barras[ativo]

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-suave">
        {([['juros', 'Juros recebidos'], ['capital', 'Capital recebido'], ['emprestado', 'Emprestado']] as const).map(([k, t]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: CORES[k] }} />
            {t}
          </span>
        ))}
      </div>

      <div ref={caixa} className="relative mt-3 w-full min-w-0 select-none" style={{ minHeight: ALTURA }} onMouseLeave={() => setAtivo(null)}>
        {maior === 0 ? (
          <div className="flex items-center justify-center text-sm text-suave" style={{ height: ALTURA }}>Sem movimento nesse período.</div>
        ) : largura > 0 && (
          <svg width={largura} height={ALTURA} className="absolute top-0 left-0" role="img" aria-label="Gráfico do que entrou e do que foi emprestado em cada dia do período">
            {[0, 0.5, 1].map((f) => (
              <line key={f} x1={0} x2={largura} y1={y(topo * f)} y2={y(topo * f)} stroke="#1B2D4F" strokeWidth={1} strokeDasharray={f ? '3 4' : undefined} />
            ))}
            <text x={0} y={y(topo) - 6} fill="#8EA3C4" fontSize={10}>{reais(topo)}</text>

            {barras.map((bar, i) => {
              const cx = faixa * i + faixa / 2
              const xE = cx - w - 1
              const xS = cx + 1
              const hj = h(bar.juros)
              const hc = h(bar.capital)
              const vao = hj > 0 && hc > 0 ? 2 : 0
              const apagado = (temDestaque && !bar.destaque && ativo !== i) || (ativo !== null && ativo !== i)
              return (
                <g key={bar.ini} opacity={apagado ? 0.4 : 1}>
                  {ativo === i && <rect x={faixa * i} y={TOPO - 4} width={faixa} height={alturaUtil + 4} rx={6} fill="#0F1D36" />}
                  {hj > 0 && (hc > 0
                    ? <rect x={xE} y={y(bar.juros)} width={w} height={hj} fill={CORES.juros} />
                    : <path d={ponta(xE, y(bar.juros), w, hj)} fill={CORES.juros} />)}
                  {hc > 0 && <path d={ponta(xE, y(bar.juros) - vao - Math.max(0, hc - vao), w, Math.max(1, hc - vao))} fill={CORES.capital} />}
                  {bar.emprestado > 0 && <path d={ponta(xS, y(bar.emprestado), w, h(bar.emprestado))} fill={CORES.emprestado} />}
                  {(i % passo === 0 || bar.destaque) && (
                    <text x={cx} y={ALTURA - 6} textAnchor="middle" fontSize={10} fill={bar.destaque ? '#EEF4FF' : '#8EA3C4'} fontWeight={bar.destaque ? 700 : 400}>{bar.rotulo}</text>
                  )}
                  <rect
                    x={faixa * i} y={0} width={faixa} height={ALTURA} fill="transparent" className="cursor-pointer"
                    onMouseEnter={() => setAtivo(i)} onClick={() => setAtivo(ativo === i ? null : i)}
                  />
                </g>
              )
            })}
          </svg>
        )}

        {b && ativo !== null && (
          <div
            className="vidro pointer-events-none absolute top-0 z-10 w-[200px] rounded-2xl p-3 text-xs shadow-xl"
            style={{ left: Math.min(Math.max(0, faixa * ativo + faixa / 2 - 100), Math.max(0, largura - 200)) }}
          >
            <p className="font-bold">{b.dica}</p>
            {([['juros', 'Juros', b.juros], ['capital', 'Capital', b.capital], ['emprestado', 'Emprestado', b.emprestado]] as const).map(([k, t, v]) => (
              <p key={k} className="mt-1 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-suave"><span className="size-2 rounded-[2px]" style={{ background: CORES[k] }} />{t}</span>
                <span className="font-semibold tabular-nums">{reais(v)}</span>
              </p>
            ))}
            <p className="mt-1.5 flex justify-between gap-2 border-t border-borda pt-1.5">
              <span className="text-suave">Entrou</span>
              <span className="font-bold tabular-nums">{reais(b.juros + b.capital)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
