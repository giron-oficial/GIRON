import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CORES } from '../components/GraficoProgressao'
import Icone from '../components/Icone'
import MolduraDono from '../components/MolduraDono'
import { erroCaixa, iniciais, tituloSecao } from '../components/estilo'
import { carregarPainelDono, nomeSituacao, type Financeira, type Mes, type PainelDono, type SituacaoFinanceira } from '../lib/dono'
import { dataBr, reais } from '../lib/formatos'

// Cores do gráfico: as mesmas validadas do gráfico dos Relatórios
const COR_MENSALIDADE = CORES.capital
const COR_IMPLANTACAO = CORES.juros

const corAlerta = { vencido: 'bg-vencido', amanha: 'bg-amanha', hoje: 'bg-hoje anima-pulso', critico: 'bg-critico', suave: 'bg-suave' }

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function MarcaFinanceira({ f, className }: { f: Financeira; className: string }) {
  if (f.logo) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-texto p-1 ${className}`}>
        <img src={f.logo} alt="" className="size-full object-contain" />
      </span>
    )
  }
  return <span className={`flex shrink-0 items-center justify-center bg-superficie-2 font-display font-bold ${className}`}>{iniciais(f.nome)}</span>
}

function Numero({ rotulo, valor, cor, rodape }: { rotulo: string; valor: number; cor?: string; rodape: string }) {
  return (
    <div className="@container flex min-w-0 flex-col gap-1 border-l border-superficie-2 pl-3 first:border-l-0 first:pl-0 lg:pl-4">
      <span className="truncate text-[11px] text-suave lg:text-xs">{rotulo}</span>
      <span className={`truncate font-display text-[clamp(15px,14cqi,28px)] leading-tight font-extrabold tabular-nums ${cor ?? ''}`}>{reais(valor)}</span>
      <span className="truncate text-[11px] text-suave">{rodape}</span>
    </div>
  )
}

// Barras dos últimos 6 meses: mensalidade embaixo, implantação em cima
function Grafico({ meses }: { meses: Mes[] }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const maior = Math.max(1, ...meses.map((m) => m.mensalidade + m.implantacao))
  const m = ativo === null ? meses[meses.length - 1] : meses[ativo]
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-suave">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: COR_MENSALIDADE }} />Mensalidades</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: COR_IMPLANTACAO }} />Implantação</span>
        </div>
        <span className="text-xs text-suave">
          <span className="font-semibold text-texto capitalize">{m.rotulo}</span>: {reais(m.mensalidade + m.implantacao)}
        </span>
      </div>
      <div className="flex h-40 items-end gap-2 lg:gap-4" onMouseLeave={() => setAtivo(null)}>
        {meses.map((x, i) => {
          const total = x.mensalidade + x.implantacao
          return (
            <button
              key={i}
              type="button"
              onClick={() => setAtivo(i)}
              onMouseEnter={() => setAtivo(i)}
              aria-label={`${x.rotulo}: ${reais(total)}`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="flex w-full max-w-12 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${(total / maior) * 100}%`, minHeight: total ? 4 : 0 }}>
                <span style={{ flexGrow: x.implantacao, background: COR_IMPLANTACAO }} />
                <span style={{ flexGrow: x.mensalidade, background: COR_MENSALIDADE }} />
              </span>
              <span className={`text-[11px] capitalize ${x.atual || ativo === i ? 'font-bold text-texto' : 'text-suave'}`}>{x.rotulo}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const filtros: { chave: SituacaoFinanceira | 'todas'; texto: string }[] = [
  { chave: 'todas', texto: 'Todas' },
  { chave: 'em_dia', texto: 'Em dia' },
  { chave: 'teste', texto: 'Em teste' },
  { chave: 'atrasada', texto: 'Atrasadas' },
  { chave: 'bloqueada', texto: 'Bloqueadas' },
]

function Linha({ f }: { f: Financeira }) {
  const s = nomeSituacao[f.situacao]
  const detalhe =
    f.situacao === 'teste'
      ? f.testeFaltam === 0 ? 'Teste termina hoje' : `Teste: faltam ${f.testeFaltam} ${f.testeFaltam === 1 ? 'dia' : 'dias'}`
      : f.atrasado > 0
        ? `${reais(f.atrasado)} em atraso`
        : f.proxima
          ? `Próxima: ${dataBr(f.proxima.vencimento)}`
          : 'Sem cobrança começada'
  return (
    <Link to={`/dono/${f.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-white/5">
      <MarcaFinanceira f={f} className="size-11 rounded-xl text-sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-bold">{f.nome}</span>
        <span className="truncate text-xs text-suave">{detalhe}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.classe}`}>
          <span className={`size-1.5 rounded-full ${s.bolinha}`} />
          {s.texto}
        </span>
        <span className="text-xs text-suave tabular-nums">
          {reais(f.mensalidade)}/mês
          {f.implantacao && ` · impl. ${f.implantacao.pagas}/${f.implantacao.total}`}
        </span>
      </div>
    </Link>
  )
}

