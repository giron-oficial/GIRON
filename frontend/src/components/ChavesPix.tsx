import { useEffect, useState } from 'react'
import Icone from './Icone'
import { botaoVerde, campo, erroCaixa, rotulo, tituloSecao } from './estilo'
import { supabase } from '../lib/supabase'

// Chaves Pix do Fomentado (regra 5.9): até 5, numeradas Pix 1 a Pix 5, uma é a padrão.
// A padrão sai nas mensagens de cobrança e no extrato; as outras o dono escolhe na hora ("cobra no Pix 2").

type Tipo = 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria'
type Slot = { numero: number; tipo: Tipo; chave: string; existe: boolean }
const tipos: [Tipo, string][] = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']]
const vazio = (n: number): Slot => ({ numero: n, tipo: 'cpf', chave: '', existe: false })

export default function ChavesPix({ tenant }: { tenant: string | null }) {
  const [slots, setSlots] = useState<Slot[]>([1, 2, 3, 4, 5].map(vazio))
  const [padrao, setPadrao] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('chaves_pix').select('numero, tipo, chave, padrao').order('numero').then(({ data }) => {
      const lista = (data ?? []) as { numero: number; tipo: Tipo; chave: string; padrao: boolean }[]
      setSlots([1, 2, 3, 4, 5].map((n) => {
        const c = lista.find((x) => x.numero === n)
        return c ? { numero: n, tipo: c.tipo, chave: c.chave, existe: true } : vazio(n)
      }))
      const p = lista.find((x) => x.padrao)
      if (p) setPadrao(p.numero)
      setCarregando(false)
    })
  }, [])

  const muda = (n: number, k: 'tipo' | 'chave', v: string) => setSlots((xs) => xs.map((s) => (s.numero === n ? { ...s, [k]: v } : s)))
  const preenchidos = slots.filter((s) => s.chave.trim())

  async function salvar() {
    setErro(''); setSalvo(false)
    if (!tenant) return setErro('Sua conta ainda não está ligada a uma empresa.')
    if (preenchidos.length > 0 && !preenchidos.some((s) => s.numero === padrao)) return setErro('Marque qual chave é a padrão (uma que esteja preenchida).')
    setSalvando(true)
    try {
      // 1) apaga as que ficaram vazias; 2) grava todas sem "padrão"; 3) marca a padrão (o banco só aceita uma)
      const apagar = slots.filter((s) => s.existe && !s.chave.trim()).map((s) => s.numero)
      if (apagar.length) {
        const { error } = await supabase.from('chaves_pix').delete().in('numero', apagar).eq('tenant_id', tenant)
        if (error) throw error
      }
      if (preenchidos.length) {
        const { error } = await supabase.from('chaves_pix').upsert(
          preenchidos.map((s) => ({ tenant_id: tenant, numero: s.numero, tipo: s.tipo, chave: s.chave.trim(), padrao: false })),
          { onConflict: 'tenant_id,numero' },
        )
        if (error) throw error
        const { error: e2 } = await supabase.from('chaves_pix').update({ padrao: true }).eq('tenant_id', tenant).eq('numero', padrao)
        if (e2) throw e2
      }
      setSlots((xs) => xs.map((s) => ({ ...s, chave: s.chave.trim(), existe: !!s.chave.trim() })))
      setSalvo(true)
    } catch {
      setErro('Não foi possível salvar as chaves. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="cartao mt-3 flex flex-col gap-4 rounded-[22px] p-5 lg:p-6">
      <div>
        <h2 className={tituloSecao}>Chaves Pix</h2>
        <p className="mt-1 text-xs text-suave">Até 5 chaves. A <strong className="text-texto">padrão</strong> sai nas cobranças e no extrato. As outras você escolhe na hora de cobrar ("manda o Pix 2").</p>
      </div>
      {carregando ? (
        <div className="h-40 animate-pulse rounded-2xl bg-superficie-2" />
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map((s) => (
            <div key={s.numero} className={`rounded-2xl p-3 ${s.chave ? 'bg-superficie-2' : 'bg-superficie-2/40'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Pix {s.numero}</span>
                <label className={`flex cursor-pointer items-center gap-1.5 text-xs font-semibold ${padrao === s.numero && s.chave ? 'text-marca' : 'text-suave'}`}>
                  <input type="radio" name="pix-padrao" checked={padrao === s.numero} onChange={() => setPadrao(s.numero)} disabled={!s.chave.trim()} className="accent-marca" />
                  padrão
                </label>
              </div>
              <div className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                <div>
                  <label className={`${rotulo} sr-only`} htmlFor={`pt${s.numero}`}>Tipo</label>
                  <select id={`pt${s.numero}`} value={s.tipo} onChange={(e) => muda(s.numero, 'tipo', e.target.value)} className={`${campo} mt-0`}>
                    {tipos.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`${rotulo} sr-only`} htmlFor={`pc${s.numero}`}>Chave</label>
                  <input id={`pc${s.numero}`} value={s.chave} onChange={(e) => muda(s.numero, 'chave', e.target.value)} placeholder={s.numero === 1 ? 'Sua chave Pix' : 'Vazio = não usa'} className={`${campo} mt-0`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {erro && <p role="alert" className={erroCaixa}>{erro}</p>}
      {salvo && <p className="rounded-2xl bg-marca/15 px-4 py-3 text-sm font-semibold text-marca">Chaves salvas.</p>}
      <button type="button" onClick={salvar} disabled={salvando || carregando} className={`${botaoVerde} w-full`}>
        <Icone nome="certo" tamanho={18} />
        {salvando ? 'Salvando…' : 'Salvar chaves Pix'}
      </button>
    </section>
  )
}
