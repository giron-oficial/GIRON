import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone, { type NomeIcone } from '../components/Icone'
import Tela from '../components/Tela'
import { tituloSecao } from '../components/estilo'
import { dataBr, idCliente, idContrato, nomeModalidade, reais } from '../lib/formatos'
import { carregarRelatorio, mesAnterior, mesAtual, nomeMes, type Relatorio } from '../lib/relatorio'

// Relatórios: os números de um mês (regra 5.5), com lista do que entrou e do que saiu.
// Mês atual por padrão; setas pra voltar/avançar; não passa do mês atual.

function Cartao({ rotulo, valor, icone, cor, rodape }: { rotulo: string; valor: string; icone: NomeIcone; cor: string; rodape?: string }) {
  return (
    <div className="cartao flex min-w-0 flex-col gap-1.5 rounded-[18px] p-4">
      <span className={`flex size-8 items-center justify-center rounded-[10px] ${cor}`}>
        <Icone nome={icone} tamanho={16} />
      </span>
      <span className="truncate text-xs text-suave">{rotulo}</span>
      <span className="truncate font-display text-[20px] font-extrabold tabular-nums lg:text-[24px]">{valor}</span>
      {rodape && <span className="truncate text-[11px] text-suave">{rodape}</span>}
    </div>
  )
}

const tipoPagamento: Record<string, string> = { pagamento: 'Pagamento', amortizacao: 'Amortização' }

