import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Interruptor from '../components/Interruptor'
import MolduraDono from '../components/MolduraDono'
import { botaoClaro, botaoZap, campo, erroCaixa, rotulo, tituloSecao } from '../components/estilo'
import { carregarPainelDono, donoAcoes, iso, nomeSituacao, type Cobranca, type Financeira } from '../lib/dono'
import { dataBr, linkWhatsApp, mascaraReais, mascaraTelefone, numeroBr, reais, reaisCampo } from '../lib/formatos'
import { MarcaFinanceira } from './DonoPainel'

const PLANOS = [
  { comRobo: false, valor: 69.9, texto: 'Sem robô', detalhe: 'Só o sistema' },
  { comRobo: true, valor: 89.9, texto: 'Com robô', detalhe: 'Sistema + robô no Telegram' },
]

const maisDias = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00')
  x.setDate(x.getDate() + n)
  return iso(x)
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="cartao flex flex-col gap-3 rounded-[18px] p-4 lg:p-5">
      <h2 className={tituloSecao}>{titulo}</h2>
      {children}
    </section>
  )
}

function Ajuste({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-superficie-2 pt-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-bold">{titulo}</span>
        <span className="text-xs text-suave">{texto}</span>
      </div>
      {children}
    </div>
  )
}

const nomeCobranca = (c: Cobranca) => (c.tipo === 'mensalidade' ? 'Mensalidade' : `Implantação ${c.parcela}/${c.parcelasTotal}`)

// Começar a cobrar: plano, 1º vencimento e implantação parcelada
function ComecarCobranca({ f, pronto }: { f: Financeira; pronto: () => void }) {
  const hoje = iso(new Date())
  const inicio = f.testeGratisAte && f.testeGratisAte >= hoje ? maisDias(f.testeGratisAte, 1) : hoje
  const [comRobo, setComRobo] = useState(f.robo)
  const [vencimento, setVencimento] = useState(inicio)
  const [implantacao, setImplantacao] = useState(reaisCampo(800))
  const [parcelas, setParcelas] = useState(10)
  const [vencImpl, setVencImpl] = useState(inicio)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const plano = PLANOS.find((p) => p.comRobo === comRobo)!
  const valorImpl = numeroBr(implantacao) || 0

  async function salvar() {
    setErro('')
    setEnviando(true)
    const { error } = await donoAcoes.comecarCobranca({
      tenant: f.id,
      mensalidade: plano.valor,
      primeiroVencimento: vencimento,
      implantacao: valorImpl,
      parcelas,
      implantacaoVencimento: vencImpl,
      comRobo,
    })
    setEnviando(false)
    if (error) setErro('Não foi possível começar a cobrança. Confira os dados e tente de novo.')
    else pronto()
  }

  return (
    <Bloco titulo="Começar a cobrar">
      <p className="text-sm text-suave">Escolha o plano e as datas. O sistema cria a mensalidade e as parcelas da implantação.</p>
      <div className="grid grid-cols-2 gap-2">
        {PLANOS.map((p) => (
          <button
            key={p.texto}
            type="button"
            onClick={() => setComRobo(p.comRobo)}
            className={`flex flex-col items-start gap-0.5 rounded-2xl border p-3 text-left ${p.comRobo === comRobo ? 'zap' : 'border-borda bg-superficie-2'}`}
          >
            <span className="text-sm font-bold">{p.texto}</span>
            <span className="font-display text-lg font-extrabold tabular-nums">{reais(p.valor)}</span>
            <span className="text-[11px] text-suave">{p.detalhe}</span>
          </button>
        ))}
      </div>
      <label className={rotulo}>
        1º vencimento da mensalidade
        <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={`${campo} [color-scheme:dark]`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={rotulo}>
          Implantação
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 mt-0.75 -translate-y-1/2 text-suave">R$</span>
            <input inputMode="numeric" value={implantacao} onChange={(e) => setImplantacao(mascaraReais(e.target.value))} placeholder="0,00" className={`${campo} pl-11`} />
          </div>
        </label>
        <label className={rotulo}>
          Em quantas vezes
          <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className={campo}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}x de {reais(Math.trunc((valorImpl / n) * 100) / 100)}</option>
            ))}
          </select>
        </label>
      </div>
      {valorImpl > 0 && (
        <label className={rotulo}>
          1ª parcela da implantação vence em
          <input type="date" value={vencImpl} onChange={(e) => setVencImpl(e.target.value)} className={`${campo} [color-scheme:dark]`} />
        </label>
      )}
      {erro && <p className={erroCaixa}>{erro}</p>}
      <button onClick={salvar} disabled={enviando || !vencimento} className={botaoZap}>
        {enviando ? 'Salvando…' : 'Começar a cobrar'}
      </button>
    </Bloco>
  )
}

