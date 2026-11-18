import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from './Icone'
import { botaoVerde, campo, erroCaixa } from './estilo'
import { dataBr, mascaraReais, numeroBr, reais, reaisCampo } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import type { Cobranca } from '../lib/painel'
import { supabase } from '../lib/supabase'

// Receber sem sair do Início (celular primeiro): sobe de baixo, um campo e um botão.
// Em branco = paga tudo que falta (parcela + multa/juro de atraso). Desconto e observação ficam em "Mais opções".
export default function ReceberRapido({ c, fechar, pronto }: { c: Cobranca; fechar: () => void; pronto: () => void }) {
  const [valor, setValor] = useState('')
  const [semMulta, setSemMulta] = useState(false)
  const [mais, setMais] = useState(false)
  const [desconto, setDesconto] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [fechar])

  const multa = semMulta ? 0 : c.multa
  const juroAtraso = semMulta ? 0 : c.juroAtraso
  const cheio = Math.round((c.valor - c.encargos + multa + juroAtraso) * 100) / 100
  const desc = desconto ? numeroBr(desconto) : 0

  async function confirmar() {
    const v = valor ? numeroBr(valor) : Math.round((cheio - desc) * 100) / 100
    if (!v || v <= 0) return setErro('Informe o valor recebido.')
    setErro(''); setSalvando(true)
    const { error } = await supabase.rpc('pagamento_registrar', {
      p_parcela_id: c.parcelaId, p_valor_pago: v,
      p_desconto: desc, p_acrescimo: 0,
      p_multa: multa, p_juro_atraso: juroAtraso,
      p_observacao: obs || null,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    rastrear('pagamento_registrado', { origem: 'inicio_rapido' })
    pronto()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receber de ${c.cliente}`}
        onClick={(e) => e.stopPropagation()}
        className="cartao flex w-full max-w-sm flex-col gap-3 rounded-t-[22px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-[18px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-bold">{c.cliente}</span>
            <span className="text-xs text-suave">Venc. {dataBr(c.vencimento)}</span>
          </div>
          <button onClick={fechar} aria-label="Fechar" className="-mt-1 -mr-1 flex size-10 items-center justify-center rounded-xl text-suave">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>

        <div className="relative">
          <input
            autoFocus
            inputMode="numeric"
            aria-label="Valor recebido"
            value={valor}
            onChange={(e) => setValor(mascaraReais(e.target.value))}
            placeholder={reaisCampo(Math.max(0, cheio - desc))}
            className={`${campo} h-14 pl-12 font-display text-2xl font-extrabold tabular-nums placeholder:text-texto/60`}
          />
          <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
        </div>
        <p className="-mt-1 text-xs text-suave">
          Em branco = recebe {reais(Math.max(0, cheio - desc))}. Pagou menos? Digite o valor.
        </p>

        {c.encargos > 0 && (
          <button
            type="button"
            onClick={() => setSemMulta(!semMulta)}
            aria-pressed={semMulta}
            className="flex items-center justify-between rounded-xl bg-superficie-2 px-3 py-2.5 text-left text-sm"
          >
            <span className={semMulta ? 'text-suave line-through' : ''}>Multa e juros {reais(c.encargos)}</span>
            <span className="text-xs font-bold text-marca">{semMulta ? 'Cobrar' : 'Tirar'}</span>
          </button>
        )}

        {mais ? (
          <div className="grid grid-cols-2 gap-2">
            <input inputMode="numeric" aria-label="Desconto" value={desconto} onChange={(e) => setDesconto(mascaraReais(e.target.value))} placeholder="Desconto R$" className={`${campo} tabular-nums`} />
            <input aria-label="Observação" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Obs. (ex.: Pix)" className={campo} />
          </div>
        ) : (
          <button type="button" onClick={() => setMais(true)} className="self-start text-xs font-semibold text-suave">+ Desconto ou observação</button>
        )}

        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}

        <button onClick={confirmar} disabled={salvando} className={`${botaoVerde} h-14 w-full text-lg`}>
          <Icone nome="certo" tamanho={20} />
          {salvando ? 'Salvando…' : 'Confirmar'}
        </button>
        <Link to={`/contratos/${c.contratoId}`} className="text-center text-xs font-semibold text-suave">Ver contrato</Link>
      </div>
    </div>
  )
}
