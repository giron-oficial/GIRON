import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { seloContrato } from '../components/estilo'
import { regraDaConfig } from '../lib/atraso'
import { dataBr, idCliente, idContrato, lerId, nomeModalidade, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Linha = {
  id: string
  numero: number
  modalidade: string
  capital: number
  capital_em_aberto: number
  status: string
  data_contrato: string
  clientes: { numero: number; nome_completo: string } | null
  parcelas: { vencimento: string; status: string }[]
}

// Situação do contrato pela parcela em aberto mais antiga
type Situacao = 'critico' | 'vencido' | 'hoje' | 'amanha' | 'emdia'
const selos: Record<Situacao, { texto: string; classe: string }> = {
  critico: { texto: 'Crítico', classe: 'bg-critico/15 text-critico' },
  vencido: { texto: 'Vencido', classe: 'bg-vencido/15 text-vencido' },
  hoje: { texto: 'Vence hoje', classe: 'bg-hoje/15 text-hoje' },
  amanha: { texto: 'Vence amanhã', classe: 'bg-amanha/15 text-amanha' },
  emdia: { texto: 'Em dia', classe: 'bg-marca/15 text-marca' },
}
const ordem: Record<Situacao, number> = { critico: 0, vencido: 1, hoje: 2, amanha: 3, emdia: 4 }

type Filtro = 'ativos' | 'atrasados' | 'quitados' | 'todos'
const filtros: { id: Filtro; texto: string }[] = [
  { id: 'ativos', texto: 'Ativos' },
  { id: 'atrasados', texto: 'Atrasados' },
  { id: 'quitados', texto: 'Quitados' },
  { id: 'todos', texto: 'Todos' },
]

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)

export default function Contratos() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [diasCritico, setDiasCritico] = useState(2)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([
      supabase
        .from('contratos')
        .select('id, numero, modalidade, capital, capital_em_aberto, status, data_contrato, clientes(numero, nome_completo), parcelas(vencimento, status)')
        .order('data_contrato', { ascending: false }),
      supabase.from('fomentado_configuracoes').select('dias_para_critico').maybeSingle(),
    ]).then(([c, cfg]) => {
      if (c.error) setErro('Não foi possível carregar os contratos. Confira sua internet e tente de novo.')
      setLinhas((c.data ?? []) as unknown as Linha[])
      setDiasCritico(regraDaConfig(cfg.data).diasCritico)
      setCarregando(false)
    })
  }, [])

  const hoje = iso(new Date())
  const info = linhas.map((k) => {
    const abertas = k.parcelas.filter((p) => p.status !== 'paga').map((p) => p.vencimento).sort()
    const proximo = abertas[0] ?? null
    let situacao: Situacao = 'emdia'
    if (k.status === 'ativo' && proximo) {
      const atraso = diasEntre(proximo, hoje)
      situacao = atraso >= diasCritico ? 'critico' : atraso >= 1 ? 'vencido' : atraso === 0 ? 'hoje' : atraso === -1 ? 'amanha' : 'emdia'
    }
    return { ...k, proximo, situacao }
  })

  const ativos = info.filter((k) => k.status === 'ativo')
  const grupos: Record<Filtro, typeof info> = {
    ativos,
    atrasados: ativos.filter((k) => k.situacao === 'critico' || k.situacao === 'vencido'),
    quitados: info.filter((k) => k.status === 'quitado'),
    todos: info,
  }

  const porId = lerId(busca)
  const termo = busca.trim().toLowerCase()
  // Buscando por ID, procura em todos os contratos (não só no filtro escolhido)
  const lista = porId
    ? info.filter((k) => k.clientes?.numero === porId.cliente && (porId.contrato === undefined || k.numero === porId.contrato))
    : grupos[filtro]
        .filter((k) => !termo || (k.clientes?.nome_completo ?? '').toLowerCase().includes(termo))
        .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.proximo ?? '9').localeCompare(b.proximo ?? '9'))

  const naRua = ativos.reduce((t, k) => t + Number(k.capital_em_aberto), 0)

  return (
    <Tela
      titulo="Contratos"
      subtitulo={carregando ? 'Carregando…' : `${ativos.length} ${ativos.length === 1 ? 'ativo' : 'ativos'} · ${reais(naRua)} na rua`}
      largo
    >
      {erro && <p className="mt-3 text-sm font-semibold text-vencido">{erro}</p>}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label htmlFor="busca-contratos" className="cartao flex h-12 flex-1 items-center gap-2.5 rounded-2xl px-4 text-suave lg:max-w-md">
          <Icone nome="lupa" tamanho={18} />
          <input
            id="busca-contratos"
            type="search"
            placeholder="Buscar por nome ou #ID (ex.: #20 CT-02)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent text-base text-texto outline-none placeholder:text-suave"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          {filtros.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${
                filtro === f.id ? 'verde font-bold' : 'cartao text-suave hover:text-texto'
              }`}
            >
              {f.texto}
              <span className={`text-xs ${filtro === f.id ? 'text-sobre-verde/60' : 'text-suave'}`}>{grupos[f.id].length}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 grid gap-2 lg:grid-cols-2 lg:gap-3">
        {lista.map((k) => {
          const selo = k.status === 'ativo' ? selos[k.situacao] : (seloContrato[k.status] ?? seloContrato.ativo)
          return (
            <li key={k.id}>
              <Link to={`/contratos/${k.id}`} className="cartao flex items-center gap-3 rounded-[20px] p-3 transition hover:border-marca/40 active:scale-[0.99]">
                <span className="flex h-11 shrink-0 items-center justify-center rounded-[14px] bg-superficie-2 px-2.5 text-xs font-extrabold tabular-nums">
                  {idContrato(k.numero)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-bold">{k.clientes?.nome_completo ?? 'Cliente'}</span>
                  <span className="text-xs font-bold text-texto/80 tabular-nums">{k.clientes ? idCliente(k.clientes.numero) : ''}</span>
                  <span className="truncate text-xs text-suave">
                    {nomeModalidade[k.modalidade] ?? k.modalidade} · {reais(k.capital)}
                    {k.status === 'ativo' && k.proximo ? ` · vence ${dataBr(k.proximo)}` : ` · ${dataBr(k.data_contrato)}`}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {k.status === 'ativo' && <span className="text-sm font-bold tabular-nums">{reais(k.capital_em_aberto).replace(',00', '')}</span>}
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selo.classe}`}>{selo.texto}</span>
                </div>
                <Icone nome="seta" tamanho={16} className="shrink-0 text-suave" />
              </Link>
            </li>
          )
        })}
      </ul>

      {!carregando && lista.length === 0 && (
        <div className="cartao mt-2 flex flex-col items-center gap-2 rounded-[22px] p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-superficie-2 text-suave">
            <Icone nome="contratos" />
          </span>
          <p className="font-bold">{linhas.length === 0 ? 'Nenhum contrato ainda' : 'Nenhum contrato encontrado'}</p>
          <p className="text-sm text-suave">
            {linhas.length === 0 ? 'Abra a ficha de um cliente aprovado e faça o primeiro empréstimo.' : 'Tente outro nome, #ID ou filtro.'}
          </p>
        </div>
      )}
    </Tela>
  )
}
