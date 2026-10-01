import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoClaro, botaoVerde, iniciais, seloCadastro } from '../components/estilo'
import { cpfEscondido, mascaraTelefone, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Cliente = {
  id: string
  nome_completo: string
  cpf_final: string | null
  telefone: string
  status_cadastro: string
  contratos: { status: string; capital_em_aberto: number }[]
}

type Filtro = 'todos' | 'aprovado' | 'pendente' | 'reprovado'
const filtros: { id: Filtro; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'aprovado', texto: 'Aprovados' },
  { id: 'pendente', texto: 'Esperando' },
  { id: 'reprovado', texto: 'Reprovados' },
]

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
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
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      setErroLink('Não deu pra copiar sozinho. Segure o dedo no link e copie.')
    }
  }

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nome_completo, cpf_final, telefone, status_cadastro, contratos(status, capital_em_aberto)')
      .order('nome_completo')
      .then(({ data }) => {
        setClientes((data ?? []) as Cliente[])
        setCarregando(false)
      })
  }, [])

  const termo = busca.trim().toLowerCase()
  const doFiltro = filtro === 'todos' ? clientes : clientes.filter((c) => c.status_cadastro === filtro)
  const lista = termo
    ? doFiltro.filter((c) => c.nome_completo.toLowerCase().includes(termo) || (c.cpf_final ?? '').includes(termo) || c.telefone.includes(termo))
    : doFiltro
  const quantos = (f: Filtro) => (f === 'todos' ? clientes.length : clientes.filter((c) => c.status_cadastro === f).length)

  return (
    <Tela
      titulo="Clientes"
      subtitulo={carregando ? 'Carregando…' : `${clientes.length} ${clientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}`}
      largo
      acoes={
        <div className="hidden gap-2 lg:flex">
          <button onClick={gerarLink} className={botaoClaro}>
            <Icone nome="link" tamanho={18} />
            Link de cadastro
          </button>
          <Link to="/clientes/novo" className={botaoVerde}>
            <Icone nome="mais" tamanho={18} />
            Novo cliente
          </Link>
        </div>
      }
    >
      <div className="mt-4 grid grid-cols-2 gap-2 lg:hidden">
        <Link to="/clientes/novo" className={botaoVerde}>
          <Icone nome="mais" tamanho={18} />
          Novo cliente
        </Link>
        <button onClick={gerarLink} className={botaoClaro}>
          <Icone nome="link" tamanho={18} />
          Link
        </button>
      </div>

      {erroLink && <p className="mt-3 text-sm font-semibold text-vencido">{erroLink}</p>}
      {link && (
        <div className="cartao mt-3 flex flex-col gap-3 rounded-[22px] p-4 lg:max-w-xl">
          <div>
            <p className="text-sm font-bold">Link de cadastro pronto</p>
            <p className="text-xs text-suave">Vale 7 dias e só pode ser usado uma vez.</p>
          </div>
          <p className="rounded-xl bg-superficie-2 px-3 py-2 text-sm font-medium break-all">{link}</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent('Olá! Para fazer seu cadastro, preencha por este link: ' + link)}`}
              target="_blank"
              rel="noreferrer"
              className={`${botaoVerde} h-11`}
            >
              <Icone nome="whatsapp" tamanho={18} />
              WhatsApp
            </a>
            <button onClick={copiar} className={`${botaoClaro} h-11 bg-superficie-2 shadow-none`}>
              <Icone nome={copiado ? 'certo' : 'copiar'} tamanho={18} />
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label htmlFor="busca-clientes" className="cartao flex h-12 flex-1 items-center gap-2.5 rounded-2xl px-4 text-suave lg:max-w-md">
          <Icone nome="lupa" tamanho={18} />
          <input
            id="busca-clientes"
            type="search"
            placeholder="Buscar por nome, telefone ou final do CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent text-base text-texto outline-none placeholder:text-[#A0A6B1]"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          {filtros.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                filtro === f.id ? 'bg-tinta text-white' : 'cartao text-suave hover:text-texto'
              }`}
            >
              {f.texto}
              <span className={`text-xs ${filtro === f.id ? 'text-white/60' : 'text-[#A0A6B1]'}`}>{quantos(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid gap-2 lg:grid-cols-2 lg:gap-3">
        {lista.map((c) => {
          const selo = seloCadastro[c.status_cadastro] ?? seloCadastro.pendente
          const ativos = c.contratos.filter((k) => k.status === 'ativo')
          const aberto = ativos.reduce((t, k) => t + Number(k.capital_em_aberto), 0)
          return (
            <li key={c.id}>
              <Link to={`/clientes/${c.id}`} className="cartao flex items-center gap-3 rounded-[20px] p-3 transition hover:shadow-lg active:scale-[0.99]">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-[14px] text-sm font-extrabold ${selo.avatar}`}>{iniciais(c.nome_completo)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-bold">{c.nome_completo}</span>
                  <span className="truncate text-xs text-suave">
                    {mascaraTelefone(c.telefone)} · {c.cpf_final ? `CPF ${cpfEscondido(c.cpf_final)}` : 'sem CPF'}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.status_cadastro === 'aprovado' && ativos.length > 0 ? (
                    <>
                      <span className="text-sm font-bold tabular-nums">{reais(aberto).replace(',00', '')}</span>
                      <span className="text-[11px] text-suave">
                        {ativos.length} {ativos.length === 1 ? 'contrato' : 'contratos'}
                      </span>
                    </>
                  ) : (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selo.classe}`}>{selo.texto}</span>
                  )}
                </div>
                <Icone nome="seta" tamanho={16} className="shrink-0 text-[#A0A6B1]" />
              </Link>
            </li>
          )
        })}
      </ul>

      {!carregando && lista.length === 0 && (
        <div className="cartao mt-2 flex flex-col items-center gap-2 rounded-[22px] p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-superficie-2 text-suave">
            <Icone nome="clientes" />
          </span>
          <p className="font-bold">{clientes.length === 0 ? 'Nenhum cliente ainda' : 'Ninguém encontrado'}</p>
          <p className="text-sm text-suave">
            {clientes.length === 0 ? 'Toque em "Novo cliente" ou mande um link de cadastro.' : 'Tente outro nome, telefone ou filtro.'}
          </p>
        </div>
      )}
    </Tela>
  )
}
