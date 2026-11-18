import { useEffect, useState } from 'react'
import Icone from './Icone'
import { botaoVerde, campo, erroCaixa } from './estilo'
import { mascaraReais, numeroBr, reais, tipoEmprestimo } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import type { Cobranca } from '../lib/painel'
import { supabase } from '../lib/supabase'

const r2 = (v: number) => Math.round(v * 100) / 100

// Receber sem sair do Início (celular): mostra o TOTAL, um campo "Recebeu" e Confirmar.
// Recebeu menos que o total? A diferença sai primeiro da multa/juro de atraso (desconto);
// o que passar disso fica devendo na parcela.
export default function ReceberRapido({ c, fechar, pronto }: { c: Cobranca; fechar: () => void; pronto: () => void }) {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [fechar])

  const total = r2(c.valor)
  const parcela = r2(c.valor - c.encargos)
  const recebeu = valor ? numeroBr(valor) : total
  const falta = Math.max(0, r2(total - recebeu))
  const desconto = Math.min(falta, c.encargos) // perdoa da multa/juro de atraso
  const devendo = r2(falta - desconto)
  // tira o desconto primeiro do juro de atraso, depois da multa
  const juroAtraso = r2(Math.max(0, c.juroAtraso - desconto))
  const multa = r2(Math.max(0, c.multa - Math.max(0, desconto - c.juroAtraso)))

  async function confirmar() {
    if (!recebeu || recebeu <= 0) return setErro('Informe quanto recebeu.')
    if (recebeu > total + 0.01) return setErro(`O máximo é ${reais(total)}.`)
    setErro(''); setSalvando(true)
    const { error } = await supabase.rpc('pagamento_registrar', {
      p_parcela_id: c.parcelaId, p_valor_pago: recebeu,
      p_desconto: 0, p_acrescimo: 0,
      p_multa: multa, p_juro_atraso: juroAtraso,
      p_observacao: desconto > 0 ? `Desconto de ${reais(desconto)} na multa/juros` : null,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    rastrear('pagamento_registrado', { origem: 'inicio_rapido' })
    pronto()
  }

  const tipo = tipoEmprestimo(c.modalidade)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receber de ${c.cliente}`}
        onClick={(e) => e.stopPropagation()}
        className="cartao flex w-full max-w-sm flex-col gap-3 rounded-t-[22px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-[18px]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-bold">{c.cliente}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tipo.classe}`}>{tipo.texto}</span>
          <button onClick={fechar} aria-label="Fechar" className="-mr-2 ml-auto flex size-10 shrink-0 items-center justify-center rounded-xl text-suave">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>

        <div className="flex items-end justify-between">
          <span className="text-sm text-suave">Total</span>
          <span className="font-display text-3xl font-extrabold tabular-nums">{reais(total)}</span>
        </div>
        {c.encargos > 0 && (
          <p className="-mt-2 text-right text-xs text-suave tabular-nums">{reais(parcela)} + multa {reais(c.encargos)}</p>
        )}

        <div className="relative">
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Quanto recebeu"
            value={valor}
            onChange={(e) => setValor(mascaraReais(e.target.value))}
            placeholder={`Recebeu? (${reais(total).replace('R$', '').trim()})`}
            className={`${campo} h-14 pl-12 text-xl font-bold tabular-nums`}
          />
          <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
        </div>

        {desconto > 0 && <p className="-mt-1 text-sm font-semibold text-sucesso">Desconto de {reais(desconto)} na multa</p>}
        {devendo > 0 && <p className="-mt-1 text-sm font-semibold text-amanha">Fica devendo {reais(devendo)}</p>}
        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}

        <button onClick={confirmar} disabled={salvando} className={`${botaoVerde} h-14 w-full text-lg`}>
          <Icone nome="certo" tamanho={20} />
          {salvando ? 'Salvando…' : `Confirmar ${reais(recebeu)}`}
        </button>
      </div>
    </div>
  )
}
