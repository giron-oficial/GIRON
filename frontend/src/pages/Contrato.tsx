import { useCallback, useEffect, useState, type InputHTMLAttributes } from 'react'
import { useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoVerde, campo, erroCaixa, rotulo, seloContrato, tituloSecao } from '../components/estilo'
import { dataBr, mascaraReais, nomeModalidade, nomeSistema, numeroBr, percentualCompleto, reais, reaisCampo } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Parcela = { id: string; numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number; status: string }
type ContratoT = {
  id: string; numero: number; modalidade: string; sistema_calculo: string | null; capital: number; juro_percentual: number
  juro_valor: number; quantidade_parcelas: number | null; data_contrato: string; status: string; capital_em_aberto: number
  cliente_id: string; clientes: { nome_completo: string } | null; parcelas: Parcela[]
}

const hoje = () => new Date().toLocaleDateString('sv-SE')
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)

// Selo de cada parcela, com as cores das situações do painel
function seloParcela(p: Parcela) {
  if (p.status === 'paga') return { texto: 'Paga', classe: 'bg-[#DDF7EA] text-marca', bolinha: 'bg-marca-clara' }
  const atraso = diasEntre(p.vencimento, hoje())
  const parcial = p.status === 'parcial' ? 'Parcial · ' : ''
  if (atraso > 0) return { texto: `${parcial}${atraso === 1 ? 'Venceu ontem' : `${atraso} dias de atraso`}`, classe: 'bg-[#FFE9E8] text-[#B42318]', bolinha: 'bg-vencido' }
  if (atraso === 0) return { texto: `${parcial}Vence hoje`, classe: 'bg-[#E4EEFF] text-hoje', bolinha: 'bg-hoje' }
  if (atraso === -1) return { texto: `${parcial}Vence amanhã`, classe: 'bg-[#FFF3D1] text-[#8A5A00]', bolinha: 'bg-amanha' }
  return { texto: p.status === 'parcial' ? 'Parcial' : 'Em aberto', classe: 'bg-superficie-2 text-suave', bolinha: 'bg-[#C9CED6]' }
}

