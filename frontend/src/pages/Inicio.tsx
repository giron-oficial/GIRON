import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icone, { type NomeIcone } from '../components/Icone'
import Moldura from '../components/Moldura'
import { dataBr, linkWhatsApp, nomeModalidade, reais } from '../lib/formatos'
import { carregarPainel, type Cobranca, type Painel, type Situacao } from '../lib/painel'

// Cores e textos das 4 situações (bolinhas de vencimento): cartão de cor cheia, em degradê da mesma cor
const situacoes: Record<Situacao, { rotulo: string; curto: string; titulo: string; cartao: string; sub: string; bolinha: string; clara: string; escura: string }> = {
  critico: { rotulo: 'Críticos', curto: 'Crítico', titulo: 'Críticos', cartao: 'bg-linear-135 from-[#A48CFF] to-[#6A42F0] text-white shadow-critico/35', sub: 'text-[#E4DCFF]', bolinha: 'bg-white', clara: 'bg-[#EFE9FF]', escura: 'text-[#5B3BE0]' },
  vencido: { rotulo: 'Vencidos', curto: 'Vencido', titulo: 'Vencidos', cartao: 'bg-linear-135 from-[#FF8A7A] to-[#D92D3A] text-white shadow-vencido/35', sub: 'text-[#FFDADB]', bolinha: 'bg-white', clara: 'bg-[#FFE9E8]', escura: 'text-[#D13438]' },
  hoje: { rotulo: 'Hoje', curto: 'Hoje', titulo: 'Vencem hoje', cartao: 'bg-linear-135 from-[#6AA6FF] to-[#2255D4] text-white shadow-hoje/35', sub: 'text-[#D6E4FF]', bolinha: 'bg-[#FF3B3B] anima-pulso', clara: 'bg-[#E4EEFF]', escura: 'text-hoje' },
  amanha: { rotulo: 'Amanhã', curto: 'Amanhã', titulo: 'Vencem amanhã', cartao: 'bg-linear-135 from-[#FFD25C] to-[#F09400] text-sobre-amanha shadow-amanha/35', sub: 'text-[#5C3D00]', bolinha: 'bg-sobre-amanha', clara: 'bg-[#FFF3D1]', escura: 'text-[#C27C00]' },
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
    <div className="cartao flex min-w-0 flex-col gap-1.5 rounded-[20px] p-3 lg:gap-2.5 lg:rounded-[26px] lg:p-5">
      <span className={`flex size-7.5 items-center justify-center rounded-[10px] lg:size-9.5 lg:rounded-xl ${cor}`}>
        <Icone nome={icone} tamanho={16} />
      </span>
      <span className="truncate text-[11px] text-suave lg:text-[13px]">{rotulo}</span>
      <span className="truncate font-display text-[17px] font-bold lg:text-[28px]">{semCentavos(valor)}</span>
      {barra !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-superficie-2 lg:h-1.5">
          <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${barra}%` }} />
        </div>
      )}
      <span className="truncate text-[10px] text-[#8A909C] lg:text-xs">{rodape}</span>
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
          <div className="h-12 w-48 animate-pulse rounded-xl bg-black/5" />
          <div className="h-32 animate-pulse rounded-3xl bg-black/5" />
          <div className="h-24 animate-pulse rounded-3xl bg-black/5" />
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
  const percentual = totalJuros > 0 ? Math.round((p.jurosRecebidos / totalJuros) * 100) : 0
  const lista = filtro ? p.cobrancas.filter((c) => c.situacao === filtro) : p.cobrancas
  const visiveis = verTodos ? lista : lista.slice(0, 5)
  const nome = empresa.nome_empresa.split(' ')[0]

  return (
    <Moldura>
      <main className="mx-auto flex max-w-md flex-col gap-3.5 px-4 pt-5 lg:max-w-none lg:gap-4 lg:px-0 lg:pt-1">
        <div className="flex items-center justify-between lg:hidden">
          <span className="flex items-center gap-2">
            <span className="verde flex size-7.5 items-center justify-center rounded-[10px] font-display text-sm font-extrabold">G</span>
            <span className="font-display text-[15px] font-bold tracking-wider">GIRON</span>
          </span>
          <span className="flex size-10 items-center justify-center rounded-[13px] bg-tinta font-display text-[13px] font-bold text-white">{iniciais(empresa.nome_empresa)}</span>
        </div>

        <header className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-suave">{hojeEscrito()}</p>
            <h1 className="truncate text-2xl font-bold tracking-tight lg:text-[28px]">
              {saudacao()}, {nome}
            </h1>
          </div>
          <Link to="/clientes" className="cartao hidden h-11 items-center rounded-2xl px-4 text-sm font-semibold hover:text-marca lg:flex">
            Ver clientes
          </Link>
        </header>

        {statusAcesso[empresa.status_acesso] && (
          <p className="rounded-2xl bg-[#FFF3D1] px-4 py-3 text-sm font-semibold text-sobre-amanha">{statusAcesso[empresa.status_acesso]}</p>
        )}

        <section aria-label="Resumo do mês" className="grid gap-2.5 lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:gap-3.5">
          <div className="relative flex flex-col gap-2.5 overflow-hidden rounded-[26px] bg-linear-135 from-[#0E4D36] from-0% to-tinta to-62% px-5 py-4.5 text-white shadow-xl shadow-[#0E4D36]/30 lg:p-5.5">
            <div className="pointer-events-none absolute -top-15 -right-12.5 size-50 rounded-full bg-[radial-gradient(circle,rgb(34_209_132/0.55),transparent_70%)]" />
            <svg width="150" height="54" viewBox="0 0 150 54" fill="none" aria-hidden="true" className="pointer-events-none absolute right-4 bottom-4">
              <path d="M2 46 C 22 40, 30 44, 46 34 S 74 30, 88 22 S 118 18, 148 6" stroke="#5BE3A4" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="148" cy="6" r="4" fill="#5BE3A4" />
            </svg>
            <span className="relative flex items-center gap-1.5 text-xs text-[#B7F0D3] lg:text-[13px]">
              <span className="size-1.5 rounded-full bg-marca-brilho" />
              Capital em trânsito
            </span>
            <span className="relative font-display text-[38px] leading-none font-extrabold tracking-tight lg:text-[40px]">{semCentavos(p.capitalTransito)}</span>
            <span className="relative text-xs text-[#A1A7B3]">
              {p.contratosAtivos} {p.contratosAtivos === 1 ? 'contrato ativo' : 'contratos ativos'} na rua
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:contents">
            <CartaoValor
              rotulo="Juros recebidos"
              valor={p.jurosRecebidos}
              icone="moeda"
              cor="bg-[#DDF7EA] text-marca"
              barra={percentual}
              rodape={`${percentual}% · faltam ${semCentavos(p.jurosPendentes)}`}
            />
            <CartaoValor rotulo="Capital recebido" valor={p.capitalRecebido} icone="entrando" cor="bg-[#E3EDFF] text-hoje" rodape="voltou pro caixa" />
            <CartaoValor
              rotulo="Emprestado no mês"
              valor={p.emprestado}
              icone="saindo"
              cor="bg-[#FFF1D1] text-[#C27C00]"
              rodape={`${p.contratosNovos} ${p.contratosNovos === 1 ? 'contrato novo' : 'contratos novos'}`}
            />
          </div>
        </section>

        <section aria-label="Situação dos clientes" className="grid grid-cols-4 gap-2 lg:gap-3.5">
          {ordemSituacoes.map((s) => {
            const info = situacoes[s]
            const itens = p.cobrancas.filter((c) => c.situacao === s)
            const ativo = filtro === s
            return (
              <button
                key={s}
                onClick={() => setFiltro(ativo ? null : s)}
                aria-pressed={ativo}
                className={`flex flex-col items-center gap-0.5 rounded-[20px] px-1.5 pt-3 pb-2.5 text-left shadow-lg transition lg:items-stretch lg:gap-2.5 lg:rounded-3xl lg:p-4.5 ${info.cartao} ${ativo ? 'ring-4 ring-tinta/80 ring-offset-2 ring-offset-fundo' : ''}`}
              >
                <span className="flex items-center gap-2 lg:justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className={`size-2.5 rounded-full ring-4 ring-white/25 ${info.bolinha}`} />
                    <span className="hidden lg:inline">{info.titulo}</span>
                  </span>
                  <span className="hidden font-display text-[32px] font-extrabold lg:inline">{itens.length}</span>
                </span>
                <span className="font-display text-[28px] font-extrabold lg:hidden">{itens.length}</span>
                <span className="text-[11px] font-bold lg:hidden">{info.rotulo}</span>
                <span className={`text-[10px] lg:text-[13px] ${info.sub}`}>{semCentavos(itens.reduce((t, c) => t + c.valor, 0))}</span>
                <span className="hidden flex-col gap-1 text-[13px] lg:flex">
                  {itens.slice(0, 2).map((c) => (
                    <span key={c.parcelaId} className="flex justify-between gap-2">
                      <span className="truncate">{c.cliente}</span>
                      <span className={`shrink-0 ${info.sub}`}>{c.situacao === 'critico' ? `${c.atraso} dias` : semCentavos(c.valor)}</span>
                    </span>
                  ))}
                  {itens.length === 0 && <span className={info.sub}>Ninguém aqui</span>}
                </span>
              </button>
            )
          })}
        </section>

        <div className="grid gap-3.5 lg:grid-cols-[1.7fr_1fr]">
          <section aria-label="Cobrar agora" className="flex flex-col gap-2 lg:cartao lg:gap-1 lg:rounded-[26px] lg:px-5 lg:py-4.5">
            <div className="flex items-baseline justify-between lg:pb-1.5">
              <h2 className="text-[15px] font-bold lg:text-base">{filtro ? situacoes[filtro].titulo : 'Cobrar agora'}</h2>
              {lista.length > 5 && (
                <button onClick={() => setVerTodos(!verTodos)} className="text-[13px] font-bold text-marca">
                  {verTodos ? 'Ver menos' : `Ver todos (${lista.length})`}
                </button>
              )}
            </div>
            {visiveis.length === 0 && <p className="cartao rounded-[20px] px-4 py-5 text-sm text-suave lg:bg-transparent lg:px-0 lg:shadow-none">Ninguém pra cobrar agora.</p>}
            {visiveis.map((c) => {
              const info = situacoes[c.situacao]
              return (
                <div
                  key={c.parcelaId}
                  className="cartao flex items-center gap-2.5 rounded-[20px] py-2.25 pr-2.25 pl-2.5 lg:rounded-none lg:border-b lg:border-superficie-2 lg:bg-transparent lg:px-0 lg:py-1.5 lg:shadow-none"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-[13px] text-[13px] font-extrabold ${info.clara} ${info.escura}`}>{iniciais(c.cliente)}</span>
                  <Link to={`/contratos/${c.contratoId}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{c.cliente}</span>
                    <span className="truncate text-xs text-suave">
                      <span className={`font-bold ${info.escura}`}>{info.curto}</span> · {detalhe(c)} · {reais(c.valor)}
                      <span className="hidden lg:inline"> · {nomeModalidade[c.modalidade] ?? c.modalidade}</span>
                    </span>
                  </Link>
                  {c.telefone && (
                    <a
                      href={linkWhatsApp(c.telefone, mensagem(c, p.chavePix))}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Cobrar ${c.cliente} no WhatsApp`}
                      className="verde flex size-11 shrink-0 items-center justify-center rounded-[14px] shadow-md shadow-marca/30 lg:h-9 lg:w-auto lg:gap-2 lg:rounded-xl lg:px-4 lg:text-[13px] lg:font-bold"
                    >
                      <Icone nome="whatsapp" />
                      <span className="hidden lg:inline">Cobrar</span>
                    </a>
                  )}
                </div>
              )
            })}
          </section>

          <section aria-label="Clientes do mês" className="cartao flex items-center gap-5 rounded-[26px] p-5">
            <div
              className="flex size-30 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#12B76A 0 ${percentual}%, #EEF0F3 ${percentual}% 100%)` }}
            >
              <div className="flex size-23 flex-col items-center justify-center rounded-full bg-white">
                <span className="font-display text-[26px] font-extrabold">{percentual}%</span>
                <span className="text-[11px] text-[#8A909C]">dos juros</span>
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
                {p.clientesMes} com parcela em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}
              </span>
            </div>
          </section>
        </div>
      </main>
    </Moldura>
  )
}
