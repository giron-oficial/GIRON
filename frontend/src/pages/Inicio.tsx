import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone, { type NomeIcone } from '../components/Icone'
import Moldura from '../components/Moldura'
import { dataBr, linkWhatsApp, nomeModalidade, reais } from '../lib/formatos'
import { carregarPainel, type Cobranca, type Painel, type Situacao } from '../lib/painel'

// Cores e textos das 4 situações (bolinhas de vencimento)
const situacoes: Record<Situacao, { rotulo: string; titulo: string; cor: string; fundo: string; borda: string; texto: string }> = {
  critico: { rotulo: 'Críticos', titulo: 'Críticos', cor: 'bg-critico', fundo: 'from-critico/20', borda: 'border-critico/30', texto: 'text-[#D4C8FD]' },
  vencido: { rotulo: 'Vencidos', titulo: 'Vencidos', cor: 'bg-vencido', fundo: 'from-vencido/20', borda: 'border-vencido/30', texto: 'text-[#FCC5C5]' },
  hoje: { rotulo: 'Hoje', titulo: 'Vencem hoje', cor: 'bg-hoje', fundo: 'from-hoje/20', borda: 'border-hoje/30', texto: 'text-[#C3DCFD]' },
  amanha: { rotulo: 'Amanhã', titulo: 'Vencem amanhã', cor: 'bg-amanha', fundo: 'from-amanha/20', borda: 'border-amanha/30', texto: 'text-[#FDE3A0]' },
}
const ordemSituacoes: Situacao[] = ['critico', 'vencido', 'hoje', 'amanha']

const statusAcesso: Record<string, string> = {
  bloqueio_parcial: 'Mensalidade atrasada: por enquanto você só pode consultar.',
  bloqueio_total: 'Acesso bloqueado. Fale com o suporte do GIRON.',
}

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function hojeEscrito() {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function detalhe(c: Cobranca) {
  if (c.situacao === 'hoje') return 'vence hoje'
  if (c.situacao === 'amanha') return 'vence amanhã'
  return c.atraso === 1 ? 'venceu ontem' : `${c.atraso} dias de atraso`
}

function mensagem(c: Cobranca, pix: string | null) {
  const nome = c.cliente.split(' ')[0]
  const valor = reais(c.valor)
  const texto =
    c.situacao === 'hoje'
      ? `${nome}, hoje vence sua parcela de ${valor}.`
      : c.situacao === 'amanha'
        ? `${nome}, amanhã vence sua parcela de ${valor}.`
        : `${nome}, sua parcela de ${valor} venceu em ${dataBr(c.vencimento)}.`
  return pix ? `${texto} Pix: ${pix}` : texto
}

function CartaoValor({ rotulo, valor, icone, cor, rodape, barra }: { rotulo: string; valor: number; icone: NomeIcone; cor: string; rodape: string; barra?: number }) {
  return (
    <div className="vidro flex min-w-0 flex-col gap-1.5 rounded-2xl p-3 lg:gap-3 lg:rounded-3xl lg:p-5">
      <div className="flex items-center gap-1.5 lg:gap-2.5">
        <span className={`hidden size-9 items-center justify-center rounded-xl lg:flex ${cor}`}>
          <Icone nome={icone} tamanho={18} />
        </span>
        <span className={`size-2 rounded-full lg:hidden ${cor.split(' ')[0]}`} />
        <span className="truncate text-[11px] text-suave lg:text-sm">{rotulo}</span>
      </div>
      <span className="truncate font-display text-base font-bold lg:text-3xl">{reais(valor).replace(',00', '')}</span>
      {barra !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10 lg:h-1.5">
          <div className="h-full rounded-full bg-marca" style={{ width: `${barra}%` }} />
        </div>
      )}
      <span className="truncate text-[10px] text-suave lg:text-xs">{rodape}</span>
    </div>
  )
}

