import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { cpfEscondido, cpfValido, linkWhatsApp, mascaraCpf, mascaraTelefone } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Cliente = {
  id: string; nome_completo: string; cpf_final: string | null; telefone: string; status_cadastro: string; criado_em: string
}

export default function ClienteFicha() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cpfCompleto, setCpfCompleto] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [erroCpf, setErroCpf] = useState('')
  const [recarregar, setRecarregar] = useState(0)

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nome_completo, cpf_final, telefone, status_cadastro, criado_em')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        setCliente(data)
        setCarregando(false)
      })
  }, [id, recarregar])

  async function salvarCpf() {
    setErroCpf('')
    if (!cpfValido(novoCpf)) return setErroCpf('CPF inválido. Confira os números.')
    const { error } = await supabase.rpc('cliente_definir_cpf', { p_cliente_id: id, p_cpf: novoCpf })
    if (error) return setErroCpf(error.message.startsWith('Já existe') ? error.message : 'Não foi possível salvar.')
    setNovoCpf('')
    setRecarregar((n) => n + 1)
  }

  async function mostrarCpf() {
    if (cpfCompleto) return setCpfCompleto('')
    const { data } = await supabase.rpc('cliente_cpf', { p_cliente_id: id })
    if (data) setCpfCompleto(mascaraCpf(data))
  }

  if (carregando) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Carregando…</p></Tela>
  if (!cliente) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Cliente não encontrado.</p></Tela>

  return (
    <Tela titulo={cliente.nome_completo} voltar="/clientes">
      <p className="mt-1 text-sm text-slate-500">
        Cadastrado em {new Date(cliente.criado_em).toLocaleDateString('pt-BR')} · {cliente.status_cadastro}
      </p>

      <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer"
         className="mt-4 block w-full rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
        💬 Chamar no WhatsApp
      </a>

      <section className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-slate-600">Telefone</span>
          <strong>{mascaraTelefone(cliente.telefone)}</strong>
        </div>
        {cliente.cpf_final ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-slate-600">CPF</span>
            <span className="flex items-center gap-2">
              <strong>{cpfCompleto || cpfEscondido(cliente.cpf_final)}</strong>
              <button onClick={mostrarCpf} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
                {cpfCompleto ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">CPF</span>
              <strong className="text-amber-700">⚠️ SEM CPF</strong>
            </div>
            <div className="mt-3 flex gap-2">
              <input inputMode="numeric" value={novoCpf} onChange={(e) => setNovoCpf(mascaraCpf(e.target.value))}
                placeholder="Completar CPF" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900" />
              <button onClick={salvarCpf} className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-white">Salvar</button>
            </div>
            {erroCpf && <p role="alert" className="mt-2 text-sm text-red-700">{erroCpf}</p>}
          </div>
        )}
      </section>

      <p className="mt-6 text-sm text-slate-500">Em breve aqui: endereço, localizações, fotos, documentos e contratos.</p>
    </Tela>
  )
}
