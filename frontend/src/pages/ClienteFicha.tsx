import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { cpfEscondido, linkWhatsApp, mascaraCpf, mascaraTelefone } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Cliente = {
  id: string; nome_completo: string; cpf_final: string; telefone: string; status_cadastro: string; criado_em: string
}

export default function ClienteFicha() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cpfCompleto, setCpfCompleto] = useState('')

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
  }, [id])

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
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-slate-600">CPF</span>
          <span className="flex items-center gap-2">
            <strong>{cpfCompleto || cpfEscondido(cliente.cpf_final)}</strong>
            <button onClick={mostrarCpf} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
              {cpfCompleto ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
        </div>
      </section>

      <p className="mt-6 text-sm text-slate-500">Em breve aqui: endereço, localizações, fotos, documentos e contratos.</p>
    </Tela>
  )
}
