import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { dataBr, nomeModalidade, nomeSistema, numeroBr, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

// Novo emprestimo (RN-50 a RN-58). Ja vem preenchido com o que o cliente pediu no cadastro.
// As contas sao feitas no banco (emprestimo_simular) - a tela so mostra e deixa escolher.

type Parcela = { numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number }
type Calculo = { meses_equivalentes: number; juro_total: number; total: number; parcelas: Parcela[] }
type Modalidade = 'diario' | 'semanal' | 'mensal' | 'recorrente'
type Sistema = 'empresa' | 'price' | 'sac'

const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900'
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

export default function EmprestimoNovo() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [cliente, setCliente] = useState<{ nome_completo: string; status_cadastro: string; dia_vencimento_preferido: number | null } | null>(null)
  const [capital, setCapital] = useState('')
  const [modalidade, setModalidade] = useState<Modalidade>('mensal')
  const [juro, setJuro] = useState('10')
  const [qtd, setQtd] = useState('10')
  const [inicio, setInicio] = useState(hoje())
  const [primeiro, setPrimeiro] = useState('')
  const [sistema, setSistema] = useState<Sistema>('empresa')
  const [calc, setCalc] = useState<Partial<Record<Sistema, Calculo>>>({})
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [verParcelas, setVerParcelas] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('nome_completo, status_cadastro, valor_pretendido, modalidade_preferida, dia_vencimento_preferido').eq('id', id!).maybeSingle(),
      supabase.from('fomentado_configuracoes').select('juro_padrao_percentual').maybeSingle(),
    ]).then(([{ data: c }, { data: cfg }]) => {
      if (!c) return
      setCliente(c)
      if (c.valor_pretendido) setCapital(String(Number(c.valor_pretendido)).replace('.', ','))
      const mod = (c.modalidade_preferida ?? 'mensal') as Modalidade
      setModalidade(mod)
      if (cfg?.juro_padrao_percentual != null) setJuro(String(Number(cfg.juro_padrao_percentual)).replace('.', ','))
      setPrimeiro(primeiroVencimentoPadrao(mod, hoje(), c.dia_vencimento_preferido))
    })
  }, [id])

  function trocarModalidade(m: Modalidade) {
    setModalidade(m)
    setPrimeiro(primeiroVencimentoPadrao(m, inicio, cliente?.dia_vencimento_preferido))
    if (m === 'diario' && Number(qtd) < 15) setQtd('20')
  }

  const cap = numeroBr(capital)
  const taxa = numeroBr(juro)
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

  // Juro em R$ ligado ao % (RN-54): R$ = capital x % x meses do prazo (Forma da Empresa)
  const meses = calc.empresa?.meses_equivalentes ?? 0
  const juroReais = useMemo(() => (cap && meses ? Math.round(cap * (taxa / 100) * meses * 100) / 100 : 0), [cap, taxa, meses])
  function mudarJuroReais(v: string) {
    const j = numeroBr(v)
    if (cap && meses && !isNaN(j)) setJuro(String(Math.round((j / (cap * meses)) * 100 * 1e6) / 1e6).replace('.', ','))
  }

  async function fazer() {
    setErro('')
    if (!escolhido) return setErro('Preencha valor, juro e parcelas.')
    setSalvando(true)
    const { data, error } = await supabase.rpc('contrato_criar', {
      p_cliente_id: id, p_modalidade: modalidade, p_sistema: recorrente ? null : sistema, p_capital: cap,
      p_juro_mensal_percentual: taxa, p_quantidade: recorrente ? null : n, p_data_contrato: inicio, p_primeiro_vencimento: primeiro,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    navegar(`/contratos/${data}`, { replace: true })
  }

  if (!cliente) return <Tela voltar={`/clientes/${id}`}><p className="mt-6 text-slate-600">Carregando…</p></Tela>
  if (cliente.status_cadastro !== 'aprovado') return (
    <Tela voltar={`/clientes/${id}`}><p className="mt-6 rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Aprove o cadastro do cliente antes de fazer o empréstimo.</p></Tela>
  )

  return (
    <Tela titulo="Novo empréstimo" voltar={`/clientes/${id}`}>
      <p className="mt-1 text-slate-600">{cliente.nome_completo}</p>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="cap">Valor emprestado (R$)</label>
        <input id="cap" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="1.000,00" className={campo} />

        <span className="mt-4 block text-sm font-medium">Modalidade</span>
        <div className="mt-1 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          {(['diario', 'semanal', 'mensal', 'recorrente'] as Modalidade[]).map((m) => (
            <button key={m} type="button" onClick={() => trocarModalidade(m)}
              className={`rounded-lg py-2 text-sm font-medium ${modalidade === m ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
              {nomeModalidade[m]}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="juro">Juro ao mês (%)</label>
            <input id="juro" inputMode="decimal" value={juro} onChange={(e) => setJuro(e.target.value)} className={campo} />
          </div>
          {!recorrente ? (
            <div>
              <label className="block text-sm font-medium" htmlFor="jr">Juro total (R$)</label>
              <input id="jr" inputMode="decimal" key={juroReais} defaultValue={juroReais ? juroReais.toFixed(2).replace('.', ',') : ''}
                onBlur={(e) => mudarJuroReais(e.target.value)} className={campo} />
            </div>
          ) : (
            <div>
              <span className="block text-sm font-medium">Juro por mês</span>
              <p className="mt-1 rounded-xl bg-slate-100 px-4 py-3 font-semibold">{reais(calc.empresa?.juro_total)}</p>
            </div>
          )}
        </div>

        {!recorrente && (
          <>
            <label className="mt-4 block text-sm font-medium" htmlFor="qtd">
              Quantidade de parcelas ({modalidade === 'diario' ? 'dias' : modalidade === 'semanal' ? 'semanas' : 'meses'})
            </label>
            <input id="qtd" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/\D/g, '').slice(0, 3))} className={campo} />
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="ini">Dia do empréstimo</label>
            <input id="ini" type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPrimeiro(primeiroVencimentoPadrao(modalidade, e.target.value, cliente.dia_vencimento_preferido)) }} className={campo} />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="pv">{recorrente ? 'Vencimento' : '1º vencimento'}</label>
            <input id="pv" type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} className={campo} />
          </div>
        </div>
      </section>

      {!recorrente && (calc.empresa || calc.price || calc.sac) && (
        <section className="mt-4">
          <p className="text-sm font-semibold text-slate-500">ESCOLHA A FORMA DE CÁLCULO (o cliente não vê qual foi)</p>
          <div className="mt-2 space-y-2">
            {(['empresa', 'price', 'sac'] as Sistema[]).map((s) => {
              const c = calc[s]
              if (!c) return null
              const p = c.parcelas
              const igual = p[0].valor === p[p.length - 1].valor
              return (
                <button key={s} type="button" onClick={() => setSistema(s)}
                  className={`block w-full rounded-2xl border-2 bg-white p-4 text-left shadow-sm ${sistema === s ? 'border-emerald-500' : 'border-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <strong>{sistema === s ? '✅ ' : ''}{nomeSistema[s]}</strong>
                    <span className="font-bold">{igual ? `${p.length}x ${reais(p[0].valor)}` : `${reais(p[0].valor)} → ${reais(p[p.length - 1].valor)}`}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Juro {reais(c.juro_total)} · Total {reais(c.total)}</p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {escolhido && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Cliente vai pagar</span>
            <strong className="text-lg">{recorrente ? `${reais(escolhido.juro_total)} por mês` : reais(escolhido.total)}</strong>
          </div>
          {!recorrente && (
            <>
              <p className="mt-1 text-sm text-slate-500">
                De {dataBr(escolhido.parcelas[0].vencimento)} até {dataBr(escolhido.parcelas[escolhido.parcelas.length - 1].vencimento)}
              </p>
              <button type="button" onClick={() => setVerParcelas(!verParcelas)} className="mt-2 text-sm text-slate-600 underline">
                {verParcelas ? 'Esconder parcelas' : 'Ver todas as parcelas'}
              </button>
              {verParcelas && (
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {escolhido.parcelas.map((p) => (
                    <li key={p.numero} className="flex justify-between py-2">
                      <span>{p.numero}ª · {dataBr(p.vencimento)}</span>
                      <span><strong>{reais(p.valor)}</strong> <span className="text-slate-400">(juro {reais(p.parte_juro)})</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <button onClick={fazer} disabled={!escolhido || salvando}
        className="mt-6 w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-50">
        {salvando ? 'Salvando…' : `💰 Fazer empréstimo${!recorrente ? ` (${nomeSistema[sistema]})` : ''}`}
      </button>
    </Tela>
  )
}
