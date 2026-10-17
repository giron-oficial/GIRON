import { useCallback, useEffect, useState, type InputHTMLAttributes } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import BarraRecuperacao from '../components/BarraRecuperacao'
import { recuperacao } from '../lib/recuperacao'
import { botaoVerde, campo, erroCaixa, rotulo, seloContrato, tituloSecao } from '../components/estilo'
import { dataBr, idCliente, idContrato, mascaraReais, nomeModalidade, nomeSistema, numeroBr, percentualCompleto, reais, reaisCampo } from '../lib/formatos'
import { encargosAtraso, regraDaConfig, type RegraAtraso } from '../lib/atraso'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'

type Parcela = { id: string; numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number; status: string }
type Pagamento = {
  id: string; parcela_id: string | null; tipo: string; valor_pago: number; desconto: number; acrescimo: number; parte_juro: number; parte_capital: number; multa: number; juro_atraso: number
  pago_em: string; observacao: string | null; estornado_em: string | null; motivo_estorno: string | null; ordem: number
}
type ContratoT = {
  id: string; numero: number; modalidade: string; sistema_calculo: string | null; capital: number; juro_percentual: number
  juro_valor: number; quantidade_parcelas: number | null; data_contrato: string; status: string; capital_em_aberto: number
  cliente_id: string; convertido_de: string | null; convertido_para: string | null; clientes: { numero: number; nome_completo: string } | null; parcelas: Parcela[]; pagamentos: Pagamento[]
}

const hoje = () => new Date().toLocaleDateString('sv-SE')
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)

