import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoVerde, campo, erroCaixa, rotulo, tituloSecao } from '../components/estilo'
import { dataBr, mascaraPercentual, mascaraReais, nomeModalidade, nomeSistema, numeroBr, percentualCompleto, reais, reaisCampo } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'

// Novo emprestimo (RN-50 a RN-58). Ja vem preenchido com o que o cliente pediu no cadastro.
// As contas sao feitas no banco (emprestimo_simular) - a tela so mostra e deixa escolher.
// Com ?converter=<contrato> vira "Transformar em parcelado": capital = o que falta do Recorrente
// + a parte dos juros vencidos que o dono escolher (contrato_converter).

type Parcela = { numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number }
type Calculo = { meses_equivalentes: number; juro_total: number; total: number; parcelas: Parcela[] }
type Modalidade = 'diario' | 'semanal' | 'mensal' | 'recorrente'
type Sistema = 'empresa' | 'price' | 'sac'
type Previa = { numero: number; capital: number; juros_vencidos: number; meses_vencidos: number; juro_percentual: number }

const hoje = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso do celular

function somarDias(iso: string, dias: number) {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.toLocaleDateString('sv-SE')
}
function proximoMes(iso: string, dia?: number | null) {
  const d = new Date(iso + 'T12:00:00')
  const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
  alvo.setDate(Math.min(dia ?? d.getDate(), ultimo))
  return alvo.toLocaleDateString('sv-SE')
}
function primeiroVencimentoPadrao(mod: Modalidade, inicio: string, dia?: number | null) {
  if (mod === 'diario') return somarDias(inicio, 1)
  if (mod === 'semanal') return somarDias(inicio, 7)
  return proximoMes(inicio, dia)
}

// Campo com "R$" na frente ou "%" no fim
function CampoComSinal({ id, sinal, lado, ...resto }: { id: string; sinal: string; lado: 'antes' | 'depois' } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input id={id} {...resto} className={`${campo} tabular-nums ${lado === 'antes' ? 'pl-11' : 'pr-10'}`} />
      <span className={`pointer-events-none absolute top-1/2 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave ${lado === 'antes' ? 'left-4' : 'right-4'}`}>{sinal}</span>
    </div>
  )
}

