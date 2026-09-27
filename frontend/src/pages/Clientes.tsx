import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Tela from '../components/Tela'
import { cpfEscondido, mascaraTelefone } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Cliente = { id: string; nome_completo: string; cpf_final: string | null; telefone: string; status_cadastro: string }

const selo: Record<string, string> = {
  pendente: 'bg-amber-100 text-amber-800',
  aprovado: 'bg-emerald-100 text-emerald-800',
  reprovado: 'bg-red-100 text-red-800',
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [link, setLink] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [erroLink, setErroLink] = useState('')

  async function gerarLink() {
    setErroLink('')
    setCopiado(false)
    const { data, error } = await supabase.rpc('link_cadastro_criar')
    if (error) return setErroLink('Não foi possível gerar o link.')
    setLink(`${window.location.origin}/c/${data}`)
  }

  async function copiar() {
    await navigator.clipboard.writeText(link)
    setCopiado(true)
  }

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nome_completo, cpf_final, telefone, status_cadastro')
      .order('nome_completo')
      .then(({ data }) => {
        setClientes(data ?? [])
        setCarregando(false)
      })
  }, [])

  const termo = busca.trim().toLowerCase()
  const lista = termo
    ? clientes.filter((c) => c.nome_completo.toLowerCase().includes(termo) || (c.cpf_final ?? '').includes(termo) || c.telefone.includes(termo))
    : clientes

  return (
    <Tela titulo="Clientes" voltar="/">
      <Link to="/clientes/novo" className="mt-4 block w-full rounded-xl bg-slate-900 py-3 text-center font-semibold text-white">
        + Novo cliente
      </Link>
      <button onClick={gerarLink} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-3 text-center font-semibold">
        📨 Gerar link de cadastro
      </button>
      {erroLink && <p className="mt-2 text-sm text-red-700">{erroLink}</p>}
      {link && (
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Link novo (vale 7 dias, uma vez só):</p>
          <p className="mt-1 break-all text-sm font-medium">{link}</p>
          <div className="mt-3 flex gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent('Olá! Para fazer seu cadastro, preencha por este link: ' + link)}`} target="_blank" rel="noreferrer"
               className="flex-1 rounded-xl bg-emerald-600 py-2 text-center font-semibold text-white">💬 WhatsApp</a>
            <button onClick={copiar} className="flex-1 rounded-xl border border-slate-300 py-2 font-semibold">{copiado ? '✅ Copiado' : '📋 Copiar'}</button>
          </div>
        </div>
      )}
      <input
        type="search" placeholder="Buscar por nome, telefone ou final do CPF" value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900"
      />
      <p className="mt-3 text-sm text-slate-500">
        {carregando ? 'Carregando…' : `${lista.length} de ${clientes.length} cliente(s)`}
      </p>
      <ul className="mt-2 space-y-2">
        {lista.map((c) => (
          <li key={c.id}>
            <Link to={`/clientes/${c.id}`} className="block rounded-2xl bg-white p-4 shadow-sm active:bg-slate-100">
              <div className="flex items-start justify-between gap-3">
                <strong className="leading-tight">{c.nome_completo}</strong>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${selo[c.status_cadastro] ?? ''}`}>
                  {{ pendente: '🟡 pendente', aprovado: '✅ aprovado', reprovado: '❌ reprovado' }[c.status_cadastro] ?? c.status_cadastro}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {mascaraTelefone(c.telefone)} · {c.cpf_final ? `CPF ${cpfEscondido(c.cpf_final)}` : '⚠️ sem CPF'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!carregando && clientes.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm">Nenhum cliente ainda. Toque em “Novo cliente”.</p>
      )}
    </Tela>
  )
}
