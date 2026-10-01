import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoVerde, campo, erroCaixa, rotulo } from '../components/estilo'
import { cpfValido, mascaraCpf, mascaraTelefone, soDigitos } from '../lib/formatos'
import { supabase } from '../lib/supabase'

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
    if (cpf && !cpfValido(cpf)) return setErro('CPF inválido. Confira os números ou deixe em branco.')
    const tel = soDigitos(telefone)
    if (tel.length < 10) return setErro('Telefone inválido. Use DDD + número.')
    setSalvando(true)
    const { data, error } = await supabase.rpc('cliente_criar', { p_nome_completo: nome, p_cpf: cpf, p_telefone: tel })
    setSalvando(false)
    if (error) return setErro(error.message.startsWith('Já existe') || error.message.includes('inválido') || error.message.startsWith('Sem permissão') ? error.message : 'Não foi possível salvar. Tente de novo.')
    navegar(`/clientes/${data}`, { replace: true })
  }

  return (
    <Tela titulo="Novo cliente" subtitulo="Cadastro rápido. O resto dá pra completar depois." voltar="/clientes">
      <form onSubmit={salvar} className="cartao mt-4 flex flex-col gap-4 rounded-[26px] p-5 lg:p-7">
        <div>
          <label className={rotulo} htmlFor="nome">Nome completo</label>
          <input id="nome" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Maria Souza da Silva" className={campo} />
        </div>

        <div>
          <label className={rotulo} htmlFor="tel">Telefone (WhatsApp)</label>
          <input id="tel" inputMode="tel" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} placeholder="(63) 99999-0000" className={campo} />
        </div>

        <div>
          <label className={rotulo} htmlFor="cpf">
            CPF <span className="font-normal text-suave">(se tiver)</span>
          </label>
          <input id="cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" className={campo} />
          <p className="mt-1.5 text-xs text-suave">Sem CPF? Deixe em branco e complete depois na ficha.</p>
        </div>

        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}

        <button type="submit" disabled={salvando} className={`${botaoVerde} mt-1 w-full`}>
          <Icone nome="certo" tamanho={18} />
          {salvando ? 'Salvando…' : 'Salvar cliente'}
        </button>
        <p className="text-center text-xs text-suave">O CPF fica guardado criptografado.</p>
      </form>
    </Tela>
  )
}