// Selo de cada parcela, com as cores das situações do painel
function seloParcela(p: Parcela, diasCritico: number) {
  if (p.status === 'paga') return { texto: 'Paga', classe: 'bg-marca/15 text-marca', bolinha: 'bg-marca-clara' }
  const atraso = diasEntre(p.vencimento, hoje())
  const parcial = p.status === 'parcial' ? 'Parcial · ' : ''
  if (atraso >= diasCritico) return { texto: `${parcial}Crítico · ${atraso} dias`, classe: 'bg-critico/15 text-critico', bolinha: 'bg-critico' }
  if (atraso > 0) return { texto: `${parcial}${atraso === 1 ? 'Venceu ontem' : `${atraso} dias de atraso`}`, classe: 'bg-vencido/15 text-vencido', bolinha: 'bg-vencido' }
  if (atraso === 0) return { texto: `${parcial}Vence hoje`, classe: 'bg-hoje/15 text-hoje', bolinha: 'bg-hoje' }
  if (atraso === -1) return { texto: `${parcial}Vence amanhã`, classe: 'bg-amanha/15 text-amanha', bolinha: 'bg-amanha' }
  return { texto: p.status === 'parcial' ? 'Parcial' : 'Em aberto', classe: 'bg-superficie-2 text-suave', bolinha: 'bg-suave/50' }
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
  const [multa, setMulta] = useState('')
  const [juroAtraso, setJuroAtraso] = useState('')
  const [regra, setRegra] = useState<RegraAtraso>(regraDaConfig(null))
  const [erroPag, setErroPag] = useState('')
  const [salvandoPag, setSalvandoPag] = useState(false)
  const [estornando, setEstornando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erroEst, setErroEst] = useState('')
  const [salvandoEst, setSalvandoEst] = useState(false)
  const [amortizando, setAmortizando] = useState(false)
  const [valorAmort, setValorAmort] = useState('')
  const [obsAmort, setObsAmort] = useState('')
  const [erroAmort, setErroAmort] = useState('')
  const [salvandoAmort, setSalvandoAmort] = useState(false)

  const carregar = useCallback(() => {
    return supabase
      .from('contratos')
      .select(`id, numero, modalidade, sistema_calculo, capital, juro_percentual, juro_valor, quantidade_parcelas, data_contrato,
               status, capital_em_aberto, cliente_id, convertido_de, convertido_para, clientes(numero, nome_completo), parcelas(id, numero, vencimento, valor, parte_juro, parte_capital, status),
               pagamentos(id, parcela_id, tipo, valor_pago, desconto, acrescimo, parte_juro, parte_capital, multa, juro_atraso, pago_em, observacao, estornado_em, motivo_estorno, ordem)`)
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

  useEffect(() => {
    supabase
      .from('fomentado_configuracoes')
      .select('dias_para_critico, multa_atraso_valor, juro_diario_atraso_valor, juro_atraso_desde')
      .maybeSingle()
      .then(({ data }) => setRegra(regraDaConfig(data)))
  }, [])

  // Multa e juro de atraso que esta parcela deve hoje (descontando o que já entrou dela)
  function encargosDe(p: Parcela) {
    const validos = (c?.pagamentos ?? []).filter((pg) => pg.parcela_id === p.id && !pg.estornado_em)
    const jaMulta = validos.reduce((t, pg) => t + Number(pg.multa), 0)
    const jaJuro = validos.reduce((t, pg) => t + Number(pg.juro_atraso), 0)
    return encargosAtraso(diasEntre(p.vencimento, hoje()), regra, jaMulta, jaJuro)
  }

  function abrirPagamento(p: Parcela) {
    setPagando(pagando?.id === p.id ? null : p)
    setValorPago('')
    setDesconto(''); setAcrescimo(''); setObservacao(''); setErroPag('')
    const e = encargosDe(p)
    setMulta(e.multa ? reaisCampo(e.multa) : '')
    setJuroAtraso(e.juro ? reaisCampo(e.juro) : '')
  }

  async function registrarPagamento() {
    if (!pagando) return
    // campo vazio = paga o valor da parcela + multa e juro de atraso (que aparece em cinza)
    const m = multa ? numeroBr(multa) : 0
    const ja = juroAtraso ? numeroBr(juroAtraso) : 0
    const v = valorPago ? numeroBr(valorPago) : pagando.status === 'aberta' ? Number(pagando.valor) + m + ja : 0
    if (!v || v <= 0) return setErroPag('Informe o valor pago.')
    setErroPag(''); setSalvandoPag(true)
    const { error } = await supabase.rpc('pagamento_registrar', {
      p_parcela_id: pagando.id, p_valor_pago: v,
      p_desconto: desconto ? numeroBr(desconto) : 0, p_acrescimo: acrescimo ? numeroBr(acrescimo) : 0,
      p_multa: m, p_juro_atraso: ja,
      p_observacao: observacao || null,
    })
    setSalvandoPag(false)
    if (error) return setErroPag(error.message)
    rastrear('pagamento_registrado')
    setPagando(null)
    carregar()
  }

  // Recorrente: abate capital; o juro dos meses que ainda não venceram é recalculado no banco
  async function amortizar() {
    if (!c) return
    const v = valorAmort ? numeroBr(valorAmort) : 0
    if (!v || v <= 0) return setErroAmort('Informe o valor da amortização.')
    if (v > Number(c.capital_em_aberto)) return setErroAmort(`O valor é maior que o capital em aberto (${reais(c.capital_em_aberto)}).`)
    setErroAmort(''); setSalvandoAmort(true)
    const { error } = await supabase.rpc('amortizacao_registrar', { p_contrato_id: c.id, p_valor: v, p_observacao: obsAmort || null })
    setSalvandoAmort(false)
    if (error) return setErroAmort(error.message)
    rastrear('amortizacao_registrada')
    setAmortizando(false); setValorAmort(''); setObsAmort('')
    carregar()
  }

  async function estornar(pagamentoId: string) {
    if (motivo.trim().length < 3) return setErroEst('Escreva o motivo do estorno.')
    setErroEst(''); setSalvandoEst(true)
    const { error } = await supabase.rpc('estorno_registrar', { p_pagamento_id: pagamentoId, p_motivo: motivo.trim() })
    setSalvandoEst(false)
    if (error) return setErroEst(error.message)
    rastrear('estorno_registrado')
    setEstornando(null); setMotivo('')
    carregar()
  }

  if (carregando) return <Tela voltar="/clientes"><div className="mt-4 h-48 animate-pulse rounded-[26px] bg-superficie-2" /></Tela>
  if (!c) return <Tela voltar="/clientes"><p className="mt-6 text-suave">Empréstimo não encontrado.</p></Tela>

  const recorrente = c.modalidade === 'recorrente'
  const historico = [...(c.pagamentos ?? [])].sort((a, b) => b.ordem - a.ordem)
  const ultimoValido = historico.find((pg) => !pg.estornado_em)
  const total = c.parcelas.reduce((s, p) => s + Number(p.valor), 0)
  const pagas = c.parcelas.filter((p) => p.status === 'paga').length
  const sc = seloContrato[c.status] ?? seloContrato.ativo
  const juroDoMes = Math.round(Number(c.capital_em_aberto) * Number(c.juro_percentual)) / 100
  const vAmort = valorAmort ? numeroBr(valorAmort) : 0
  const capitalDepois = Math.max(0, Number(c.capital_em_aberto) - vAmort)
  const rec = recuperacao(Number(c.capital), c.pagamentos ?? [])
  const recuperado = Number(c.capital) > 0 ? Math.round(((Number(c.capital) - Number(c.capital_em_aberto)) / Number(c.capital)) * 100) : 0

  return (
    <Tela titulo={`Contrato ${idContrato(c.numero)}`} subtitulo={c.clientes ? `${c.clientes.nome_completo} · ${idCliente(c.clientes.numero)}` : undefined} voltar={`/clientes/${c.cliente_id}`} largo
      acoes={
        <Link to={`/contratos/${c.id}/extrato`} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-borda bg-superficie px-4 text-sm font-bold">
          <Icone nome="relatorios" tamanho={18} />
          Extrato
        </Link>
      }
    >
      {c.convertido_para && (
        <Link to={`/contratos/${c.convertido_para}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-hoje/15 px-4 py-3 text-sm font-semibold text-hoje">
          Este Recorrente foi transformado em parcelado. Não cobra mais juro todo mês.
          <span className="shrink-0 font-bold">Ver o contrato novo →</span>
        </Link>
      )}
      {c.convertido_de && (
        <Link to={`/contratos/${c.convertido_de}`} className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-superficie-2 px-4 py-3 text-sm font-semibold text-suave">
          Veio de um Recorrente transformado em parcelado.
          <span className="shrink-0 font-bold text-marca">Ver o antigo →</span>
        </Link>
      )}
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <div className="flex flex-col gap-3">
          <section className="relative overflow-hidden rounded-[26px] bg-linear-135 border border-[#1F4A38] from-[#0E3A2A] to-superficie to-65% p-5 text-white">
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
              <span className="text-xs text-suave">
                {recuperado}% do capital já voltou{!recorrente && ` · ${pagas} de ${c.parcelas.length} parcelas pagas`}
              </span>
            </div>
            {recorrente && c.status === 'ativo' && !amortizando && (
              <div className="relative mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setAmortizando(true); setValorAmort(''); setObsAmort(''); setErroAmort('') }}
                  className="verde inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold"
                >
                  <Icone nome="entrando" tamanho={18} />
                  Amortizar capital
                </button>
                <Link
                  to={`/clientes/${c.cliente_id}/emprestimo?converter=${c.id}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-borda bg-superficie-2 px-4 text-sm font-bold"
                >
                  <Icone nome="contratos" tamanho={18} />
                  Transformar em parcelado
                </Link>
              </div>
            )}
          </section>

          {amortizando && (
            <section className="cartao flex flex-col gap-3 rounded-[22px] p-4 ring-2 ring-marca-clara lg:p-5">
              <div>
                <h2 className="text-base font-bold">Amortizar capital</h2>
                <p className="mt-0.5 text-xs text-suave">O cliente abate parte do que pegou. O juro dos próximos meses diminui; os meses que já venceram não mudam.</p>
              </div>
              <div>
                <label className={rotulo} htmlFor="va">Valor que o cliente está abatendo</label>
                <CampoReais id="va" autoFocus value={valorAmort} onChange={(e) => setValorAmort(mascaraReais(e.target.value))} placeholder="0,00" />
              </div>
              {vAmort > 0 && vAmort <= Number(c.capital_em_aberto) && (
                <div className="flex flex-col gap-1 rounded-2xl bg-superficie-2 p-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-suave">Capital passa a ser</span><strong className="tabular-nums">{reais(capitalDepois)}</strong></div>
                  <div className="flex justify-between gap-3">
                    <span className="text-suave">Juro por mês passa a ser</span>
                    <strong className="text-marca tabular-nums">{reais(Math.round(capitalDepois * Number(c.juro_percentual)) / 100)}</strong>
                  </div>
                  {capitalDepois === 0 && <span className="text-xs text-suave">Abateu tudo: pagando os juros que estiverem vencidos, o contrato fica quitado.</span>}
                </div>
              )}
              <div>
                <label className={rotulo} htmlFor="oa">
                  Observação <span className="font-normal text-suave">(opcional)</span>
                </label>
                <input id="oa" value={obsAmort} onChange={(e) => setObsAmort(e.target.value)} placeholder="Ex.: pagou no Pix" className={campo} />
              </div>
              {erroAmort && <p role="alert" className={erroCaixa}>{erroAmort}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={amortizar} disabled={salvandoAmort} className={`${botaoVerde} flex-1`}>
                  <Icone nome="certo" tamanho={18} />
                  {salvandoAmort ? 'Salvando…' : 'Confirmar'}
                </button>
                <button type="button" onClick={() => setAmortizando(false)} className="h-12 rounded-2xl border border-borda bg-superficie px-4 font-semibold text-suave">
                  Cancelar
                </button>
              </div>
            </section>
          )}

          <section className="cartao rounded-[22px] p-4 lg:p-5">
            <h2 className={tituloSecao}>Recuperação de capital</h2>
            <div className="mt-3"><BarraRecuperacao r={rec} /></div>
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
              <div className="flex justify-between gap-3 py-2.5"><span className="text-suave">{recorrente ? 'Juro por mês' : 'Juro total'}</span><strong className="tabular-nums">{reais(recorrente ? juroDoMes : c.juro_valor)}</strong></div>
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
              const selo = seloParcela(p, regra.diasCritico)
              const aberta = pagando?.id === p.id
              const enc = p.status !== 'paga' && c.status === 'ativo' ? encargosDe(p) : null
              const somaEnc = (multa ? numeroBr(multa) : 0) + (juroAtraso ? numeroBr(juroAtraso) : 0)
              return (
                <li key={p.id} className={`rounded-2xl transition ${aberta ? 'bg-superficie-2 ring-2 ring-marca-clara' : 'bg-superficie-2/60'}`}>
                  <button
                    type="button"
                    onClick={() => p.status !== 'paga' && c.status === 'ativo' && abrirPagamento(p)}
                    disabled={p.status === 'paga' || c.status !== 'ativo'}
                    className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-superficie text-sm font-extrabold">{p.numero}ª</span>
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
                      {enc && enc.total > 0 && <span className="text-[11px] font-bold text-critico tabular-nums">+ {reais(enc.total)} multa/juros</span>}
                    </div>
                  </button>

                  {aberta && (
                    <div className="flex flex-col gap-3 border-t border-borda px-3 pt-3 pb-3">
                      <div>
                        <label className={rotulo} htmlFor="vp">Valor pago</label>
                        <CampoReais
                          id="vp"
                          autoFocus
                          value={valorPago}
                          onChange={(e) => setValorPago(mascaraReais(e.target.value))}
                          placeholder={p.status === 'aberta' ? reaisCampo(Number(p.valor) + somaEnc) : '0,00'}
                        />
                        {p.status === 'aberta' && (
                          <p className="mt-1 text-xs text-suave">
                            Deixe em branco pra pagar {somaEnc > 0 ? 'a parcela + multa e juros de atraso' : 'o valor da parcela'}.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={rotulo} htmlFor="mu">Multa</label>
                          <CampoReais id="mu" value={multa} onChange={(e) => setMulta(mascaraReais(e.target.value))} placeholder="0,00" />
                        </div>
                        <div>
                          <label className={rotulo} htmlFor="ja">Juro de atraso</label>
                          <CampoReais id="ja" value={juroAtraso} onChange={(e) => setJuroAtraso(mascaraReais(e.target.value))} placeholder="0,00" />
                        </div>
                      </div>
                      {enc && enc.total > 0 && (
                        <p className="-mt-1 text-xs text-suave">
                          Calculado pelas suas Configurações ({enc.dias} {enc.dias === 1 ? 'dia' : 'dias'} de juro). Negociou? É só mudar ou apagar.
                        </p>
                      )}
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
                          {salvandoPag ? 'Salvando…' : 'Confirmar'}
                        </button>
                        <button type="button" onClick={() => setPagando(null)} className="h-12 rounded-2xl border border-borda bg-superficie px-4 font-semibold text-suave">
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

      <section className="cartao mt-3 rounded-[22px] p-4 lg:p-5">
        <h2 className={tituloSecao}>Pagamentos recebidos</h2>
        <p className="mt-0.5 text-xs text-suave">Lançou errado? Dá pra estornar o último pagamento. Nada é apagado: fica registrado com o motivo.</p>
        {historico.length === 0 && <p className="mt-3 text-sm text-suave">Nenhum pagamento ainda.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {historico.map((pg) => {
            const parcela = c.parcelas.find((p) => p.id === pg.parcela_id)
            const ultimo = pg.id === ultimoValido?.id
            const abrir = estornando === pg.id
            return (
              <li key={pg.id} className={`rounded-2xl p-3 ${pg.estornado_em ? 'bg-superficie-2/40' : abrir ? 'bg-vencido/10 ring-2 ring-vencido/40' : 'bg-superficie-2/60'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${pg.estornado_em ? 'bg-vencido/15 text-vencido' : 'bg-marca/15 text-marca'}`}>
                    <Icone nome={pg.estornado_em ? 'xis' : 'certo'} tamanho={18} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-sm font-bold tabular-nums ${pg.estornado_em ? 'text-suave line-through' : ''}`}>
                      {reais(Number(pg.parte_juro) + Number(pg.parte_capital))}
                      {parcela && <span className="font-normal text-suave"> · {parcela.numero}ª parcela</span>}
                      {pg.tipo === 'amortizacao' && <span className="font-normal text-suave"> · amortização</span>}
                    </span>
                    <span className="text-xs text-suave">
                      {dataBr(pg.pago_em)} · juro {reais(pg.parte_juro)} · capital {reais(pg.parte_capital)}
                      {Number(pg.multa) + Number(pg.juro_atraso) > 0 && ` · multa/juros de atraso ${reais(Number(pg.multa) + Number(pg.juro_atraso))}`}
                    </span>
                    {pg.observacao && !pg.estornado_em && <span className="text-xs text-suave">"{pg.observacao}"</span>}
                    {pg.estornado_em && (
                      <span className="text-xs font-semibold text-vencido">
                        Estornado em {new Date(pg.estornado_em).toLocaleDateString('pt-BR')}: {pg.motivo_estorno}
                      </span>
                    )}
                  </div>
                  {ultimo && !abrir && (
                    <button
                      type="button"
                      onClick={() => { setEstornando(pg.id); setMotivo(''); setErroEst('') }}
                      className="h-9 shrink-0 rounded-xl bg-superficie px-3 text-xs font-bold text-vencido"
                    >
                      Estornar
                    </button>
                  )}
                </div>

                {abrir && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <label className={rotulo} htmlFor="motivo">Motivo do estorno</label>
                      <input id="motivo" autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: lancei o valor errado" className={campo} />
                    </div>
                    <p className="text-xs text-suave">
                      O valor volta a ficar em aberto: {reais(pg.parte_juro)} de juro e {reais(pg.parte_capital)} de capital.
                    </p>
                    {erroEst && <p role="alert" className={erroCaixa}>{erroEst}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => estornar(pg.id)}
                        disabled={salvandoEst}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-linear-135 from-[#FF8A7A] to-[#D92D3A] font-bold text-white shadow-lg shadow-vencido/30 disabled:opacity-60"
                      >
                        <Icone nome="xis" tamanho={18} />
                        {salvandoEst ? 'Estornando…' : 'Confirmar estorno'}
                      </button>
                      <button type="button" onClick={() => setEstornando(null)} className="h-12 rounded-2xl border border-borda bg-superficie px-4 font-semibold text-suave">
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
    </Tela>
  )
}