export default function DonoPainel() {
  const [p, setP] = useState<PainelDono | null>(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState<SituacaoFinanceira | 'todas'>('todas')

  useEffect(() => {
    carregarPainelDono()
      .then(setP)
      .catch(() => setErro('Não foi possível carregar o painel. Confira a internet e tente de novo.'))
  }, [])

  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const lista = p?.financeiras.filter((f) =>
    filtro === 'todas' ? true : filtro === 'atrasada' ? f.situacao === 'atrasada' || f.situacao === 'vence_hoje' : filtro === 'bloqueada' ? f.situacao === 'bloqueada' || f.situacao === 'parcial' : f.situacao === filtro,
  )
  const qtd = (k: SituacaoFinanceira | 'todas') =>
    !p ? 0 : k === 'todas' ? p.financeiras.length : k === 'atrasada' ? p.contagem.atrasada + p.contagem.vence_hoje : k === 'bloqueada' ? p.contagem.bloqueada + p.contagem.parcial : p.contagem[k]

  return (
    <MolduraDono>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-5 lg:max-w-none lg:px-0 lg:pt-1">
        <header>
          <p className="text-sm text-suave">{saudacao()}! Aqui é o seu negócio.</p>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">Suas financeiras</h1>
        </header>

        {erro && <p className={erroCaixa}>{erro}</p>}

        {p && (
          <div className="grid gap-4 lg:grid-cols-12">
            <section aria-label="Dinheiro do mês" className="vidro flex flex-col gap-4 rounded-[18px] p-5 lg:col-span-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm text-[#BFD8FF]">Recebido em {mes}</span>
                  <span className="font-display text-[40px] leading-none font-extrabold tabular-nums lg:text-[48px]">{reais(p.recebidoMes)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Numero rotulo="Falta entrar no mês" valor={p.aReceberMes} rodape="ainda vai vencer" />
                <Numero rotulo="Atrasado" valor={p.atrasado} cor={p.atrasado > 0 ? 'text-vencido' : ''} rodape="já venceu" />
                <Numero rotulo="Mensal fixo" valor={p.mensalFixo} cor="text-sucesso" rodape="todo mês" />
              </div>
            </section>

            <section aria-label="Recebido nos últimos meses" className="cartao flex flex-col gap-3 rounded-[18px] p-5 lg:col-span-5">
              <h2 className={tituloSecao}>Últimos 6 meses</h2>
              <Grafico meses={p.meses} />
            </section>

            <section aria-label="Avisos de hoje" className="cartao flex flex-col gap-1 rounded-[18px] p-4 lg:col-span-5 lg:p-5">
              <h2 className={`${tituloSecao} mb-2`}>Precisa da sua atenção</h2>
              {p.alertas.length === 0 && <p className="py-3 text-sm text-suave">Tudo tranquilo hoje. Nenhuma financeira precisa de você.</p>}
              {p.alertas.map((a, i) => (
                <Link key={i} to={`/dono/${a.financeira.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5">
                  <span className={`size-2.5 shrink-0 rounded-full ${corAlerta[a.cor]}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold">{a.financeira.nome}</span>
                    <span className="text-xs text-suave">{a.texto}</span>
                  </span>
                  <Icone nome="direita" tamanho={18} className="shrink-0 text-suave" />
                </Link>
              ))}
            </section>

            <section aria-label="Financeiras" className="cartao flex flex-col gap-3 rounded-[18px] p-4 lg:col-span-7 lg:p-5">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filtros.map((x) => (
                  <button
                    key={x.chave}
                    onClick={() => setFiltro(x.chave)}
                    className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${filtro === x.chave ? 'zap' : 'bg-superficie-2 text-suave'}`}
                  >
                    {x.texto} <span className="tabular-nums opacity-75">{qtd(x.chave)}</span>
                  </button>
                ))}
              </div>
              {lista?.length === 0 && (
                <p className="py-4 text-center text-sm text-suave">{p.financeiras.length ? 'Nenhuma financeira nesse filtro.' : 'Nenhuma financeira cadastrada ainda.'}</p>
              )}
              <div className="flex flex-col">
                {lista?.map((f) => <Linha key={f.id} f={f} />)}
              </div>
            </section>
          </div>
        )}
      </main>
    </MolduraDono>
  )
}
