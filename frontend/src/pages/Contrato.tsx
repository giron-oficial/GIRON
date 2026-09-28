import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { dataBr, nomeModalidade, nomeSistema, numeroBr, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Parcela = { id: string; numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number; status: string }
type ContratoT = {
  id: string; numero: number; modalidade: string; sistema_calculo: string | null; capital: number; juro_percentual: number
  juro_valor: number; quantidade_parcelas: number | null; data_contrato: string; status: string; capital_em_aberto: number
  cliente_id: string; clientes: { nome_completo: string } | null; parcelas: Parcela[]
}

const seloParcela: Record<string, string> = { aberta: '⚪ aberta', paga: '✅ paga', parcial: '🟡🟢 parcial' }
const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-900'

export default function Contrato() {
  const { id } = useParams()
  const [c, setC] = useState<ContratoT | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [pagando, setPagando] = useState<Parcela | null>(null)
  const [valorPago, setValorPago] = useState('')
  const [desconto, setDesconto] = useState('')
  const [acrescimo, setAcrescimo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [erroPag, setErroPag] = useState('')
  const [salvandoPag, setSalvandoPag] = useState(false)

  function carregar() {
    return supabase
      .from('contratos')
      .select(`id, numero, modalidade, sistema_calculo, capital, juro_percentual, juro_valor, quantidade_parcelas, data_contrato,
               status, capital_em_aberto, cliente_id, clientes(nome_completo), parcelas(id, numero, vencimento, valor, parte_juro, parte_capital, status)`)
      .eq('id', id!)
      .order('numero', { referencedTable: 'parcelas' })
      .maybeSingle()
      .then(({ data }) => {
        setC(data as unknown as ContratoT | null)
        setCarregando(false)
      })
  }

  useEffect(() => { carregar() }, [id])

  function abrirPagamento(p: Parcela) {
    setPagando(pagando?.id === p.id ? null : p)
    setValorPago(p.status === 'aberta' ? String(p.valor).replace('.', ',') : '')
    setDesconto(''); setAcrescimo(''); setObservacao(''); setErroPag('')
  }

  async function registrarPagamento() {
    if (!pagando) return
    const v = numeroBr(valorPago)
    if (!v || v <= 0) return setErroPag('Informe o valor pago.')
    setErroPag(''); setSalvandoPag(true)
    const { error } = await supabase.rpc('pagamento_registrar', {
      p_parcela_id: pagando.id, p_valor_pago: v,
      p_desconto: desconto ? numeroBr(desconto) : 0, p_acrescimo: acrescimo ? numeroBr(acrescimo) : 0,
      p_observacao: observacao || null,
    })
    setSalvandoPag(false)
    if (error) return setErroPag(error.message)
    setPagando(null)
    carregar()
  }

  if (carregando) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Carregando…</p></Tela>
  if (!c) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Empréstimo não encontrado.</p></Tela>

  const recorrente = c.modalidade === 'recorrente'
  const total = c.parcelas.reduce((s, p) => s + Number(p.valor), 0)

  return (
    <Tela titulo={`Contrato ${String(c.numero).padStart(2, '0')}`} voltar={`/clientes/${c.cliente_id}`}>
      <p className="mt-1 text-slate-600">{c.clientes?.nome_completo}</p>

      <section className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
        <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Emprestado</span><strong>{reais(c.capital)}</strong></div>
        <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Modalidade</span><strong>{nomeModalidade[c.modalidade]}</strong></div>
        {c.sistema_calculo && (
          <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Cálculo</span><strong>{nomeSistema[c.sistema_calculo]}</strong></div>
        )}
        <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Juro</span><strong>{Number(c.juro_percentual).toLocaleString('pt-BR')}% ao mês</strong></div>
        <div className="flex justify-between px-4 py-3">
          <span className="text-slate-600">{recorrente ? 'Juro por mês' : 'Juro total'}</span><strong>{reais(c.juro_valor)}</strong>
        </div>
        {!recorrente && (
          <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Total a receber</span><strong>{reais(total)}</strong></div>
        )}
        <div className="flex justify-between px-4 py-3"><span className="text-slate-600">Dia do empréstimo</span><strong>{dataBr(c.data_contrato)}</strong></div>
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">{recorrente ? 'PRÓXIMO VENCIMENTO' : 'PARCELAS'}</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {c.parcelas.map((p) => (
            <li key={p.id} className="py-3">
              <button type="button" onClick={() => p.status !== 'paga' && abrirPagamento(p)} disabled={p.status === 'paga'}
                className="flex w-full items-center justify-between text-left disabled:cursor-default">
                <span>
                  <strong>{p.numero}ª</strong> · {dataBr(p.vencimento)}
                  <span className="ml-2 text-xs text-slate-500">{seloParcela[p.status] ?? p.status}</span>
                </span>
                <strong>{reais(p.valor)}</strong>
              </button>

              {pagando?.id === p.id && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <label className="block text-sm font-medium" htmlFor="vp">Valor pago (R$)</label>
                  <input id="vp" inputMode="decimal" autoFocus value={valorPago} onChange={(e) => setValorPago(e.target.value)} className={campo} />

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium" htmlFor="dc">Desconto (R$)</label>
                      <input id="dc" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" className={campo} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium" htmlFor="ac">Acréscimo (R$)</label>
                      <input id="ac" inputMode="decimal" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)} placeholder="0,00" className={campo} />
                    </div>
                  </div>

                  <label className="mt-2 block text-sm font-medium" htmlFor="obs">Observação (opcional)</label>
                  <input id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={campo} />

                  {erroPag && <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erroPag}</p>}

                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={registrarPagamento} disabled={salvandoPag}
                      className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50">
                      {salvandoPag ? 'Salvando…' : 'Confirmar pagamento'}
                    </button>
                    <button type="button" onClick={() => setPagando(null)} className="rounded-xl border border-slate-300 px-4 py-3 text-slate-600">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-sm text-slate-500">Em breve aqui: estorno.</p>
    </Tela>
  )
}
