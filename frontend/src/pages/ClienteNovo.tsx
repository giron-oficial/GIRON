import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Tela from '../components/Tela'
import { cpfValido, mascaraCpf, mascaraTelefone, soDigitos } from '../lib/formatos'
import { supabase } from '../lib/supabase'

const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900'

export default function ClienteNovo() {
  const navegar = useNavigate()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nome.trim().length < 3) return setErro('Informe o nome completo.')
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.')
    const tel = soDigitos(telefone)
    if (tel.length < 10) return setErro('Telefone inválido. Use DDD + número.')
    setSalvando(true)
    const { data, error } = await supabase.rpc('cliente_criar', { p_nome_completo: nome, p_cpf: cpf, p_telefone: tel })
    setSalvando(false)
    if (error) return setErro(error.message.startsWith('Já existe') || error.message.includes('inválido') || error.message.startsWith('Sem permissão') ? error.message : 'Não foi possível salvar. Tente de novo.')
    navegar(`/clientes/${data}`, { replace: true })
  }

  return (
    <Tela titulo="Novo cliente" voltar="/clientes">
      <form onSubmit={salvar} className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium" htmlFor="nome">Nome completo</label>
        <input id="nome" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />

        <label className="mt-4 block text-sm font-medium" htmlFor="cpf">CPF</label>
        <input id="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" className={campo} />

        <label className="mt-4 block text-sm font-medium" htmlFor="tel">Telefone (WhatsApp)</label>
        <input id="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} placeholder="(63) 99999-0000" className={campo} />

        {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

        <button type="submit" disabled={salvando} className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar cliente'}
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">O CPF fica guardado criptografado.</p>
      </form>
    </Tela>
  )
}
