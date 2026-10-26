import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GraficoProgressao from '../components/GraficoProgressao'
import Icone, { type NomeIcone } from '../components/Icone'
import Tela from '../components/Tela'
import { tituloSecao } from '../components/estilo'
import { idCliente, idContrato, nomeModalidade, reais } from '../lib/formatos'
import {
  andar, anteriorDe, carregarBase, dataCurta, dataLonga, hoje, intervaloDe, movimentos, naRua, nomeAnterior, nomeDia, nomeMes,
  parcelasDoPeriodo, serie, somaDias, tituloDe, totais, type Base, type Intervalo, type Modo, type Movimento,
} from '../lib/relatorio'

// Relatórios: o que entrou e o que saiu no dia, na semana, no mês, no ano ou entre duas datas.
// Resumo, comparação com o período anterior, gráfico de progressão e a lista de toda movimentação.

const MODOS: [Modo, string][] = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano'], ['periodo', 'Por data']]
const NO: Record<Modo, string> = { dia: 'no dia', semana: 'na semana', mes: 'no mês', ano: 'no ano', periodo: 'no período' }

// Todos os blocos com o mesmo degradê azul do quadro de cima (pedido do dono)
const degrade = 'relative isolate overflow-hidden border border-[#1D3D75] bg-linear-135 from-[#0C2550] to-superficie to-65%'
const Brilho = ({ grande }: { grande?: boolean }) => (
  <div className={`pointer-events-none absolute -z-10 rounded-full bg-[radial-gradient(circle,rgb(76_194_255/0.45),transparent_70%)] ${grande ? '-top-14 -right-12 size-44' : '-top-10 -right-10 size-28'}`} />
)

const juntar = (xs: Intervalo[]): Intervalo => ({ ini: xs.map((x) => x.ini).sort()[0], fim: xs.map((x) => x.fim).sort().at(-1)! })

// "↑ 12% que a semana passada" (bom = subir é bom; senão fica neutro)
function Variacao({ atual, antes, modo, bom = true }: { atual: number; antes: number; modo: Modo; bom?: boolean }) {
  if (atual === 0 && antes === 0) return <span className="text-suave">sem movimento</span>
  if (antes === 0) return <span className="text-suave">nada {nomeAnterior[modo].replace('que ', 'n')}</span>
  const pct = Math.round(((atual - antes) / antes) * 100)
  if (pct === 0) return <span className="text-suave">igual {nomeAnterior[modo].replace('que ', 'a ')}</span>
  const cor = !bom ? 'text-suave' : pct > 0 ? 'text-sucesso' : 'text-vencido'
  return <span className={`font-semibold ${cor}`}>{pct > 0 ? '↑' : '↓'} {Math.abs(pct)}% <span className="font-normal text-suave">{pct > 0 ? 'a mais' : 'a menos'} {nomeAnterior[modo]}</span></span>
}

function Cartao({ rotulo, valor, icone, cor, rodape, extra }: { rotulo: string; valor: string; icone: NomeIcone; cor: string; rodape?: React.ReactNode; extra?: string }) {
  return (
    <div className={`${degrade} flex min-w-0 flex-col gap-1.5 rounded-[22px] p-4`}>
      <Brilho />
      <span className={`relative flex size-8 items-center justify-center rounded-[10px] ${cor}`}>
        <Icone nome={icone} tamanho={16} />
      </span>
      <span className="relative truncate text-xs text-[#BFD8FF]">{rotulo}</span>
      <span className="relative truncate font-display text-[20px] font-extrabold tabular-nums lg:text-[24px]">{valor}</span>
      {rodape && <span className="relative truncate text-[11px] text-suave">{rodape}</span>}
      {extra && <span className="relative -mt-1 truncate text-[11px] text-suave">{extra}</span>}
    </div>
  )
}