export default function Inicio() {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<Situacao | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    carregarPainel()
      .then(setPainel)
      .catch((e: Error) => setErro(e.message))
  }, [])

  if (erro) {
    return (
      <Moldura>
        <p className="mx-auto max-w-md px-4 pt-10 text-vencido">{erro}</p>
      </Moldura>
    )
  }

  if (!painel) {
    return (
      <Moldura>
        <div className="mx-auto flex max-w-md flex-col gap-3 px-4 pt-6 lg:max-w-none lg:px-0 lg:pt-1" aria-label="Carregando">
          <div className="h-12 w-48 animate-pulse rounded-xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-3xl bg-white/5" />
        </div>
      </Moldura>
    )
  }

  if (!painel.empresa) {
    return (
      <Moldura>
        <p className="mx-auto max-w-md px-4 pt-10 text-suave">Sua conta ainda não está ligada a uma empresa. Fale com o suporte do GIRON.</p>
      </Moldura>
    )
  }

  const p = painel
  const empresa = painel.empresa
  const totalJuros = p.jurosRecebidos + p.jurosPendentes
  const percentual = totalJuros > 0 ? Math.round((p.jurosRecebidos / totalJuros) * 100) : 0
  const lista = filtro ? p.cobrancas.filter((c) => c.situacao === filtro) : p.cobrancas
  const visiveis = verTodos ? lista : lista.slice(0, 5)
  const nome = empresa.nome_empresa.split(' ')[0]

  return (
    <Moldura>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-6 lg:max-w-none lg:gap-4 lg:px-0 lg:pt-1">
        <header className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-linear-135 from-marca to-marca-escura font-display text-sm font-bold text-sobre-marca lg:hidden">
            {empresa.nome_empresa.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold lg:text-2xl lg:font-bold">
              {saudacao()}, {nome}
            </h1>
            <p className="text-[13px] text-suave">{hojeEscrito()}</p>
          </div>
          <Link
            to="/clientes"
            className="hidden h-11 items-center rounded-2xl px-4 text-sm text-slate-600 vidro hover:text-texto lg:flex"
          >
            Ver clientes
          </Link>
        </header>

        {statusAcesso[empresa.status_acesso] && (
          <p className="rounded-2xl border border-amanha/30 bg-amanha/10 px-4 py-3 text-sm text-[#FDE3A0]">{statusAcesso[empresa.status_acesso]}</p>
        )}

        <section aria-label="Resumo do mês" className="grid gap-2.5 lg:grid-cols-4 lg:gap-3.5">
          <div className="flex items-center gap-3.5 rounded-3xl border border-marca/35 bg-linear-150 from-marca/30 to-marca/5 p-4 lg:flex-col lg:items-start lg:gap-3 lg:p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-marca/20 text-marca lg:size-9 lg:rounded-xl">
              <Icone nome="subindo" tamanho={20} />
            </span>
            <div className="flex min-w-0 flex-col gap-1 lg:gap-3">
              <span className="text-xs text-[#B9F3D9] lg:text-sm">Capital em trânsito</span>
              <span className="font-display text-[28px] leading-none font-bold lg:text-3xl">{reais(p.capitalTransito).replace(',00', '')}</span>
              <span className="hidden text-xs text-[#8FD9B8] lg:block">
                {p.contratosAtivos} {p.contratosAtivos === 1 ? 'contrato ativo' : 'contratos ativos'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:contents">
            <CartaoValor
              rotulo="Juros recebidos"
              valor={p.jurosRecebidos}
              icone="moeda"
              cor="bg-marca/15 text-marca"
              barra={percentual}
              rodape={`${percentual}% · faltam ${reais(p.jurosPendentes).replace(',00', '')}`}
            />
            <CartaoValor rotulo="Capital recebido" valor={p.capitalRecebido} icone="entrando" cor="bg-hoje/15 text-hoje" rodape="voltou pro caixa" />
            <CartaoValor
              rotulo="Emprestado no mês"
              valor={p.emprestado}
              icone="saindo"
              cor="bg-amanha/15 text-amanha"
              rodape={`${p.contratosNovos} ${p.contratosNovos === 1 ? 'contrato novo' : 'contratos novos'}`}
            />
          </div>
        </section>

        <section aria-label="Situação dos clientes" className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-semibold lg:hidden">Situação dos clientes</h2>
          <div className="grid grid-cols-4 gap-2 lg:gap-3.5">
            {ordemSituacoes.map((s) => {
              const info = situacoes[s]
              const itens = p.cobrancas.filter((c) => c.situacao === s)
              const ativo = filtro === s
              return (
                <button
                  key={s}
                  onClick={() => setFiltro(ativo ? null : s)}
                  aria-pressed={ativo}
                  className={`flex flex-col items-center gap-1 rounded-2xl border bg-linear-to-b to-white/[0.02] px-2 py-3 text-left transition lg:items-stretch lg:gap-2.5 lg:rounded-3xl lg:p-4 ${info.fundo} ${info.borda} ${ativo ? 'ring-2 ring-texto/60' : ''}`}
                >
                  <span className="flex items-center gap-2 lg:justify-between">
                    <span className={`flex items-center gap-2 text-sm font-semibold ${info.texto}`}>
                      <span className={`size-2.5 rounded-full ${info.cor} ${s === 'hoje' ? 'anima-pulso' : ''}`} />
                      <span className="hidden lg:inline">{info.titulo}</span>
                    </span>
                    <span className="hidden font-display text-3xl font-bold lg:inline">{itens.length}</span>
                  </span>
                  <span className="font-display text-[26px] font-bold lg:hidden">{itens.length}</span>
                  <span className={`text-[11px] lg:hidden ${info.texto}`}>{info.rotulo}</span>
                  <span className="hidden text-[13px] text-slate-600 lg:block">{reais(itens.reduce((t, c) => t + c.valor, 0))}</span>
                  <span className="hidden flex-col gap-1 text-[13px] lg:flex">
                    {itens.slice(0, 2).map((c) => (
                      <span key={c.parcelaId} className="flex justify-between gap-2">
                        <span className="truncate">{c.cliente}</span>
                        <span className={`shrink-0 ${info.texto}`}>{reais(c.valor).replace(',00', '')}</span>
                      </span>
                    ))}
                    {itens.length === 0 && <span className="text-suave">Ninguém aqui</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr] lg:gap-3.5">
          <section aria-label="Cobrar agora" className="flex flex-col gap-2 lg:vidro lg:rounded-3xl lg:p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold lg:text-base">{filtro ? situacoes[filtro].titulo : 'Cobrar agora'}</h2>
              {lista.length > 5 && (
                <button onClick={() => setVerTodos(!verTodos)} className="text-[13px] text-marca">
                  {verTodos ? 'Ver menos' : `Ver todos (${lista.length})`}
                </button>
              )}
            </div>
            {visiveis.length === 0 && <p className="vidro rounded-2xl px-4 py-5 text-sm text-suave lg:border-0 lg:bg-transparent lg:px-0">Ninguém pra cobrar agora.</p>}
            {visiveis.map((c) => (
              <div key={c.parcelaId} className="vidro flex items-center gap-3 rounded-2xl py-2.5 pr-2.5 pl-3.5 lg:rounded-none lg:border-0 lg:border-b lg:border-white/5 lg:bg-transparent lg:px-0">
                <span className={`size-2.5 shrink-0 rounded-full ${situacoes[c.situacao].cor}`} />
                <Link to={`/contratos/${c.contratoId}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{c.cliente}</span>
                  <span className="truncate text-xs text-suave">
                    {nomeModalidade[c.modalidade] ?? c.modalidade} · {detalhe(c)} · {reais(c.valor)}
                  </span>
                </Link>
                {c.telefone && (
                  <a
                    href={linkWhatsApp(c.telefone, mensagem(c, p.chavePix))}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Cobrar ${c.cliente} no WhatsApp`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-marca text-sobre-marca"
                  >
                    <Icone nome="whatsapp" />
                  </a>
                )}
              </div>
            ))}
          </section>

          <section aria-label="Clientes do mês" className="vidro flex items-center gap-5 rounded-3xl p-5">
            <div
              className="flex size-28 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(var(--color-marca) 0 ${percentual}%, rgb(255 255 255 / 0.08) ${percentual}% 100%)` }}
            >
              <div className="flex size-[86px] flex-col items-center justify-center rounded-full bg-superficie">
                <span className="font-display text-2xl font-bold">{percentual}%</span>
                <span className="text-[11px] text-suave">dos juros</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 text-[13px] text-slate-600">
              <h2 className="mb-1 text-base font-semibold text-texto">Clientes do mês</h2>
              <span>
                <strong className="text-marca">{p.clientesPagaram}</strong> já pagaram
              </span>
              <span>
                <strong className="text-texto">{p.clientesMes - p.clientesPagaram}</strong> ainda vão pagar
              </span>
              <span>{p.clientesMes} com parcela em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</span>
            </div>
          </section>
        </div>
      </main>
    </Moldura>
  )
}
