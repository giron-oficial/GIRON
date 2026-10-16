import type { ReactNode } from 'react'
import Icone, { type NomeIcone } from './Icone'

// Peças da tela de Configurações (estilo "ajustes do celular"): grupo com ícone + linhas com o controle à direita.

export function Grupo({ icone, titulo, descricao, children, cor = 'text-marca bg-marca/15' }: { icone: NomeIcone; titulo: string; descricao?: string; children: ReactNode; cor?: string }) {
  return (
    <section className="cartao overflow-hidden rounded-[18px]">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 lg:px-5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${cor}`}>
          <Icone nome={icone} tamanho={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold">{titulo}</h2>
          {descricao && <p className="text-xs text-suave">{descricao}</p>}
        </div>
      </header>
      <div className="divide-y divide-borda border-t border-borda">{children}</div>
    </section>
  )
}

export function Linha({ titulo, dica, children, htmlFor, empilha }: { titulo: string; dica?: ReactNode; children?: ReactNode; htmlFor?: string; empilha?: boolean }) {
  const Rotulo = htmlFor ? 'label' : 'div'
  return (
    <div className={`px-4 py-3.5 lg:px-5 ${empilha ? 'flex flex-col gap-3' : 'flex items-center justify-between gap-4'}`}>
      <Rotulo htmlFor={htmlFor} className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{titulo}</span>
        {dica && <span className="mt-0.5 block text-xs leading-snug text-suave">{dica}</span>}
      </Rotulo>
      {children && <div className={empilha ? '' : 'shrink-0'}>{children}</div>}
    </div>
  )
}

// Campo pequeno, alinhado à direita, com "R$" ou "%" grudado
export function CampoMini({ id, valor, onChange, prefixo, sufixo, placeholder, inputMode = 'numeric', largura = 'w-32' }: {
  id: string; valor: string; onChange: (v: string) => void; prefixo?: string; sufixo?: string; placeholder?: string; inputMode?: 'numeric' | 'decimal'; largura?: string
}) {
  return (
    <div className={`flex h-11 items-center rounded-xl border border-borda bg-superficie-2 px-3 transition focus-within:border-marca focus-within:ring-4 focus-within:ring-marca/15 ${largura}`}>
      {prefixo && <span className="mr-1 text-sm font-semibold text-suave">{prefixo}</span>}
      <input id={id} inputMode={inputMode} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-right text-base font-bold tabular-nums outline-none placeholder:font-semibold placeholder:text-suave/60" />
      {sufixo && <span className="ml-1 text-sm font-semibold text-suave">{sufixo}</span>}
    </div>
  )
}

// Mais / menos pra números pequenos (dias)
export function Passos({ valor, onChange, min, max, sufixo }: { valor: number; onChange: (v: number) => void; min: number; max: number; sufixo?: string }) {
  const b = 'flex size-11 items-center justify-center rounded-xl bg-superficie-2 text-texto transition active:scale-95 disabled:opacity-30'
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Menos" disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - 1))} className={b}><Icone nome="menos" tamanho={18} /></button>
      <span className="w-16 text-center text-lg font-extrabold tabular-nums">{valor}{sufixo && <span className="ml-1 text-xs font-semibold text-suave">{sufixo}</span>}</span>
      <button type="button" aria-label="Mais" disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + 1))} className={b}><Icone nome="mais" tamanho={18} /></button>
    </div>
  )
}

export function Segmentos<T extends string>({ valor, onChange, opcoes }: { valor: T; onChange: (v: T) => void; opcoes: [T, string][] }) {
  return (
    <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-superficie-2 p-1">
      {opcoes.map(([v, t]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={valor === v}
          className={`h-10 rounded-lg text-[13px] font-semibold transition ${valor === v ? 'bg-superficie text-marca shadow-sm' : 'text-suave'}`}>
          {t}
        </button>
      ))}
    </div>
  )
}
