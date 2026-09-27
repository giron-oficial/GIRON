import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { dataBr, nomeModalidade, nomeSistema, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Parcela = { id: string; numero: number; vencimento: string; valor: number; parte_juro: number; status: string }
type ContratoT = {
  id: string; numero: number; modalidade: string; sistema_calculo: string | null; capital: number; juro_percentual: number
  juro_valor: number; quantidade_parcelas: number | null; data_contrato: string; status: string; capital_em_aberto: number
  cliente_id: string; clientes: { nome_completo: string } | null; parcelas: Parcela[]
}

const seloParcela: Record<string, string> = { aberta: '⚪ aberta', paga: '✅ paga', parcial: '🟡 parcial' }

export default function Contrato() {
  const { id } = useParams()
  const [c, setC] = useState<ContratoT | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase
      .from('contratos')
      .select(`id, numero, modalidade, sistema_calculo, capital, juro_percentual, juro_valor, quantidade_parcelas, data_contrato,
               status, capital_em_aberto, cliente_id, clientes(nome_completo), parcelas(id, numero, vencimento, valor, parte_juro, status)`)
      .eq('id', id!)
      .order('numero', { referencedTable: 'parcelas' })
      .maybeSingle()
      .then(({ data }) => {
        setC(data as unknown as ContratoT | null)
        setCarregando(false)
      })
  }, [id])

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
            <li key={p.id} className="flex items-center justify-between py-3">
              <span>
                <strong>{p.numero}ª</strong> · {dataBr(p.vencimento)}
                <span className="ml-2 text-xs text-slate-500">{seloParcela[p.status] ?? p.status}</span>
              </span>
              <strong>{reais(p.valor)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-6 text-sm text-slate-500">Em breve aqui: registrar pagamento, estorno e bolinhas de vencimento.</p>
    </Tela>
  )
}
