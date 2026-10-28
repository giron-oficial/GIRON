import { useState, type FormEvent } from 'react'
import { mascaraTelefone, soDigitos } from '../lib/formatos'
import { supabase } from '../lib/supabase'
import Icone from './Icone'
import { botaoVerde, campo, erroCaixa, rotulo, tituloSecao } from './estilo'

// Janela "Editar dados" da ficha do cliente: nome, telefone, endereço, trabalho e indicação.
// O CPF tem o caminho dele (completar na própria ficha). O banco só deixa a empresa mexer nos clientes dela.

export type DadosCliente = {
  id: string
  nome_completo: string
  telefone: string
  endereco: string | null
  cep: string | null
  trabalho_empresa: string | null
  trabalho_endereco: string | null
  trabalho_telefone: string | null
  trabalho_referencia: string | null
  indicado_por: string | null
}

const mascaraCep = (t: string) => {
  const d = soDigitos(t).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

const vazioViraNulo = (t: string) => (t.trim() ? t.trim() : null)

export default function EditarCliente({ cliente, fechar, salvo }: { cliente: DadosCliente; fechar: () => void; salvo: () => void }) {
  const [v, setV] = useState({
    nome: cliente.nome_completo,
    telefone: mascaraTelefone(cliente.telefone),
    endereco: cliente.endereco ?? '',
    cep: cliente.cep ? mascaraCep(cliente.cep) : '',
    empresa: cliente.trabalho_empresa ?? '',
    trabEndereco: cliente.trabalho_endereco ?? '',
    trabTelefone: cliente.trabalho_telefone ? mascaraTelefone(cliente.trabalho_telefone) : '',
    referencia: cliente.trabalho_referencia ?? '',
    indicado: cliente.indicado_por ?? '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const muda = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value })

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const tel = soDigitos(v.telefone)
    if (v.nome.trim().split(/\s+/).length < 2) return setErro('Escreva o nome completo do cliente.')
    if (tel.length < 10) return setErro('Telefone incompleto: coloque o DDD e o número.')
    setErro('')
    setSalvando(true)
    const { error } = await supabase
      .from('clientes')
      .update({
        nome_completo: v.nome.trim(),
        telefone: tel,
        endereco: vazioViraNulo(v.endereco),
        cep: vazioViraNulo(v.cep),
        trabalho_empresa: vazioViraNulo(v.empresa),
        trabalho_endereco: vazioViraNulo(v.trabEndereco),
        trabalho_telefone: vazioViraNulo(soDigitos(v.trabTelefone)),
        trabalho_referencia: vazioViraNulo(v.referencia),
        indicado_por: vazioViraNulo(v.indicado),
      })
      .eq('id', cliente.id)
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Confira a internet e tente de novo.')
    salvo()
  }

  const campoTexto = (id: keyof typeof v, titulo: string, extra: Record<string, string> = {}) => (
    <div>
      <label className={rotulo} htmlFor={`ed-${id}`}>{titulo}</label>
      <input id={`ed-${id}`} value={v[id]} onChange={muda(id)} className={campo} {...extra} />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={fechar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Editar dados do cliente"
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="cartao flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-[18px] p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-bold">Editar dados</span>
          <button type="button" onClick={fechar} aria-label="Fechar" className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-xl text-suave hover:bg-white/5">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>

        {campoTexto('nome', 'Nome completo', { autoComplete: 'off' })}
        <div>
          <label className={rotulo} htmlFor="ed-telefone">Telefone (WhatsApp)</label>
          <input id="ed-telefone" inputMode="tel" value={v.telefone} onChange={(e) => setV({ ...v, telefone: mascaraTelefone(e.target.value) })} placeholder="(63) 99999-0000" className={campo} />
        </div>
        {campoTexto('endereco', 'Endereço', { placeholder: 'Rua, número, bairro, cidade' })}
        <div>
          <label className={rotulo} htmlFor="ed-cep">CEP</label>
          <input id="ed-cep" inputMode="numeric" value={v.cep} onChange={(e) => setV({ ...v, cep: mascaraCep(e.target.value) })} placeholder="77800-000" className={campo} />
        </div>
        {campoTexto('indicado', 'Indicado por')}

        <p className={`${tituloSecao} mt-1`}>Trabalho</p>
        {campoTexto('empresa', 'Empresa')}
        {campoTexto('trabEndereco', 'Endereço do trabalho')}
        <div>
          <label className={rotulo} htmlFor="ed-trabTelefone">Telefone do trabalho</label>
          <input id="ed-trabTelefone" inputMode="tel" value={v.trabTelefone} onChange={(e) => setV({ ...v, trabTelefone: mascaraTelefone(e.target.value) })} placeholder="(63) 3411-0000" className={campo} />
        </div>
        {campoTexto('referencia', 'Referência')}

        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}
        <button type="submit" disabled={salvando} className={`${botaoVerde} sticky bottom-0`}>
          <Icone nome="certo" tamanho={18} />
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </div>
  )
}