const visual: Record<Movimento['tipo'], { icone: NomeIcone; cor: string; texto: string }> = {
  entrada: { icone: 'entrando', cor: 'bg-sucesso/15 text-sucesso', texto: 'Entrada' },
  emprestimo: { icone: 'saindo', cor: 'bg-amanha/15 text-amanha', texto: 'Empréstimo' },
  quitado: { icone: 'certo', cor: 'bg-marca/15 text-marca-brilho', texto: 'Quitado' },
  estorno: { icone: 'xis', cor: 'bg-vencido/15 text-vencido', texto: 'Estornado' },
}
const tipoPagamento: Record<string, string> = { pagamento: 'Pagamento', amortizacao: 'Amortização' }

function LinhaMovimento({ m }: { m: Movimento }) {
  const v = visual[m.tipo]
  const contrato = 'p' in m ? m.p.contrato : m.c
  const cliente = contrato?.cliente
  let detalhe = ''
  let valor = 0
  if ('p' in m) {
    const encargos = Number(m.p.multa) + Number(m.p.juro_atraso)
    detalhe = [
      tipoPagamento[m.p.tipo] ?? m.p.tipo,
      Number(m.p.parte_juro) > 0 && `juro ${reais(m.p.parte_juro)}`,
      Number(m.p.parte_capital) > 0 && `capital ${reais(m.p.parte_capital)}`,
      encargos > 0 && `multa/atraso ${reais(encargos)}`,
      m.p.motivo_estorno && `estorno: ${m.p.motivo_estorno}`,
    ].filter(Boolean).join(' · ')
    valor = Number(m.p.valor_pago)
  } else {
    detalhe = `${nomeModalidade[m.c.modalidade] ?? m.c.modalidade}${m.tipo === 'quitado' ? ` · emprestado em ${dataLonga(m.c.data_contrato)}` : ''}`
    valor = Number(m.c.capital)
  }
  return (
    <li>
      <Link to={contrato ? `/contratos/${contrato.id}` : '#'} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-superficie-2/60">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${v.cor}`} title={v.texto}>
          <Icone nome={v.icone} tamanho={15} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">{cliente?.nome_completo ?? 'Cliente'}</span>
          <span className="truncate text-[11px] text-suave">
            {cliente ? `${idCliente(cliente.numero)} · ` : ''}{contrato ? `${idContrato(contrato.numero)} · ` : ''}{detalhe}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={`text-sm font-bold tabular-nums ${m.tipo === 'estorno' ? 'text-suave line-through' : ''}`}>
            {m.tipo === 'emprestimo' ? '− ' : m.tipo === 'entrada' ? '+ ' : ''}{reais(valor)}
          </span>
          <span className="text-[10px] text-suave">{v.texto}</span>
        </div>
      </Link>
    </li>
  )
}

type Filtro = 'tudo' | Movimento['tipo']

