import { useEffect, useState } from 'react'
import Icone from './Icone'
import { botaoVerde, campo, erroCaixa } from './estilo'
import { mascaraReais, numeroBr, reais, tipoEmprestimo } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import type { Cobranca } from '../lib/painel'
import { supabase } from '../lib/supabase'

const r2 = (v: number) => Math.round(v * 100) / 100
const corAtraso: Record<Cobranca['situacao'], string> = {
  critico: 'bg-critico/15 text-critico', vencido: 'bg-vencido/15 text-vencido', hoje: 'bg-hoje/15 text-hoje', amanha: 'bg-amanha/15 text-amanha',
}

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

  const itens = c.itens ?? [c] // parcelas em aberto do contrato, da mais velha pra mais nova
  const total = r2(c.valor)
  const parcela = r2(c.valor - c.encargos)
  const recebeu = valor ? numeroBr(valor) : parcela // padrão: valor normal (sem multa)
  const falta = Math.max(0, r2(total - recebeu))
  const desconto = Math.min(falta, c.encargos) // perdoa da multa/juro de atraso
  const devendo = r2(falta - desconto)

  // Plano: tira o desconto da multa/juro (da parcela mais velha pra frente); depois o valor recebido
  // paga as parcelas na ordem. O que não couber fica como pagamento parcial na última tocada.
  function plano() {
    let sobraDesc = desconto
    let sobra = recebeu
    const passos: { id: string; valor: number; multa: number; juro: number }[] = []
    for (const it of itens) {
      const tiraJuro = Math.min(sobraDesc, it.juroAtraso); sobraDesc = r2(sobraDesc - tiraJuro)
      const tiraMulta = Math.min(sobraDesc, it.multa); sobraDesc = r2(sobraDesc - tiraMulta)
      const juro = r2(it.juroAtraso - tiraJuro)
      const multa = r2(it.multa - tiraMulta)
      const precisa = r2(it.valor - it.encargos + juro + multa)
      if (sobra <= 0.004) break
      const paga = r2(Math.min(sobra, precisa))
      passos.push({ id: it.parcelaId, valor: paga, multa, juro })
      sobra = r2(sobra - paga)
    }
    return passos
  }

  async function confirmar() {
    if (!recebeu || recebeu <= 0) return setErro('Informe quanto recebeu.')
    if (recebeu > total + 0.01) return setErro(`O máximo é ${reais(total)}.`)
    setErro(''); setSalvando(true)
    const obs = desconto > 0 ? `Desconto de ${reais(desconto)} na multa/juros` : null
    let feitos = 0
    for (const passo of plano()) {
      const { error } = await supabase.rpc('pagamento_registrar', {
        p_parcela_id: passo.id, p_valor_pago: passo.valor,
        p_desconto: 0, p_acrescimo: 0,
        p_multa: passo.multa, p_juro_atraso: passo.juro,
        p_observacao: feitos === 0 ? obs : null,
      })
      if (error) {
        setSalvando(false)
        return setErro(feitos > 0 ? `${feitos} parcela(s) baixada(s). Na próxima deu erro: ${error.message}` : error.message)
      }
      feitos++
    }
    setSalvando(false)
    rastrear('pagamento_registrado', { origem: 'inicio_rapido', parcelas: feitos })
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
          <button onClick={fechar} aria-label="Fechar" className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-xl text-suave">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>

        <div className="-mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tipo.classe}`}>
            {c.modalidade === 'recorrente'
              ? 'Recorrente · só juros'
              : itens.length > 1
                ? `Parcelado · ${itens.length} parcelas`
                : `Parcelado · ${c.numeroParcela}${c.totalParcelas ? ` de ${c.totalParcelas}` : 'ª'}`}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${corAtraso[c.situacao]}`}>
            {c.atraso > 0 ? `${c.atraso} ${c.atraso === 1 ? 'dia' : 'dias'} de atraso` : c.atraso === 0 ? 'Vence hoje' : 'Vence amanhã'}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl bg-superficie-2 p-3 text-sm tabular-nums">
          <div className="flex justify-between"><span className="text-suave">{c.modalidade === 'recorrente' ? 'Juros do mês' : 'Valor normal'}</span><span className="font-semibold">{reais(parcela)}</span></div>
          {c.encargos > 0 && (
            <div className="flex justify-between"><span className="text-suave">Multa e juros de atraso</span><span className="font-semibold text-vencido">+ {reais(c.encargos)}</span></div>
          )}
          <div className="mt-1 flex items-end justify-between border-t border-borda pt-2">
            <span className="text-suave">Total</span>
            <span className="font-display text-2xl font-extrabold">{reais(total)}</span>
          </div>
        </div>

        <div className="relative">
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Quanto recebeu"
            value={valor}
            onChange={(e) => setValor(mascaraReais(e.target.value))}
            placeholder={reais(parcela).replace('R$', '').trim()}
            className={`${campo} h-14 pl-12 text-xl font-bold tabular-nums`}
          />
          <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
        </div>

        {c.encargos > 0 && (
          <div className="-mt-1 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setValor('')} className={`h-10 rounded-xl text-sm font-bold ${!valor ? 'bg-marca/25 text-[#9CC3FF]' : 'bg-superficie-2 text-suave'}`}>
              Normal {reais(parcela)}
            </button>
            <button type="button" onClick={() => setValor(mascaraReais(total.toFixed(2).replace('.', '')))} className={`h-10 rounded-xl text-sm font-bold ${valor && Math.abs(recebeu - total) < 0.01 ? 'bg-vencido/20 text-vencido' : 'bg-superficie-2 text-suave'}`}>
              Com multa {reais(total)}
            </button>
          </div>
        )}
        {desconto > 0 && <p className="-mt-1 text-sm font-semibold text-sucesso">{desconto >= c.encargos ? 'Sem multa e juros de atraso' : `Desconto de ${reais(desconto)} na multa`}</p>}
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
