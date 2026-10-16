import { reais } from '../lib/formatos'
import { corRecuperacao, type Recuperacao } from '../lib/recuperacao'

// Barra de Recuperação de Capital. `compacta` = versão de uma linha pra listas.
export default function BarraRecuperacao({ r, compacta = false }: { r: Recuperacao; compacta?: boolean }) {
  const cor = corRecuperacao[r.cor]
  const largura = Math.min(100, r.percentual)
  if (compacta) {
    return (
      <div className="flex items-center gap-2" title={`Recebido ${reais(r.recebido)} de ${reais(r.capital)} emprestados`}>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-superficie-2">
          <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${largura}%` }} />
        </div>
        <span className={`shrink-0 text-[11px] font-bold tabular-nums ${cor.texto}`}>{r.percentual}%</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-suave">Recebido até agora</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cor.fundo} ${cor.texto}`}>{r.texto}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-lg tabular-nums">{reais(r.recebido)}</strong>
        <span className={`text-sm font-bold tabular-nums ${cor.texto}`}>{r.percentual}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-superficie-2">
        <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${largura}%` }} />
      </div>
      <span className="text-xs text-suave">
        de {reais(r.capital)} emprestados
        {r.cor === 'risco' && ` · faltam ${reais(r.capital - r.recebido)} pra empatar`}
        {r.cor === 'lucro' && ` · ${reais(r.recebido - r.capital)} acima do emprestado`}
      </span>
    </div>
  )
}