function CampoReais({ id, ...resto }: { id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input id={id} inputMode="numeric" {...resto} className={`${campo} pl-11 tabular-nums`} />
      <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
    </div>
  )
}

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

  const carregar = useCallback(() => {
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
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrirPagamento(p: Parcela) {
    setPagando(pagando?.id === p.id ? null : p)
    setValorPago('')
    setDesconto(''); setAcrescimo(''); setObservacao(''); setErroPag('')
  }

  async function registrarPagamento() {
    if (!pagando) return
    // campo vazio = paga o valor da parcela (que aparece em cinza)
    const v = valorPago ? numeroBr(valorPago) : pagando.status === 'aberta' ? Number(pagando.valor) : 0
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

  if (carregando) return <Tela voltar="/clientes"><div className="mt-4 h-48 animate-pulse rounded-[26px] bg-black/5" /></Tela>
  if (!c) return <Tela voltar="/clientes"><p className="mt-6 text-suave">Empréstimo não encontrado.</p></Tela>

  const recorrente = c.modalidade === 'recorrente'
  const total = c.parcelas.reduce((s, p) => s + Number(p.valor), 0)
  const pagas = c.parcelas.filter((p) => p.status === 'paga').length
  const sc = seloContrato[c.status] ?? seloContrato.ativo
  const recuperado = Number(c.capital) > 0 ? Math.round(((Number(c.capital) - Number(c.capital_em_aberto)) / Number(c.capital)) * 100) : 0

  return (
    <Tela titulo={`Contrato ${String(c.numero).padStart(2, '0')}`} subtitulo={c.clientes?.nome_completo} voltar={`/clientes/${c.cliente_id}`} largo>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <section className="relative overflow-hidden rounded-[26px] bg-linear-135 from-[#0E4D36] to-tinta to-65% p-5 text-white shadow-xl shadow-[#0E4D36]/25">
            <div className="pointer-events-none absolute -top-14 -right-12 size-44 rounded-full bg-[radial-gradient(circle,rgb(34_209_132/0.5),transparent_70%)]" />
            <div className="relative flex items-center justify-between">
              <span className="text-xs text-[#B7F0D3]">Falta voltar do capital</span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.classe}`}>{sc.texto}</span>
            </div>
            <p className="relative mt-2 text-[34px] leading-none font-extrabold tabular-nums">{reais(c.capital_em_aberto)}</p>
            <div className="relative mt-4 flex flex-col gap-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-marca-brilho" style={{ width: `${recuperado}%` }} />
              </div>
              <span className="text-xs text-[#A1A7B3]">
                {recuperado}% do capital já voltou{!recorrente && ` · ${pagas} de ${c.parcelas.length} parcelas pagas`}
              </span>
            </div>
          </section>

          <section className="cartao rounded-[22px] p-4 lg:p-5">
            <h2 className={tituloSecao}>Resumo</h2>
            <div className="mt-1 divide-y divide-superficie-2 text-sm">
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Emprestado</span><strong className="tabular-nums">{reais(c.capital)}</strong></div>
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Modalidade</span><strong>{nomeModalidade[c.modalidade]}</strong></div>
              {c.sistema_calculo && (
                <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Cálculo</span><strong>{nomeSistema[c.sistema_calculo]}</strong></div>
              )}
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Juro ao mês</span><strong className="text-right tabular-nums break-all">{percentualCompleto(Number(c.juro_percentual))}%</strong></div>
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">{recorrente ? 'Juro por mês' : 'Juro total'}</span><strong className="tabular-nums">{reais(c.juro_valor)}</strong></div>
              {!recorrente && (
                <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Total a receber</span><strong className="tabular-nums">{reais(total)}</strong></div>
              )}
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">Dia do empréstimo</span><strong>{dataBr(c.data_contrato)}</strong></div>
            </div>
          </section>
        </div>

        <section className="cartao rounded-[22px] p-4 lg:p-5">
          <h2 className={tituloSecao}>{recorrente ? 'Próximo vencimento' : 'Parcelas'}</h2>
          <p className="mt-0.5 text-xs text-suave">Toque numa parcela em aberto pra registrar o pagamento.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {c.parcelas.map((p) => {
              const selo = seloParcela(p)
              const aberta = pagando?.id === p.id
              return (
                <li key={p.id} className={`rounded-2xl transition ${aberta ? 'bg-superficie-2 ring-2 ring-marca-clara' : 'bg-superficie-2/60'}`}>
                  <button
                    type="button"
                    onClick={() => p.status !== 'paga' && abrirPagamento(p)}
                    disabled={p.status === 'paga'}
                    className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-extrabold">{p.numero}ª</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-bold">{dataBr(p.vencimento)}</span>
                      <span className={`flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${selo.classe}`}>
                        <span className={`size-1.5 rounded-full ${selo.bolinha}`} />
                        {selo.texto}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-sm font-bold tabular-nums">{reais(p.valor)}</span>
                      <span className="text-[11px] text-suave tabular-nums">juro {reais(p.parte_juro)}</span>
                    </div>
                  </button>

                  {aberta && (
                    <div className="flex flex-col gap-3 border-t border-white px-3 pt-3 pb-3">
                      <div>
                        <label className={rotulo} htmlFor="vp">Valor pago</label>
                        <CampoReais
                          id="vp"
                          autoFocus
                          value={valorPago}
                          onChange={(e) => setValorPago(mascaraReais(e.target.value))}
                          placeholder={p.status === 'aberta' ? reaisCampo(Number(p.valor)) : '0,00'}
                        />
                        {p.status === 'aberta' && <p className="mt-1 text-xs text-suave">Deixe em branco pra pagar o valor da parcela.</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={rotulo} htmlFor="dc">Desconto</label>
                          <CampoReais id="dc" value={desconto} onChange={(e) => setDesconto(mascaraReais(e.target.value))} placeholder="0,00" />
                        </div>
                        <div>
                          <label className={rotulo} htmlFor="ac">Acréscimo</label>
                          <CampoReais id="ac" value={acrescimo} onChange={(e) => setAcrescimo(mascaraReais(e.target.value))} placeholder="0,00" />
                        </div>
                      </div>
                      <div>
                        <label className={rotulo} htmlFor="obs">
                          Observação <span className="font-normal text-suave">(opcional)</span>
                        </label>
                        <input id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: pagou no Pix" className={campo} />
                      </div>

                      {erroPag && <p role="alert" className={erroCaixa}>{erroPag}</p>}

                      <div className="flex gap-2">
                        <button type="button" onClick={registrarPagamento} disabled={salvandoPag} className={`${botaoVerde} flex-1`}>
                          <Icone nome="certo" tamanho={18} />
                          {salvandoPag ? 'Salvando…' : 'Confirmar pagamento'}
                        </button>
                        <button type="button" onClick={() => setPagando(null)} className="h-12 rounded-2xl bg-white px-4 font-semibold text-suave">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Tela>
  )
}