export default function Relatorios() {
  const [mes, setMes] = useState(mesAtual())
  const [r, setR] = useState<Relatorio | null>(null)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<'entradas' | 'saidas' | 'quitados'>('entradas')

  useEffect(() => {
    setR(null)
    setErro('')
    carregarRelatorio(mes).then(setR).catch((e: Error) => setErro(e.message))
  }, [mes])

  const podeAvancar = mes < mesAtual()
  const semCent = (v: number) => reais(v).replace(',00', '')

  return (
    <Tela titulo="Relatórios" subtitulo="Os números de cada mês" largo>
      <div className="mt-4 flex items-center justify-between gap-2 lg:justify-start lg:gap-4">
        <button type="button" onClick={() => setMes(mesAnterior(mes))} aria-label="Mês anterior" className="cartao flex size-11 items-center justify-center rounded-2xl text-suave hover:text-texto">
          <Icone nome="seta" tamanho={18} className="rotate-180" />
        </button>
        <div className="flex flex-col items-center lg:items-start">
          <span className="font-display text-lg font-extrabold">{nomeMes(mes)}</span>
          {mes === mesAtual() && <span className="text-[11px] text-suave">mês atual · até hoje</span>}
        </div>
        <button type="button" onClick={() => podeAvancar && setMes(mesAnterior(mes, -1))} disabled={!podeAvancar} aria-label="Mês seguinte" className="cartao flex size-11 items-center justify-center rounded-2xl text-suave enabled:hover:text-texto disabled:opacity-30">
          <Icone nome="seta" tamanho={18} />
        </button>
        {mes !== mesAtual() && (
          <button type="button" onClick={() => setMes(mesAtual())} className="ml-auto h-9 rounded-xl bg-superficie-2 px-3 text-xs font-bold text-suave hover:text-texto lg:ml-2">
            Mês atual
          </button>
        )}
      </div>

      {erro && <p className="mt-4 text-sm font-semibold text-vencido">{erro}</p>}
      {!r && !erro && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Carregando">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-[18px] bg-superficie-2" />)}
        </div>
      )}

      {r && (
        <>
          <section className="relative mt-4 overflow-hidden rounded-[26px] border border-[#1F4A38] bg-linear-135 from-[#0E3A2A] to-superficie to-65% p-5">
            <div className="pointer-events-none absolute -top-14 -right-12 size-44 rounded-full bg-[radial-gradient(circle,rgb(34_209_132/0.5),transparent_70%)]" />
            <div className="relative grid gap-4 sm:grid-cols-3">
              <div>
                <span className="text-xs text-[#B7F0D3]">Entrou no mês</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(r.totalRecebido)}</p>
                <span className="mt-1 block text-xs text-suave">{r.pagamentos.length} {r.pagamentos.length === 1 ? 'pagamento' : 'pagamentos'}</span>
              </div>
              <div>
                <span className="text-xs text-[#B7F0D3]">Saiu no mês (emprestado)</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(r.emprestado)}</p>
                <span className="mt-1 block text-xs text-suave">{r.contratosNovos} {r.contratosNovos === 1 ? 'contrato novo' : 'contratos novos'}</span>
              </div>
              <div>
                <span className="text-xs text-[#B7F0D3]">Capital na rua hoje</span>
                <p className="mt-1 font-display text-[30px] leading-none font-extrabold tabular-nums">{reais(r.capitalTransito)}</p>
                <span className="mt-1 block text-xs text-suave">{r.contratosAtivos} {r.contratosAtivos === 1 ? 'contrato ativo' : 'contratos ativos'}</span>
              </div>
            </div>
          </section>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao rotulo="Juros recebidos" valor={semCent(r.jurosRecebidos)} icone="subindo" cor="bg-marca/15 text-marca" rodape={r.encargosRecebidos > 0 ? `inclui ${semCent(r.encargosRecebidos)} de multa e atraso` : 'seu ganho do mês'} />
            <Cartao rotulo="Capital recebido" valor={semCent(r.capitalRecebido)} icone="entrando" cor="bg-hoje/15 text-hoje" rodape="voltou pro caixa" />
            <Cartao rotulo="Juros que ainda faltam" valor={semCent(r.jurosPendentes)} icone="moeda" cor="bg-amanha/15 text-amanha" rodape="parcelas do mês em aberto" />
            <Cartao rotulo="Quitados no mês" valor={String(r.quitados)} icone="certo" cor="bg-marca/15 text-marca" rodape={r.quitados === 1 ? 'contrato encerrado' : 'contratos encerrados'} />
          </div>

          <section className="cartao mt-3 rounded-[18px] p-4">
            <h2 className={tituloSecao}>Clientes com parcela em {nomeMes(mes).split(' ')[0].toLowerCase()}</h2>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="font-display text-[26px] font-extrabold tabular-nums">{r.clientesMes}</span>
                <span className="ml-2 text-sm text-suave">no total</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span><strong className="text-marca tabular-nums">{r.clientesPagaram}</strong> <span className="text-suave">já pagaram tudo</span></span>
                <span><strong className="text-vencido tabular-nums">{r.clientesMes - r.clientesPagaram}</strong> <span className="text-suave">ainda faltam</span></span>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-superficie-2">
              <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${r.clientesMes ? Math.round((r.clientesPagaram / r.clientesMes) * 100) : 0}%` }} />
            </div>
          </section>

          <section className="cartao mt-3 rounded-[18px] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={`${tituloSecao} mr-auto`}>Detalhes do mês</h2>
              {([['entradas', `Entradas (${r.pagamentos.length})`], ['saidas', `Empréstimos (${r.novos.length})`], ['quitados', `Quitados (${r.quitadosLista.length})`]] as const).map(([id, texto]) => (
                <button key={id} type="button" onClick={() => setAba(id)} aria-pressed={aba === id} className={`h-9 rounded-full px-3.5 text-xs font-bold ${aba === id ? 'verde' : 'bg-superficie-2 text-suave hover:text-texto'}`}>
                  {texto}
                </button>
              ))}
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-superficie-2">
              {aba === 'entradas' && r.pagamentos.length === 0 && <li className="py-6 text-center text-sm text-suave">Nenhum pagamento neste mês.</li>}
              {aba === 'entradas' && r.pagamentos.map((p) => (
                <li key={p.id}>
                  <Link to={p.contrato ? `/contratos/${p.contrato.id}` : '#'} className="flex items-center gap-3 py-2.5 hover:bg-superficie-2/50">
                    <span className="w-12 shrink-0 text-xs text-suave tabular-nums">{dataBr(p.pago_em).slice(0, 5)}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{p.contrato?.cliente?.nome_completo ?? 'Cliente'}</span>
                      <span className="truncate text-[11px] text-suave">
                        {p.contrato?.cliente ? `${idCliente(p.contrato.cliente.numero)} · ` : ''}{p.contrato ? idContrato(p.contrato.numero) : ''} · {tipoPagamento[p.tipo] ?? p.tipo}
                        {Number(p.parte_juro) > 0 && ` · juro ${semCent(Number(p.parte_juro))}`}
                        {Number(p.parte_capital) > 0 && ` · capital ${semCent(Number(p.parte_capital))}`}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-marca tabular-nums">{reais(p.valor_pago)}</span>
                  </Link>
                </li>
              ))}
              {aba === 'saidas' && r.novos.length === 0 && <li className="py-6 text-center text-sm text-suave">Nenhum empréstimo novo neste mês.</li>}
              {aba === 'saidas' && r.novos.map((c) => (
                <li key={c.id}>
                  <Link to={`/contratos/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-superficie-2/50">
                    <span className="w-12 shrink-0 text-xs text-suave tabular-nums">{dataBr(c.data_contrato).slice(0, 5)}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{c.cliente?.nome_completo ?? 'Cliente'}</span>
                      <span className="truncate text-[11px] text-suave">{c.cliente ? `${idCliente(c.cliente.numero)} · ` : ''}{idContrato(c.numero)} · {nomeModalidade[c.modalidade] ?? c.modalidade}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-vencido tabular-nums">{reais(c.capital)}</span>
                  </Link>
                </li>
              ))}
              {aba === 'quitados' && r.quitadosLista.length === 0 && <li className="py-6 text-center text-sm text-suave">Nenhum contrato quitado neste mês.</li>}
              {aba === 'quitados' && r.quitadosLista.map((c) => (
                <li key={c.id}>
                  <Link to={`/contratos/${c.id}`} className="flex items-center gap-3 py-2.5 hover:bg-superficie-2/50">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{c.cliente?.nome_completo ?? 'Cliente'}</span>
                      <span className="truncate text-[11px] text-suave">{c.cliente ? `${idCliente(c.cliente.numero)} · ` : ''}{idContrato(c.numero)} · {nomeModalidade[c.modalidade] ?? c.modalidade} · de {dataBr(c.data_contrato)}</span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{reais(c.capital)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </Tela>
  )
}
