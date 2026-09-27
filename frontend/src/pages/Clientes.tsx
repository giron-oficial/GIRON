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
                  {c.status_cadastro}
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