export default function EmprestimoNovo() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [cliente, setCliente] = useState<{ nome_completo: string; status_cadastro: string; dia_vencimento_preferido: number | null } | null>(null)
  const [capital, setCapital] = useState('')
  const [modalidade, setModalidade] = useState<Modalidade>('mensal')
  const [juroPct, setJuroPct] = useState('')
  const [juroValor, setJuroValor] = useState('')
  const [ultimoJuro, setUltimoJuro] = useState<'pct' | 'valor'>('pct')
  const [qtd, setQtd] = useState('')
  const [inicio, setInicio] = useState(hoje())
  const [primeiro, setPrimeiro] = useState('')
  const [sistema, setSistema] = useState<Sistema>('empresa')
  const [calc, setCalc] = useState<Partial<Record<Sistema, Calculo>>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [verParcelas, setVerParcelas] = useState(false)
  const [busca] = useSearchParams()
  const converter = busca.get('converter')
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [jurosIncl, setJurosIncl] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('nome_completo, status_cadastro, valor_pretendido, modalidade_preferida, dia_vencimento_preferido').eq('id', id!).maybeSingle(),
      supabase.from('fomentado_configuracoes').select('juro_padrao_percentual').maybeSingle(),
      converter ? supabase.rpc('conversao_previa', { p_contrato_id: converter }) : Promise.resolve({ data: null, error: null }),
    ]).then(([{ data: c }, { data: cfg }, { data: pv, error: erroPv }]) => {
      if (!c) return
      setCliente(c)
      if (converter) {
        if (erroPv || !pv) return setErro(erroPv?.message ?? 'Contrato não encontrado.')
        const prv = pv as Previa
        setPrevia(prv)
        setJurosIncl(reaisCampo(Number(prv.juros_vencidos))) // começa com todos os juros vencidos; o dono ajusta
        setJuroPct(percentualCompleto(Number(prv.juro_percentual)))
        setModalidade('mensal')
        setPrimeiro(primeiroVencimentoPadrao('mensal', hoje(), c.dia_vencimento_preferido))
        return
      }
      if (c.valor_pretendido) setCapital(reaisCampo(Number(c.valor_pretendido)))
      const mod = (c.modalidade_preferida ?? 'mensal') as Modalidade
      setModalidade(mod)
      if (cfg?.juro_padrao_percentual != null) setJuroPct(percentualCompleto(Number(cfg.juro_padrao_percentual)))
      setPrimeiro(primeiroVencimentoPadrao(mod, hoje(), c.dia_vencimento_preferido))
    })
  }, [id, converter])

  // Conversão: valor a parcelar = capital que falta + juros vencidos escolhidos
  const incl = jurosIncl ? numeroBr(jurosIncl) : 0
  useEffect(() => {
    if (!previa) return
    const t = setTimeout(() => setCapital(reaisCampo(Math.round((Number(previa.capital) + incl) * 100) / 100)), 0)
    return () => clearTimeout(t)
  }, [previa, incl])

  function trocarModalidade(m: Modalidade) {
    setModalidade(m)
    setPrimeiro(primeiroVencimentoPadrao(m, inicio, cliente?.dia_vencimento_preferido))
  }

  const cap = capital ? numeroBr(capital) : 0
  const taxa = juroPct ? numeroBr(juroPct) : 0
  const n = Number(qtd)
  const recorrente = modalidade === 'recorrente'

  // simula as 3 formas (ou o recorrente) sempre que muda algum numero
  useEffect(() => {
    if (!cap || cap <= 0 || isNaN(taxa) || !primeiro || (!recorrente && (!n || n < 1))) {
      const limpa = setTimeout(() => setCalc({}), 0)
      return () => clearTimeout(limpa)
    }
    const t = setTimeout(async () => {
      const sistemas: Sistema[] = recorrente ? ['empresa'] : ['empresa', 'price', 'sac']
      const res = await Promise.all(sistemas.map((s) =>
        supabase.rpc('emprestimo_simular', {
          p_modalidade: modalidade, p_sistema: recorrente ? null : s, p_capital: cap, p_juro_mensal_percentual: taxa,
          p_quantidade: recorrente ? null : n, p_data_contrato: inicio, p_primeiro_vencimento: primeiro,
        })))
      const erroSim = res.find((r) => r.error)?.error
      if (erroSim) { setErro(erroSim.message); setCalc({}); return }
      setErro('')
      setCalc(Object.fromEntries(sistemas.map((s, k) => [s, res[k].data as Calculo])))
    }, 300)
    return () => clearTimeout(t)
  }, [cap, taxa, n, modalidade, inicio, primeiro, recorrente])

  const escolhido = recorrente ? calc.empresa : calc[sistema]

  // Juro em R$ ligado ao % (RN-54): R$ = capital x % x meses do prazo (no recorrente, 1 mês)
  const meses = recorrente ? 1 : (calc.empresa?.meses_equivalentes ?? 0)

  function digitarPct(t: string) {
    const v = mascaraPercentual(t)
    setJuroPct(v)
    setUltimoJuro('pct')
    const p = v ? numeroBr(v) : NaN
    setJuroValor(cap && meses && !isNaN(p) ? reaisCampo(Math.round(cap * (p / 100) * meses * 100) / 100) : '')
  }

  function digitarValor(t: string) {
    const v = mascaraReais(t)
    setJuroValor(v)
    setUltimoJuro('valor')
    if (cap && meses && v) setJuroPct(percentualCompleto((numeroBr(v) / (cap * meses)) * 100))
  }

  // Mudou o valor emprestado ou o prazo: recalcula o lado que não foi digitado por último
  useEffect(() => {
    if (!cap || !meses) return
    const t = setTimeout(() => {
      if (ultimoJuro === 'pct' && juroPct) setJuroValor(reaisCampo(Math.round(cap * (numeroBr(juroPct) / 100) * meses * 100) / 100))
      if (ultimoJuro === 'valor' && juroValor) setJuroPct(percentualCompleto((numeroBr(juroValor) / (cap * meses)) * 100))
    }, 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cap, meses])

  async function fazer() {
    setErro('')
    if (!escolhido) return setErro('Preencha valor, juro e parcelas.')
    if (previa && incl > Number(previa.juros_vencidos)) return setErro(`Os juros vencidos são ${reais(previa.juros_vencidos)}; não dá pra incluir mais que isso.`)
    setSalvando(true)
    const { data, error } = previa
      ? await supabase.rpc('contrato_converter', {
          p_contrato_id: converter, p_juros_incluidos: incl, p_modalidade: modalidade, p_sistema: sistema,
          p_juro_mensal_percentual: taxa, p_quantidade: n, p_primeiro_vencimento: primeiro,
        })
      : await supabase.rpc('contrato_criar', {
      p_cliente_id: id, p_modalidade: modalidade, p_sistema: recorrente ? null : sistema, p_capital: cap,
      p_juro_mensal_percentual: taxa, p_quantidade: recorrente ? null : n, p_data_contrato: inicio, p_primeiro_vencimento: primeiro,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    rastrear(previa ? 'contrato_convertido' : 'contrato_criado', { modalidade, sistema: recorrente ? 'recorrente' : sistema, origem: 'novo_emprestimo' })
    navegar(`/contratos/${data}`, { replace: true })
  }

  const voltar = converter ? `/contratos/${converter}` : `/clientes/${id}`
  if (converter && erro && !previa) return <Tela voltar={voltar}><p className={`${erroCaixa} mt-4`}>{erro}</p></Tela>
  if (!cliente || (converter && !previa)) return <Tela voltar={voltar}><div className="mt-4 h-60 animate-pulse rounded-[26px] bg-superficie-2" /></Tela>
  if (cliente.status_cadastro !== 'aprovado') return (
    <Tela voltar={`/clientes/${id}`}><p className="cartao mt-4 rounded-[22px] p-6 text-suave">Aprove o cadastro do cliente antes de fazer o empréstimo.</p></Tela>
  )

  const unidade = modalidade === 'diario' ? 'dias' : modalidade === 'semanal' ? 'semanas' : 'meses'

  return (
    <Tela titulo={previa ? 'Transformar em parcelado' : 'Novo empréstimo'} subtitulo={cliente.nome_completo} voltar={voltar}>
      {previa && (
        <section className="cartao mt-4 flex flex-col gap-3 rounded-[26px] p-5 ring-2 ring-marca-clara lg:p-6">
          <p className="text-sm text-suave">
            O Recorrente (contrato {String(previa.numero).padStart(2, '0')}) vira um empréstimo parcelado. Ele para de cobrar juro todo mês e fica marcado como "convertido".
          </p>
          <div className="flex flex-col gap-1 rounded-2xl bg-superficie-2 p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-suave">Capital que falta</span><strong className="tabular-nums">{reais(previa.capital)}</strong></div>
            <div className="flex justify-between gap-3">
              <span className="text-suave">Juros vencidos sem pagar{previa.meses_vencidos > 0 && ` (${previa.meses_vencidos} ${previa.meses_vencidos === 1 ? 'mês' : 'meses'})`}</span>
              <strong className="tabular-nums">{reais(previa.juros_vencidos)}</strong>
            </div>
          </div>
          {Number(previa.juros_vencidos) > 0 && (
            <div>
              <label className={rotulo} htmlFor="ji">Quanto desses juros entra no parcelado</label>
              <CampoComSinal id="ji" sinal="R$" lado="antes" inputMode="numeric" value={jurosIncl} onChange={(e) => setJurosIncl(mascaraReais(e.target.value))} placeholder="0,00" />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setJurosIncl(reaisCampo(Number(previa.juros_vencidos)))} className="h-9 rounded-xl bg-superficie-2 px-3 text-xs font-bold">Tudo</button>
                <button type="button" onClick={() => setJurosIncl(reaisCampo(Math.round(Number(previa.juros_vencidos) * 50) / 100))} className="h-9 rounded-xl bg-superficie-2 px-3 text-xs font-bold">Metade</button>
                <button type="button" onClick={() => setJurosIncl('')} className="h-9 rounded-xl bg-superficie-2 px-3 text-xs font-bold">Nada (desconto)</button>
              </div>
              {incl < Number(previa.juros_vencidos) && (
                <p className="mt-1.5 text-xs text-suave">Desconto nos juros: {reais(Math.round((Number(previa.juros_vencidos) - incl) * 100) / 100)}</p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="cartao mt-4 flex flex-col gap-4 rounded-[26px] p-5 lg:p-6">
        <div>
          <label className={rotulo} htmlFor="cap">{previa ? 'Valor a parcelar' : 'Valor emprestado'}</label>
          <CampoComSinal id="cap" sinal="R$" lado="antes" inputMode="numeric" value={capital} readOnly={!!previa} onChange={(e) => setCapital(mascaraReais(e.target.value))} placeholder="1.000,00" />
        </div>

        <div>
          <span className={rotulo}>Modalidade</span>
          <div className={`mt-1.5 grid gap-1 rounded-2xl bg-superficie-2 p-1 ${previa ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {((previa ? ['diario', 'semanal', 'mensal'] : ['diario', 'semanal', 'mensal', 'recorrente']) as Modalidade[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => trocarModalidade(m)}
                aria-pressed={modalidade === m}
                className={`h-10 rounded-xl text-[13px] font-semibold transition ${modalidade === m ? 'bg-superficie text-marca' : 'text-suave'}`}
              >
                {nomeModalidade[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="juro">Juro ao mês</label>
            <CampoComSinal id="juro" sinal="%" lado="depois" inputMode="decimal" value={juroPct} onChange={(e) => digitarPct(e.target.value)} placeholder="10" />
          </div>
          <div>
            <label className={rotulo} htmlFor="jr">{recorrente ? 'Juro por mês' : 'Juro total'}</label>
            <CampoComSinal id="jr" sinal="R$" lado="antes" inputMode="numeric" value={juroValor} onChange={(e) => digitarValor(e.target.value)} placeholder="0,00" />
          </div>
        </div>
        {!cap && <p className="-mt-2 text-xs text-suave">Preencha o valor emprestado pra o juro em R$ e a porcentagem se calcularem sozinhos.</p>}

        {!recorrente && (
          <div>
            <label className={rotulo} htmlFor="qtd">
              Quantidade de parcelas <span className="font-normal text-suave">({unidade})</span>
            </label>
            <input id="qtd" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder={modalidade === 'diario' ? '20' : '10'} className={`${campo} tabular-nums`} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="ini">Dia do empréstimo</label>
            <input id="ini" type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPrimeiro(primeiroVencimentoPadrao(modalidade, e.target.value, cliente.dia_vencimento_preferido)) }} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="pv">{recorrente ? 'Vencimento' : '1º vencimento'}</label>
            <input id="pv" type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} className={campo} />
          </div>
        </div>
      </section>

      {!recorrente && (calc.empresa || calc.price || calc.sac) && (
        <section className="mt-4">
          <p className={tituloSecao}>Escolha a forma de cálculo <span className="font-medium normal-case">(o cliente não vê qual foi)</span></p>
          <div className="mt-2 flex flex-col gap-2">
            {(['empresa', 'price', 'sac'] as Sistema[]).map((s) => {
              const c = calc[s]
              if (!c) return null
              const p = c.parcelas
              const igual = p[0].valor === p[p.length - 1].valor
              const marcado = sistema === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSistema(s)}
                  aria-pressed={marcado}
                  className={`cartao flex items-center gap-3 rounded-[20px] p-4 text-left ring-2 transition ${marcado ? 'ring-marca-clara' : 'ring-transparent'}`}
                >
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${marcado ? 'verde' : 'border-2 border-borda'}`}>
                    {marcado && <Icone nome="certo" tamanho={14} />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{nomeSistema[s]}</span>
                    <span className="text-xs text-suave">Juro {reais(c.juro_total)} · Total {reais(c.total)}</span>
                  </div>
                  <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                    {igual ? `${p.length}x ${reais(p[0].valor)}` : `${reais(p[0].valor)} → ${reais(p[p.length - 1].valor)}`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {escolhido && (
        <section className="mt-4 overflow-hidden rounded-[22px] bg-linear-135 border border-[#1F4A38] from-[#0E3A2A] to-superficie to-70% p-5 text-white">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#B7F0D3]">Cliente vai pagar</span>
            <strong className="text-2xl tabular-nums">{recorrente ? `${reais(escolhido.juro_total)} /mês` : reais(escolhido.total)}</strong>
          </div>
          {!recorrente && (
            <>
              <p className="mt-1 text-xs text-suave">
                De {dataBr(escolhido.parcelas[0].vencimento)} até {dataBr(escolhido.parcelas[escolhido.parcelas.length - 1].vencimento)}
              </p>
              <button type="button" onClick={() => setVerParcelas(!verParcelas)} className="mt-3 text-sm font-semibold text-marca-brilho">
                {verParcelas ? 'Esconder parcelas' : `Ver as ${escolhido.parcelas.length} parcelas`}
              </button>
              {verParcelas && (
                <ul className="mt-2 divide-y divide-white/10 text-sm tabular-nums">
                  {escolhido.parcelas.map((p) => (
                    <li key={p.numero} className="flex justify-between gap-3 py-2">
                      <span className="text-[#B7BDC8]">{p.numero}ª · {dataBr(p.vencimento)}</span>
                      <span>
                        <strong>{reais(p.valor)}</strong> <span className="text-suave">(juro {reais(p.parte_juro)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {erro && <p role="alert" className={`${erroCaixa} mt-4`}>{erro}</p>}

      <button onClick={fazer} disabled={!escolhido || salvando} className={`${botaoVerde} mt-5 h-14 w-full text-lg`}>
        <Icone nome="moeda" />
        {salvando ? 'Salvando…' : previa ? 'Transformar em parcelado' : `Fazer empréstimo${!recorrente ? ` (${nomeSistema[sistema]})` : ''}`}
      </button>
    </Tela>
  )
}