function Movimentacoes({ lista, modo }: { lista: Movimento[]; modo: Modo }) {
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const conta = (t: Filtro) => (t === 'tudo' ? lista.length : lista.filter((m) => m.tipo === t).length)
  const filtrada = filtro === 'tudo' ? lista : lista.filter((m) => m.tipo === filtro)
  const dias = useMemo(() => {
    const g = new Map<string, Movimento[]>()
    for (const m of filtrada) g.set(m.dia, [...(g.get(m.dia) ?? []), m])
    return [...g.entries()]
  }, [filtrada])

  // Abre o dia mais recente (e todos, se for o relatório de um dia só)
  useEffect(() => { setAbertos(new Set(modo === 'dia' ? dias.map(([d]) => d) : dias.slice(0, 1).map(([d]) => d))) }, [lista, modo]) // eslint-disable-line react-hooks/exhaustive-deps

  const tudoAberto = dias.length > 0 && dias.every(([d]) => abertos.has(d))
  const alterna = (d: string) => setAbertos((a) => { const n = new Set(a); if (n.has(d)) n.delete(d); else n.add(d); return n })

  return (
    <section className={`${degrade} mt-3 rounded-[22px] p-4`}>
            <Brilho />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={`${tituloSecao} mr-auto`}>Movimentações</h2>
        {dias.length > 1 && (
          <button type="button" onClick={() => setAbertos(tudoAberto ? new Set() : new Set(dias.map(([d]) => d)))} className="h-8 rounded-full px-3 text-xs font-bold text-suave hover:text-texto">
            {tudoAberto ? 'Fechar todos' : 'Abrir todos'}
          </button>
        )}
      </div>
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {([['tudo', 'Tudo'], ['entrada', 'Entradas'], ['emprestimo', 'Empréstimos'], ['quitado', 'Quitados'], ['estorno', 'Estornos']] as const).map(([id, texto]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-bold ${filtro === id ? 'verde' : 'bg-superficie-2 text-suave hover:text-texto'}`}>
            {texto} ({conta(id)})
          </button>
        ))}
      </div>

      {dias.length === 0 && <p className="py-8 text-center text-sm text-suave">Nenhuma movimentação {NO[modo]}.</p>}
      <div className="mt-2 flex flex-col gap-2">
        {dias.map(([dia, itens]) => {
          const entrou = itens.reduce((t, m) => t + (m.tipo === 'entrada' ? Number(m.p.valor_pago) : 0), 0)
          const saiu = itens.reduce((t, m) => t + (m.tipo === 'emprestimo' ? Number(m.c.capital) : 0), 0)
          const aberto = abertos.has(dia)
          return (
            <div key={dia} className="rounded-2xl border border-borda/70 bg-superficie-2/30">
              <button type="button" onClick={() => alterna(dia)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <Icone nome="seta" tamanho={14} className={`shrink-0 text-suave transition ${aberto ? 'rotate-90' : ''}`} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-bold whitespace-nowrap">{nomeDia(dia)}, {dataLonga(dia)}{dia === hoje() && <span className="ml-2 text-[11px] font-semibold text-marca-brilho">hoje</span>}</span>
                  <span className="text-[11px] text-suave">{itens.length} {itens.length === 1 ? 'movimentação' : 'movimentações'}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end text-xs tabular-nums">
                  {entrou > 0 && <span className="font-bold">+ {reais(entrou)}</span>}
                  {saiu > 0 && <span className="text-amanha" title="Emprestado nesse dia">− {reais(saiu)}</span>}
                </div>
              </button>
              {aberto && <ul className="flex flex-col border-t border-borda/70 px-1 py-1">{itens.map((m) => <LinhaMovimento key={m.id} m={m} />)}</ul>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function Relatorios() {
  const [modo, setModo] = useState<Modo>('mes')
  const [ref, setRef] = useState(hoje()) // data escolhida (no "Por data", é o "até")
  const [de, setDe] = useState(hoje().slice(0, 8) + '01')
  const [base, setBase] = useState<Base | null>(null)
  const [erro, setErro] = useState('')

  const periodo = intervaloDe(modo, ref, de)
  const anterior = anteriorDe(modo, periodo)
  const faixas = { dia: intervaloDe('dia', ref), semana: intervaloDe('semana', ref), mes: intervaloDe('mes', ref), ano: intervaloDe('ano', ref) }

  useEffect(() => {
    setBase(null)
    setErro('')
    const busca = juntar([periodo, anterior, faixas.semana, faixas.ano, { ini: somaDias(ref, -6), fim: ref }])
    let vivo = true
    carregarBase(busca, periodo).then((b) => vivo && setBase(b)).catch((e: Error) => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [modo, ref, de]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = base && totais(base, periodo)
  const ta = base && totais(base, anterior)
  const rua = base && naRua(base)
  const parc = base && parcelasDoPeriodo(base)
  const barras = useMemo(() => (base ? serie(base, modo, periodo) : []), [base]) // eslint-disable-line react-hooks/exhaustive-deps
  const lista = useMemo(() => (base ? movimentos(base, periodo) : []), [base]) // eslint-disable-line react-hooks/exhaustive-deps

  const podeAvancar = modo !== 'periodo' && periodo.fim < hoje()
  const escolheModo = (m: Modo) => { if (m === 'periodo' && de > ref) setDe(ref.slice(0, 8) + '01'); setModo(m) }

  return (
    <Tela titulo="Relatórios" subtitulo="Tudo o que entrou e saiu, do jeito que você escolher" largo>
      {/* Tipo de relatório */}
      <div className="vidro mt-4 grid grid-cols-5 gap-1 rounded-2xl p-1 lg:inline-grid lg:w-[520px]">
        {MODOS.map(([m, texto]) => (
          <button key={m} type="button" onClick={() => escolheModo(m)} aria-pressed={modo === m} className={`h-10 rounded-xl text-[13px] font-bold transition ${modo === m ? 'verde' : 'text-suave hover:text-texto'}`}>
            {texto}
          </button>
        ))}
      </div>

      {/* Qual data */}
      <div className="mt-3 flex flex-wrap items-center gap-2 lg:gap-3">
        {modo !== 'periodo' ? (
          <>
            <button type="button" onClick={() => setRef(andar(modo, ref, -1))} aria-label="Anterior" className="cartao flex size-11 items-center justify-center rounded-2xl text-suave hover:text-texto">
              <Icone nome="seta" tamanho={18} className="rotate-180" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center lg:flex-none lg:items-start lg:px-1">
              <span className="truncate font-display text-lg font-extrabold">{tituloDe(modo, periodo)}</span>
              {periodo.fim >= hoje() && <span className="text-[11px] text-suave">{modo === 'dia' ? 'hoje' : 'até hoje'}</span>}
            </div>
            <button type="button" onClick={() => podeAvancar && setRef(andar(modo, ref, 1))} disabled={!podeAvancar} aria-label="Seguinte" className="cartao flex size-11 items-center justify-center rounded-2xl text-suave enabled:hover:text-texto disabled:opacity-30">
              <Icone nome="seta" tamanho={18} />
            </button>
            <label className="cartao flex h-11 w-full items-center gap-2 rounded-2xl px-3 text-xs font-semibold text-suave sm:w-auto">
              Escolher data
              <input type="date" value={ref} max={hoje()} onChange={(e) => e.target.value && setRef(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-texto outline-none [color-scheme:dark]" />
            </label>
          </>
        ) : (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <label className="cartao flex h-11 items-center gap-2 rounded-2xl px-3 text-xs font-semibold text-suave">
              De
              <input type="date" value={de} max={ref} onChange={(e) => e.target.value && setDe(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-texto outline-none [color-scheme:dark]" />
            </label>
            <label className="cartao flex h-11 items-center gap-2 rounded-2xl px-3 text-xs font-semibold text-suave">
              Até
              <input type="date" value={ref} min={de} max={hoje()} onChange={(e) => e.target.value && setRef(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-texto outline-none [color-scheme:dark]" />
            </label>
          </div>
        )}
        {ref !== hoje() && (
          <button type="button" onClick={() => setRef(hoje())} className="h-9 rounded-xl bg-superficie-2 px-3 text-xs font-bold text-suave hover:text-texto">
            Hoje
          </button>
        )}
      </div>

      {erro && <p className="mt-4 text-sm font-semibold text-vencido">{erro}</p>}
      {!base && !erro && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Carregando">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-[18px] bg-superficie-2" />)}
        </div>
      )}

      {base && t && ta && rua && parc && (
        <>
          <section className={`${degrade} mt-4 rounded-[22px] p-5`}>
            <Brilho grande />
            <div className="relative grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-xs text-[#BFD8FF]">Entrou {NO[modo]}</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(t.entrou)}</p>
                <span className="mt-1 block text-xs"><Variacao atual={t.entrou} antes={ta.entrou} modo={modo} /></span>
              </div>
              <div>
                <span className="text-xs text-[#BFD8FF]">Emprestado {NO[modo]}</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(t.emprestado)}</p>
                <span className="mt-1 block text-xs text-suave">{t.novos} {t.novos === 1 ? 'contrato novo' : 'contratos novos'} · <Variacao atual={t.emprestado} antes={ta.emprestado} modo={modo} bom={false} /></span>
              </div>
              <div>
                <span className="text-xs text-[#BFD8FF]">Capital na rua hoje</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(rua.capital)}</p>
                <span className="mt-1 block text-xs text-suave">{rua.contratos} {rua.contratos === 1 ? 'contrato ativo' : 'contratos ativos'}</span>
              </div>
            </div>
          </section>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao rotulo={`Juros recebidos ${NO[modo]}`} valor={reais(t.juros)} icone="subindo" cor="bg-sucesso/15 text-sucesso" rodape={<Variacao atual={t.juros} antes={ta.juros} modo={modo} />} extra={t.encargos > 0 ? `inclui ${reais(t.encargos)} de multa e atraso` : undefined} />
            <Cartao rotulo={`Capital recebido ${NO[modo]}`} valor={reais(t.capital)} icone="entrando" cor="bg-marca/15 text-marca-brilho" rodape={<Variacao atual={t.capital} antes={ta.capital} modo={modo} />} />
            <Cartao rotulo="Juros que ainda faltam" valor={reais(parc.jurosPendentes)} icone="moeda" cor="bg-amanha/15 text-amanha" rodape={`parcelas que vencem ${NO[modo]}`} />
            <Cartao rotulo={`Quitados ${NO[modo]}`} valor={String(t.quitados)} icone="certo" cor="bg-marca/15 text-marca-brilho" rodape={t.quitados === 1 ? 'contrato encerrado' : 'contratos encerrados'} />
          </div>

          {/* Resumo Dia / Semana / Mês / Ano da data escolhida */}
          <section className={`${degrade} mt-3 rounded-[22px] p-4`}>
            <Brilho />
            <h2 className={tituloSecao}>Resumo até {dataLonga(ref)}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {(['dia', 'semana', 'mes', 'ano'] as const).map((m) => {
                const x = totais(base, faixas[m])
                const nome = m === 'dia' ? `Dia ${dataCurta(ref)}` : m === 'semana' ? `Semana ${dataCurta(faixas.semana.ini)}–${dataCurta(faixas.semana.fim)}` : m === 'mes' ? nomeMes(ref).split(' ')[0] : `Ano ${ref.slice(0, 4)}`
                return (
                  <button key={m} type="button" onClick={() => setModo(m)} aria-pressed={modo === m} className={`flex min-w-0 flex-col gap-1.5 rounded-2xl border p-3 text-left transition ${modo === m ? 'vidro border-marca/60' : 'border-borda/70 bg-superficie-2/40 hover:border-marca/40'}`}>
                    <span className="truncate text-[11px] font-bold tracking-wide text-marca-brilho uppercase">{nome}</span>
                    {([['Emprestado', x.emprestado], ['Juros', x.juros], ['Capital recebido', x.capital]] as const).map(([r, v]) => (
                      <span key={r} className="flex flex-col">
                        <span className="text-[10px] text-suave">{r}</span>
                        <span className="truncate text-[14px] font-semibold tabular-nums">{reais(v)}</span>
                      </span>
                    ))}
                    <span className="mt-0.5 flex flex-col border-t border-borda/70 pt-1.5">
                      <span className="text-[10px] text-suave">Total que entrou</span>
                      <span className="truncate text-[15px] font-extrabold tabular-nums">{reais(x.entrou)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className={`${degrade} mt-3 rounded-[22px] p-4`}>
            <Brilho />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={tituloSecao}>Progressão</h2>
              <span className="text-[11px] text-suave">{modo === 'dia' ? 'últimos 7 dias' : barras.length > 0 && barras[0].ini === barras[0].fim ? 'dia a dia' : 'mês a mês'}</span>
            </div>
            <div className="mt-3">
              <GraficoProgressao barras={barras} />
            </div>
          </section>

          {parc.clientes > 0 && (
            <section className={`${degrade} mt-3 rounded-[22px] p-4`}>
            <Brilho />
              <h2 className={tituloSecao}>Clientes com parcela {NO[modo]}</h2>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="font-display text-[26px] font-extrabold tabular-nums">{parc.clientes}</span>
                  <span className="ml-2 text-sm text-suave">no total</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span><strong className="text-sucesso tabular-nums">{parc.pagaram}</strong> <span className="text-suave">já pagaram tudo</span></span>
                  <span><strong className="text-vencido tabular-nums">{parc.clientes - parc.pagaram}</strong> <span className="text-suave">ainda faltam</span></span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-superficie-2">
                <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${Math.round((parc.pagaram / parc.clientes) * 100)}%` }} />
              </div>
            </section>
          )}

          <Movimentacoes lista={lista} modo={modo} />
        </>
      )}
    </Tela>
  )
}