// Uma cobrança em aberto: uma linha só (nome, vencimento, valor e o botão Receber)
function Aberta({ c, hoje, receber }: { c: Cobranca; hoje: string; receber: () => void }) {
  const atraso = c.vencimento < hoje ? Math.round((Date.parse(hoje) - Date.parse(c.vencimento)) / 86400000) : 0
  const situacao = atraso > 0 ? { t: `${atraso} ${atraso === 1 ? 'dia' : 'dias'} de atraso`, c: 'text-vencido' } : c.vencimento === hoje ? { t: 'Vence hoje', c: 'text-hoje' } : { t: `Vence ${dataBr(c.vencimento)}`, c: 'text-suave' }
  return (
    <div className="flex items-center gap-3 border-t border-superficie-2 py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-bold">{nomeCobranca(c)}</span>
        <span className={`text-xs font-semibold ${situacao.c}`}>{situacao.t}</span>
      </div>
      <span className="shrink-0 font-display font-extrabold tabular-nums">{reais(c.valor)}</span>
      <button onClick={receber} className="zap h-9 shrink-0 rounded-xl px-3 text-sm font-bold">Receber</button>
    </div>
  )
}

// Janela pequena por cima da ficha pra confirmar o recebimento
function JanelaReceber({ c, f, hoje, fechar, pronto }: { c: Cobranca; f: Financeira; hoje: string; fechar: () => void; pronto: () => void }) {
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const atraso = c.vencimento < hoje
  const texto = `Olá${f.responsavel ? `, ${f.responsavel.split(' ')[0]}` : ''}! Aqui é do GIRON. A ${nomeCobranca(c).toLowerCase()} de ${reais(c.valor)} ${atraso ? `venceu em ${dataBr(c.vencimento)}` : c.vencimento === hoje ? 'vence hoje' : `vence em ${dataBr(c.vencimento)}`}.`

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [fechar])

  async function confirmar() {
    setErro('')
    setEnviando(true)
    const { error } = await donoAcoes.receber(c.id, data)
    setEnviando(false)
    if (error) setErro('Não foi possível marcar como recebido. Tente de novo.')
    else pronto()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Receber pagamento" onClick={(e) => e.stopPropagation()} className="cartao flex w-full max-w-sm flex-col gap-4 rounded-[18px] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs text-suave">{f.nome}</span>
            <span className="font-bold">{nomeCobranca(c)}</span>
            <span className="text-xs text-suave">Vencimento {dataBr(c.vencimento)}</span>
          </div>
          <button onClick={fechar} aria-label="Fechar" className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-xl text-suave hover:bg-white/5">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>
        <span className="font-display text-3xl font-extrabold tabular-nums">{reais(c.valor)}</span>
        <label className="text-xs font-semibold text-suave">
          Recebido em
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={`${campo} [color-scheme:dark]`} />
        </label>
        {erro && <p className={erroCaixa}>{erro}</p>}
        <button onClick={confirmar} disabled={!data || enviando} className={botaoZap}>
          <Icone nome="certo" tamanho={18} />
          {enviando ? 'Salvando…' : 'Confirmar recebimento'}
        </button>
        {f.telefone && (
          <a href={linkWhatsApp(f.telefone, texto)} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold text-suave hover:text-texto">
            Ainda não pagou? Cobrar no WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}

function Contato({ f, mudou }: { f: Financeira; mudou: () => void }) {
  const [responsavel, setResponsavel] = useState(f.responsavel)
  const [telefone, setTelefone] = useState(mascaraTelefone(f.telefone))
  const [observacao, setObservacao] = useState(f.observacao)
  const [mensalidade, setMensalidade] = useState(reaisCampo(f.mensalidade))
  const [msg, setMsg] = useState('')

  async function salvar() {
    setMsg('')
    const { error } = await donoAcoes.contato(f.id, { responsavel: responsavel.trim(), telefone: telefone.replace(/\D/g, ''), observacao: observacao.trim(), mensalidade: numeroBr(mensalidade) || 0 })
    setMsg(error ? 'Não foi possível salvar.' : 'Salvo.')
    if (!error) mudou()
  }

  return (
    <Bloco titulo="Contato e anotações">
      <label className={rotulo}>
        Responsável
        <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome de quem cuida da financeira" className={campo} />
      </label>
      <label className={rotulo}>
        WhatsApp
        <input inputMode="tel" value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} placeholder="(63) 99999-9999" className={campo} />
      </label>
      <label className={rotulo}>
        Valor da mensalidade
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 mt-0.75 -translate-y-1/2 text-suave">R$</span>
          <input inputMode="numeric" value={mensalidade} onChange={(e) => setMensalidade(mascaraReais(e.target.value))} className={`${campo} pl-11`} />
        </div>
        <span className="mt-1 block text-xs font-normal text-suave">Vale a partir da próxima mensalidade que o sistema criar.</span>
      </label>
      <label className={rotulo}>
        Anotações (só você vê)
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Ex.: paga sempre no dia 10, combinado desconto..." className={campo} />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={salvar} className={`${botaoClaro} flex-1`}>Salvar</button>
        {msg && <span className="text-sm text-suave">{msg}</span>}
      </div>
    </Bloco>
  )
}

export default function DonoFinanceira() {
  const { id } = useParams()
  const [f, setF] = useState<Financeira | null>(null)
  const [erro, setErro] = useState('')
  const [verPagas, setVerPagas] = useState(false)
  const [verAbertas, setVerAbertas] = useState(false)
  const [receber, setReceber] = useState<Cobranca | null>(null)
  const hoje = iso(new Date())

  const carregar = useCallback(() => {
    carregarPainelDono()
      .then((p) => {
        const achou = p.financeiras.find((x) => x.id === id) ?? null
        setF(achou)
        if (!achou) setErro('Financeira não encontrada.')
      })
      .catch(() => setErro('Não foi possível carregar. Confira a internet e tente de novo.'))
  }, [id])
  useEffect(carregar, [carregar])

  async function acao(p: PromiseLike<{ error: unknown }>) {
    setErro('')
    const { error } = await p
    if (error) setErro('Não foi possível fazer isso agora. Tente de novo.')
    carregar()
  }

  const s = f ? nomeSituacao[f.situacao] : null
  const abertas = f?.cobrancas.filter((c) => !c.pagoEm) ?? []
  const pagas = f?.cobrancas.filter((c) => c.pagoEm).reverse() ?? []

  return (
    <MolduraDono>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-5 lg:max-w-4xl lg:px-0 lg:pt-1">
        <Link to="/dono" className="-ml-2 inline-flex w-fit items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-semibold text-suave hover:text-texto">
          ← Voltar
        </Link>
        {erro && <p className={erroCaixa}>{erro}</p>}

        {f && s && (
          <>
            <header className="flex items-center gap-3">
              <MarcaFinanceira f={f} className="size-14 rounded-2xl text-lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="truncate text-2xl font-bold tracking-tight">{f.nome}</h1>
                <span className="flex flex-wrap items-center gap-2 text-xs text-suave">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold ${s.classe}`}>
                    <span className={`size-1.5 rounded-full ${s.bolinha}`} />
                    {s.texto}
                  </span>
                  {f.subdominio}.gironga.com.br
                </span>
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Bloco titulo="Acesso">
                  {f.testeGratisAte && (
                    <Ajuste titulo={`Teste grátis até ${dataBr(f.testeGratisAte)}`} texto={f.testeFaltam === 0 ? 'Termina hoje' : `Faltam ${f.testeFaltam} ${f.testeFaltam === 1 ? 'dia' : 'dias'}. No 1º pagamento o teste acaba.`}>
                      <button onClick={() => acao(donoAcoes.estenderTeste(f.id, 5))} className="h-10 shrink-0 rounded-xl bg-superficie-2 px-3 text-sm font-semibold">+5 dias</button>
                    </Ajuste>
                  )}
                  {f.liberadoManualAte ? (
                    <Ajuste titulo={`Liberada na mão até ${dataBr(f.liberadoManualAte)}`} texto="Funciona mesmo atrasada. Depois volta a regra normal.">
                      <button onClick={() => acao(donoAcoes.liberarAte(f.id, null))} className="h-10 shrink-0 rounded-xl bg-superficie-2 px-3 text-sm font-semibold">Tirar</button>
                    </Ajuste>
                  ) : (
                    (f.situacao === 'bloqueada' || f.situacao === 'parcial') && (
                      <Ajuste titulo="Liberar por 3 dias" texto="Pra quando ela prometeu pagar. O bloqueio volta sozinho depois.">
                        <button onClick={() => acao(donoAcoes.liberarAte(f.id, maisDias(hoje, 3)))} className="h-10 shrink-0 rounded-xl zap px-3 text-sm font-semibold">Liberar</button>
                      </Ajuste>
                    )
                  )}
                  <Ajuste titulo="Robô do Telegram" texto={f.robo ? 'Ligado' : 'Desligado'}>
                    <Interruptor verde rotulo="Robô do Telegram" ligado={f.robo} onChange={(v) => acao(donoAcoes.robo(f.id, v))} />
                  </Ajuste>
                  <Ajuste titulo="Travar (só consulta)" texto="Ela vê tudo, mas não consegue mexer em nada.">
                    <Interruptor verde rotulo="Travar (só consulta)" ligado={f.bloqueioManual} onChange={(v) => acao(donoAcoes.travar(f.id, v))} />
                  </Ajuste>
                </Bloco>

                {f.cobrancas.length === 0 ? (
                  <ComecarCobranca f={f} pronto={carregar} />
                ) : (
                  <Bloco titulo="Cobranças em aberto">
                    {abertas.length === 0 && <p className="text-sm text-suave">Nada em aberto. Tudo pago.</p>}
                    <div className="flex flex-col">
                      {(verAbertas ? abertas : abertas.slice(0, 3)).map((c) => (
                        <Aberta key={c.id} c={c} hoje={hoje} receber={() => setReceber(c)} />
                      ))}
                    </div>
                    {abertas.length > 3 && (
                      <button onClick={() => setVerAbertas(!verAbertas)} className="text-left text-sm font-semibold text-marca">
                        {verAbertas ? 'Mostrar menos' : `Ver todas (${abertas.length})`}
                      </button>
                    )}
                  </Bloco>
                )}

                {pagas.length > 0 && (
                  <Bloco titulo={`Já recebido · ${reais(pagas.reduce((x, c) => x + c.valor, 0))}`}>
                    {(verPagas ? pagas : pagas.slice(0, 3)).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-semibold">{nomeCobranca(c)}</span>
                          <span className="text-xs text-suave">Recebido em {dataBr(c.pagoEm!)}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-bold text-sucesso tabular-nums">{reais(c.valor)}</span>
                          <button
                            onClick={() => confirm('Desfazer esse recebimento? Ele volta a ficar em aberto.') && acao(donoAcoes.desfazer(c.id))}
                            className="rounded-lg px-2 py-1 text-xs text-suave hover:bg-white/5 hover:text-texto"
                          >
                            Desfazer
                          </button>
                        </div>
                      </div>
                    ))}
                    {pagas.length > 3 && (
                      <button onClick={() => setVerPagas(!verPagas)} className="text-left text-sm font-semibold text-marca">
                        {verPagas ? 'Mostrar menos' : `Ver todos (${pagas.length})`}
                      </button>
                    )}
                  </Bloco>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <Bloco titulo="Como ela está usando">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="flex flex-col"><span className="font-display text-2xl font-extrabold tabular-nums">{f.clientes}</span><span className="text-[11px] text-suave">clientes</span></div>
                    <div className="flex flex-col"><span className="font-display text-2xl font-extrabold tabular-nums">{f.contratosAtivos}</span><span className="text-[11px] text-suave">contratos ativos</span></div>
                    <div className="flex flex-col"><span className="font-display text-lg leading-8 font-extrabold">{f.ultimoAcesso ? dataBr(f.ultimoAcesso.slice(0, 10)) : '—'}</span><span className="text-[11px] text-suave">último acesso</span></div>
                  </div>
                  {f.implantacao && (
                    <div className="flex flex-col gap-1.5 border-t border-superficie-2 pt-3">
                      <div className="flex justify-between text-xs"><span className="text-suave">Implantação: {f.implantacao.pagas} de {f.implantacao.total} pagas</span><span className="font-bold tabular-nums">{reais(f.implantacao.valorPago)} de {reais(f.implantacao.valorTotal)}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
                        <div className="h-full rounded-full bg-linear-90 from-marca-clara to-marca" style={{ width: `${(f.implantacao.pagas / f.implantacao.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-suave">Você vê só os números. Os clientes dela continuam protegidos.</p>
                </Bloco>
                <Contato key={f.id + f.mensalidade + f.telefone + f.responsavel + f.observacao} f={f} mudou={carregar} />
              </div>
            </div>
          </>
        )}
        {f && receber && (
          <JanelaReceber
            c={receber}
            f={f}
            hoje={hoje}
            fechar={() => setReceber(null)}
            pronto={() => {
              setReceber(null)
              carregar()
            }}
          />
        )}
      </main>
    </MolduraDono>
  )
}
