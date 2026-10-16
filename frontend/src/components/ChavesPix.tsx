import { useEffect, useState } from 'react'
import { Grupo } from './Ajustes'
import Icone from './Icone'
import { erroCaixa } from './estilo'
import { supabase } from '../lib/supabase'

// Chaves Pix do Fomentado (regra 5.9): até 5, numeradas Pix 1 a Pix 5, uma é a padrão.
// A padrão sai nas cobranças e no extrato; as outras o dono escolhe na hora ("cobra no Pix 2").
// Cada ação (adicionar, tirar, tornar padrão) já grava no banco na hora.

type Tipo = 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria'
type Chave = { numero: number; tipo: Tipo; chave: string; padrao: boolean }
const tipos: [Tipo, string][] = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']]
const nomeTipo = Object.fromEntries(tipos) as Record<Tipo, string>

export default function ChavesPix({ tenant }: { tenant: string | null }) {
  const [lista, setLista] = useState<Chave[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abrindo, setAbrindo] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('cpf')
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function recarregar() {
    const { data } = await supabase.from('chaves_pix').select('numero, tipo, chave, padrao').order('numero')
    setLista((data ?? []) as Chave[])
    setCarregando(false)
  }
  useEffect(() => { recarregar() }, [])

  async function roda(acao: () => Promise<unknown>) {
    if (!tenant) return setErro('Sua conta ainda não está ligada a uma empresa.')
    setErro(''); setOcupado(true)
    try { await acao(); await recarregar() } catch { setErro('Não foi possível salvar. Tente de novo.') } finally { setOcupado(false) }
  }
  const falhou = (r: { error: unknown }) => { if (r.error) throw r.error }

  const adicionar = () => roda(async () => {
    const texto = chave.trim()
    if (!texto) throw new Error('vazia')
    const numero = [1, 2, 3, 4, 5].find((n) => !lista.some((c) => c.numero === n))!
    falhou(await supabase.from('chaves_pix').insert({ tenant_id: tenant, numero, tipo, chave: texto, padrao: lista.length === 0 }))
    setChave(''); setAbrindo(false)
  })
  const tirar = (c: Chave) => roda(async () => {
    falhou(await supabase.from('chaves_pix').delete().eq('tenant_id', tenant!).eq('numero', c.numero))
    const resto = lista.filter((x) => x.numero !== c.numero)
    if (c.padrao && resto.length) falhou(await supabase.from('chaves_pix').update({ padrao: true }).eq('tenant_id', tenant!).eq('numero', resto[0].numero))
  })
  const tornarPadrao = (c: Chave) => roda(async () => {
    falhou(await supabase.from('chaves_pix').update({ padrao: false }).eq('tenant_id', tenant!).eq('padrao', true))
    falhou(await supabase.from('chaves_pix').update({ padrao: true }).eq('tenant_id', tenant!).eq('numero', c.numero))
  })

  return (
    <Grupo icone="pix" titulo="Chaves Pix" descricao="A padrão sai nas cobranças e no extrato. Até 5." cor="text-hoje bg-hoje/15">
      {carregando ? (
        <div className="m-4 h-14 animate-pulse rounded-xl bg-superficie-2" />
      ) : lista.length === 0 && !abrindo ? (
        <p className="px-4 py-4 text-sm text-suave lg:px-5">Nenhuma chave ainda. Sem chave, o extrato sai sem Pix.</p>
      ) : (
        lista.map((c) => (
          <div key={c.numero} className="flex items-center gap-3 px-4 py-3 lg:px-5">
            <span className="w-11 shrink-0 text-center text-[11px] font-extrabold tracking-wide text-suave">PIX {c.numero}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{c.chave}</p>
              <p className="text-xs text-suave">{nomeTipo[c.tipo]}{c.padrao && <span className="ml-2 rounded-md bg-marca/15 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-marca uppercase">Padrão</span>}</p>
            </div>
            {!c.padrao && (
              <button type="button" disabled={ocupado} onClick={() => tornarPadrao(c)} className="h-9 shrink-0 rounded-lg bg-superficie-2 px-3 text-xs font-bold text-texto disabled:opacity-50">
                Tornar padrão
              </button>
            )}
            <button type="button" aria-label={`Tirar Pix ${c.numero}`} disabled={ocupado} onClick={() => tirar(c)} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-suave hover:bg-vencido/15 hover:text-vencido disabled:opacity-50">
              <Icone nome="lixeira" tamanho={17} />
            </button>
          </div>
        ))
      )}

      {abrindo ? (
        <div className="flex flex-col gap-3 bg-superficie-2/40 px-4 py-4 lg:px-5">
          <div className="flex flex-wrap gap-1.5">
            {tipos.map(([v, t]) => (
              <button key={v} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v}
                className={`h-9 rounded-full px-3.5 text-xs font-bold transition ${tipo === v ? 'verde' : 'bg-superficie-2 text-suave'}`}>
                {t}
              </button>
            ))}
          </div>
          <input
            autoFocus value={chave} onChange={(e) => setChave(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionar()}
            inputMode={tipo === 'email' || tipo === 'aleatoria' ? 'text' : 'numeric'} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder={{ cpf: '000.000.000-00', cnpj: '00.000.000/0000-00', telefone: '63 99999-9999', email: 'nome@email.com', aleatoria: 'cole a chave aleatória' }[tipo]}
            className="h-12 w-full rounded-xl border border-borda bg-superficie px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-suave/60 focus:border-marca focus:ring-4 focus:ring-marca/15"
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setAbrindo(false); setChave(''); setErro('') }} className="h-11 rounded-xl bg-superficie-2 text-sm font-semibold text-suave">Cancelar</button>
            <button type="button" disabled={ocupado || !chave.trim()} onClick={adicionar} className="verde h-11 rounded-xl text-sm font-extrabold disabled:opacity-60">Adicionar</button>
          </div>
        </div>
      ) : lista.length < 5 && !carregando ? (
        <button type="button" onClick={() => setAbrindo(true)} className="flex h-12 w-full items-center gap-2 px-4 text-sm font-bold text-marca lg:px-5">
          <Icone nome="mais" tamanho={18} />
          Adicionar chave
        </button>
      ) : null}
      {erro && <p role="alert" className={`${erroCaixa} m-4 rounded-xl`}>{erro}</p>}
    </Grupo>
  )
}
