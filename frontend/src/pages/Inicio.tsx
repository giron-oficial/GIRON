import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icone, { type NomeIcone } from '../components/Icone'
import Moldura from '../components/Moldura'
import { dataBr, linkWhatsApp, nomeModalidade, reais } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import { carregarPainel, type Cobranca, type Painel, type Situacao } from '../lib/painel'

// Cores e textos das 4 situações (bolinhas de vencimento): cartão de VIDRO da cor (transparente, borda e brilho da mesma cor)
const situacoes: Record<Situacao, { rotulo: string; curto: string; titulo: string; cartao: string; brilho: string; sub: string; bolinha: string; clara: string; escura: string }> = {
  critico: { rotulo: 'Críticos', curto: 'Crítico', titulo: 'Críticos', cartao: 'border border-[#A37BFF]/70 bg-linear-160 from-[#A37BFF]/60 via-[#6B3FE0]/30 to-[#6B3FE0]/10 text-white backdrop-blur-xl shadow-[0_12px_36px_-12px_rgba(163,123,255,0.75),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_24px_rgba(163,123,255,0.12)]', sub: 'text-white/75', bolinha: 'bg-[#D4C2FF] shadow-[0_0_10px_2px_rgba(163,123,255,0.9)]', brilho: 'bg-[radial-gradient(circle,rgba(163,123,255,0.55),transparent_70%)]', clara: 'bg-critico/15', escura: 'text-critico' },
  vencido: { rotulo: 'Vencidos', curto: 'Vencido', titulo: 'Vencidos', cartao: 'border border-[#F0525C]/70 bg-linear-160 from-[#F0525C]/60 via-[#C8252F]/30 to-[#C8252F]/10 text-white backdrop-blur-xl shadow-[0_12px_36px_-12px_rgba(240,82,92,0.75),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_24px_rgba(240,82,92,0.12)]', sub: 'text-white/75', bolinha: 'bg-[#FFB3B8] shadow-[0_0_10px_2px_rgba(240,82,92,0.9)]', brilho: 'bg-[radial-gradient(circle,rgba(240,82,92,0.55),transparent_70%)]', clara: 'bg-vencido/15', escura: 'text-vencido' },
  hoje: { rotulo: 'Hoje', curto: 'Hoje', titulo: 'Vencem hoje', cartao: 'border border-[#3FA9FF]/70 bg-linear-160 from-[#3FA9FF]/60 via-[#0B6FD6]/30 to-[#0B6FD6]/10 text-white backdrop-blur-xl shadow-[0_12px_36px_-12px_rgba(63,169,255,0.75),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_24px_rgba(63,169,255,0.12)]', sub: 'text-white/75', bolinha: 'bg-[#F0525C] anima-pulso', brilho: 'bg-[radial-gradient(circle,rgba(63,169,255,0.55),transparent_70%)]', clara: 'bg-hoje/15', escura: 'text-hoje' },
  amanha: { rotulo: 'Amanhã', curto: 'Amanhã', titulo: 'Vencem amanhã', cartao: 'border border-[#F5C02E]/70 bg-linear-160 from-[#F5C02E]/60 via-[#D99A00]/30 to-[#D99A00]/10 text-white backdrop-blur-xl shadow-[0_12px_36px_-12px_rgba(245,192,46,0.75),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_0_24px_rgba(245,192,46,0.12)]', sub: 'text-white/75', bolinha: 'bg-[#FFE7A3] shadow-[0_0_10px_2px_rgba(245,192,46,0.9)]', brilho: 'bg-[radial-gradient(circle,rgba(245,192,46,0.55),transparent_70%)]', clara: 'bg-amanha/15', escura: 'text-amanha' },
}
const ordemSituacoes: Situacao[] = ['critico', 'vencido', 'hoje', 'amanha']

const statusAcesso: Record<string, string> = {
  bloqueio_parcial: 'Mensalidade atrasada: por enquanto você só pode consultar.',
  bloqueio_total: 'Acesso bloqueado. Fale com o suporte do GIRON.',
}

const semCentavos = (v: number) => reais(v).replace(',00', '')

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function hojeEscrito() {
  const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Situação da cobrança pro analytics (categoria fechada, sem nome nem valor)
function situacaoEvento(s: Situacao): 'vence_hoje' | 'vence_amanha' | 'atrasado' {
  if (s === 'hoje') return 'vence_hoje'
  if (s === 'amanha') return 'vence_amanha'
  return 'atrasado'
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
        : c.encargos > 0
          ? `${nome}, sua parcela venceu em ${dataBr(c.vencimento)}. Com multa e juros de atraso, hoje o valor é ${valor}.`
          : `${nome}, sua parcela de ${valor} venceu em ${dataBr(c.vencimento)}.`
  return pix ? `${texto} Pix: ${pix}` : texto
}

function Mini({ rotulo, valor, icone, cor, rodape, barra }: { rotulo: string; valor: number; icone: NomeIcone; cor: string; rodape: string; barra?: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l border-superficie-2 pl-3 first:border-l-0 first:pl-0 lg:pl-4">
      <span className={`flex size-7.5 items-center justify-center rounded-[10px] ${cor}`}>
        <Icone nome={icone} tamanho={15} />
      </span>
      <span className="truncate text-[11px] text-suave lg:text-xs">{rotulo}</span>
      <span className="truncate font-display text-[16px] font-extrabold lg:text-[19px] xl:text-[22px]">{semCentavos(valor)}</span>
      {barra !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-superficie-2 lg:h-1.5">
          <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${barra}%` }} />
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
  const { hash } = useLocation()

  useEffect(() => {
    carregarPainel()
      .then(setPainel)
      .catch((e: Error) => setErro(e.message))
  }, [])

  // Aba "Resumo" da barra do celular: desce até os números do mês
  useEffect(() => {
    if (!painel) return
    if (hash === '#resumo') document.getElementById('resumo')?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo({ top: 0 })
  }, [hash, painel])

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
          <div className="h-12 w-48 animate-pulse rounded-xl bg-superficie-2" />
          <div className="h-32 animate-pulse rounded-3xl bg-superficie-2" />
          <div className="h-24 animate-pulse rounded-3xl bg-superficie-2" />
        </div>
      </Moldura>
    )
  }

  const empresa = painel.empresa
  if (!empresa) {
    return (
      <Moldura>
        <p className="mx-auto max-w-md px-4 pt-10 text-suave">Sua conta ainda não está ligada a uma empresa. Fale com o suporte do GIRON.</p>
      </Moldura>
    )
  }

  const p = painel
  const totalJuros = p.jurosRecebidos + p.jurosPendentes
  const percentual = totalJuros > 0 ? Math.min(100, Math.round((p.jurosRecebidos / totalJuros) * 100)) : 0
  const lista = filtro ? p.cobrancas.filter((c) => c.situacao === filtro) : p.cobrancas
  const visiveis = verTodos ? lista : lista.slice(0, 5)
  const nome = empresa.nome_empresa.split(' ')[0]
  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Moldura>
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-4 pt-4 lg:grid lg:max-w-none lg:grid-cols-12 lg:gap-4 lg:px-0 lg:pt-0">
        <header className="hidden items-center gap-3 lg:col-span-12 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-suave">{hojeEscrito()}</p>
            <h1 className="truncate text-[26px] font-extrabold tracking-tight">
              {saudacao()}, {nome}
            </h1>
          </div>
          <Link to="/calculadora" className="cartao flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:text-marca">
            <Icone nome="calculadora" tamanho={18} />
            Calculadora
          </Link>
          <Link to="/clientes" className="verde flex h-11 items-center rounded-xl px-4 text-sm font-extrabold">
            Ver clientes
          </Link>
        </header>

        {statusAcesso[empresa.status_acesso] && (
          <p className="rounded-2xl bg-amanha/15 px-4 py-3 text-sm font-semibold text-amanha lg:col-span-12">{statusAcesso[empresa.status_acesso]}</p>
        )}

        <section
          aria-label="Capital em trânsito"
          className="relative flex flex-col gap-2 overflow-hidden rounded-[18px] border border-[#1D3D75] bg-[radial-gradient(circle_at_88%_15%,rgb(47_128_255/0.28),transparent_55%),linear-gradient(135deg,#0C2550,#0A1426_65%)] px-5 py-4.5 lg:col-span-6 lg:p-5.5"
        >
          <svg width="150" height="54" viewBox="0 0 150 54" fill="none" aria-hidden="true" className="pointer-events-none absolute right-4 bottom-4 hidden sm:block">
            <path d="M2 46 C 22 40, 30 44, 46 34 S 74 30, 88 22 S 118 18, 148 6" stroke="#4CC2FF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="148" cy="6" r="4" fill="#4CC2FF" />
          </svg>
          <span className="relative flex items-center gap-1.5 text-xs text-[#BFD8FF] lg:text-[13px]">
            <span className="size-1.5 rounded-full bg-marca" />
            <span className="lg:hidden">{saudacao()}, {nome} ·</span>
            Capital em trânsito
          </span>
          <span className="relative font-display text-[34px] leading-none font-extrabold tracking-tight lg:text-[40px]">{semCentavos(p.capitalTransito)}</span>
          <span className="relative text-xs text-suave">
            {p.contratosAtivos} {p.contratosAtivos === 1 ? 'contrato ativo' : 'contratos ativos'} na rua
            <span className="lg:hidden"> · juros do mês {percentual}%</span>
          </span>
        </section>

        <section id="resumo" aria-label="Resumo do mês" className="cartao scroll-mt-4 rounded-[18px] p-4 max-lg:order-1 lg:col-span-6 lg:p-5">
          <h2 className="mb-3 text-sm font-bold first-letter:uppercase">{mes} até agora</h2>
          <div className="grid grid-cols-3">
            <Mini
              rotulo="Juros recebidos"
              valor={p.jurosRecebidos}
              icone="moeda"
              cor="bg-marca/15 text-marca"
              barra={percentual}
              rodape={`${percentual}% · faltam ${semCentavos(p.jurosPendentes)}`}
            />
            <Mini rotulo="Capital recebido" valor={p.capitalRecebido} icone="entrando" cor="bg-hoje/15 text-hoje" rodape="voltou pro caixa" />
            <Mini
              rotulo="Emprestado"
              valor={p.emprestado}
              icone="saindo"
              cor="bg-amanha/15 text-amanha"
              rodape={`${p.contratosNovos} ${p.contratosNovos === 1 ? 'contrato novo' : 'contratos novos'}`}
            />
          </div>
        </section>

        <section aria-label="Situação dos clientes" className="grid grid-cols-4 gap-2 lg:col-span-12 lg:gap-3.5">
          {ordemSituacoes.map((s) => {
            const info = situacoes[s]
            const doGrupo = p.cobrancas.filter((c) => c.situacao === s)
            const total = doGrupo.reduce((t, c) => t + c.valor, 0)
            // Um cliente com várias parcelas no mesmo grupo aparece uma vez só, com o valor somado
            const porCliente = new Map<string, { nome: string; valor: number; atraso: number }>()
            for (const c of doGrupo) {
              const atual = porCliente.get(c.clienteId) ?? { nome: c.cliente, valor: 0, atraso: 0 }
              atual.valor += c.valor
              atual.atraso = Math.max(atual.atraso, c.atraso)
              porCliente.set(c.clienteId, atual)
            }
            const clientes = [...porCliente.values()]
            const ativo = filtro === s
            return (
              <button
                key={s}
                onClick={() => setFiltro(ativo ? null : s)}
                aria-pressed={ativo}
                className={`relative isolate flex flex-col items-center gap-0.5 overflow-hidden rounded-[18px] px-1.5 pt-2.5 pb-2 text-left tabular-nums transition hover:brightness-110 lg:items-stretch lg:gap-2 lg:rounded-[16px] lg:px-4 lg:py-3.5 ${info.cartao} ${ativo ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-fundo' : ''}`}
              >
                <span aria-hidden className={`pointer-events-none absolute -top-10 -right-8 -z-10 size-32 rounded-full blur-md ${info.brilho}`} />
                <span className="flex items-center gap-2 lg:justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`size-2.5 rounded-full ring-4 ring-white/15 ${info.bolinha}`} />
                    <span className="hidden lg:inline">{info.titulo}</span>
                  </span>
                  <span className="hidden text-2xl leading-none font-bold lg:inline">{clientes.length}</span>
                </span>
                <span className="text-[22px] leading-tight font-bold lg:hidden">{clientes.length}</span>
                <span className="text-[11px] font-semibold lg:hidden">{info.rotulo}</span>
                <span className="text-[10px] font-semibold lg:text-base lg:font-bold">{semCentavos(total)}</span>
                <span className={`hidden flex-col gap-1 border-t border-white/15 pt-2 text-xs font-medium lg:flex`}>
                  {clientes.slice(0, 2).map((c) => (
                    <span key={c.nome} className="flex justify-between gap-2">
                      <span className="truncate">{c.nome}</span>
                      <span className={`shrink-0 ${info.sub}`}>{s === 'critico' ? `${c.atraso} dias` : semCentavos(c.valor)}</span>
                    </span>
                  ))}
                  {clientes.length > 2 && <span className={info.sub}>e mais {clientes.length - 2}</span>}
                  {clientes.length === 0 && <span className={info.sub}>Ninguém aqui</span>}
                </span>
              </button>
            )
          })}
        </section>

        <section aria-label="Cobrar agora" className="cartao flex flex-col gap-1 rounded-[18px] px-4 py-3.5 lg:col-span-8 lg:px-5 lg:py-4.5">
            <div className="flex items-baseline justify-between lg:pb-1.5">
              <h2 className="text-[15px] font-bold lg:text-base">{filtro ? situacoes[filtro].titulo : 'Cobrar agora'}</h2>
              {lista.length > 5 && (
                <button onClick={() => setVerTodos(!verTodos)} className="text-[13px] font-bold text-marca">
                  {verTodos ? 'Ver menos' : `Ver todos (${lista.length})`}
                </button>
              )}
            </div>
            {visiveis.length === 0 && <p className="py-4 text-sm text-suave">Ninguém pra cobrar agora.</p>}
            {visiveis.map((c) => {
              const info = situacoes[c.situacao]
              return (
                <div
                  key={c.parcelaId}
                  className="flex items-center gap-2.5 border-b border-superficie-2 py-2 last:border-b-0"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-[13px] text-[13px] font-extrabold ${info.clara} ${info.escura}`}>{iniciais(c.cliente)}</span>
                  <Link to={`/contratos/${c.contratoId}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{c.cliente}</span>
                    <span className="truncate text-xs text-suave">
                      <span className={`font-bold ${info.escura}`}>{info.curto}</span> · {detalhe(c)} · {reais(c.valor)}
                      {c.encargos > 0 && <span> (com {reais(c.encargos)} de multa/juros)</span>}
                      <span className="hidden lg:inline"> · {nomeModalidade[c.modalidade] ?? c.modalidade}</span>
                    </span>
                  </Link>
                  {c.telefone && (
                    <a
                      href={linkWhatsApp(c.telefone, mensagem(c, p.chavePix))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => rastrear('cobranca_enviada', { canal: 'whatsapp_inicio', situacao: situacaoEvento(c.situacao) })}
                      aria-label={`Cobrar ${c.cliente} no WhatsApp`}
                      className="zap flex size-11 shrink-0 items-center justify-center rounded-xl lg:h-9 lg:w-auto lg:gap-2 lg:px-4 lg:text-[13px] lg:font-extrabold"
                    >
                      <Icone nome="whatsapp" />
                      <span className="hidden lg:inline">Cobrar</span>
                    </a>
                  )}
                </div>
              )
            })}
        </section>

        <section aria-label="Clientes do mês" className="cartao flex items-center gap-5 rounded-[18px] p-5 max-lg:order-1 lg:col-span-4">
            <div
              className="flex size-30 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#2F80FF 0 ${percentual}%, #0F1D36 ${percentual}% 100%)` }}
            >
              <div className="flex size-23 flex-col items-center justify-center rounded-full bg-superficie">
                <span className="font-display text-[26px] font-extrabold">{percentual}%</span>
                <span className="text-[11px] text-suave">dos juros</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-[13px] text-suave">
              <h2 className="text-base font-bold text-texto">Clientes do mês</h2>
              <span>
                <strong className="font-extrabold text-marca">{p.clientesPagaram}</strong> já pagaram
              </span>
              <span>
                <strong className="font-extrabold text-texto">{p.clientesMes - p.clientesPagaram}</strong> ainda vão pagar
              </span>
              <span>
                {p.clientesMes} com parcela em {mes}
              </span>
            </div>
        </section>
      </main>
    </Moldura>
  )
}
