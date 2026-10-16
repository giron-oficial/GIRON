import { useEffect, useMemo, useState, type InputHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoClaro, botaoVerde, campo, erroCaixa, rotulo, tituloSecao } from '../components/estilo'
import { textoExtrato, textoSimulacao, textoTarjeta, valorTexto, forma, type ParcelaCalc } from '../lib/calculadora'
import { linkWhatsApp, mascaraPercentual, mascaraReais, numeroBr, percentualCompleto, reais } from '../lib/formatos'
import { supabase } from '../lib/supabase'

// Calculadora GIRON (cofre: 06-ESPECIFICACAO/CALCULADORA.md): mensal na Forma da Empresa.
// Simula várias quantidades, monta os textos pro WhatsApp e, com o cliente aprovado, grava o empréstimo.
// As contas são do banco (emprestimo_simular / contrato_criar), as mesmas do "Novo empréstimo".

type Calculo = { juro_total: number; total: number; parcelas: ParcelaCalc[] }
type Cliente = { id: string; nome_completo: string; telefone: string; status_cadastro: string }

const PADRAO = [6, 8, 10, 12, 14, 16]

const hoje = () => new Date().toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso do celular

function proximoMes(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12)
  alvo.setDate(Math.min(d.getDate(), new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()))
  return alvo.toLocaleDateString('sv-SE')
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function CampoComSinal({ id, sinal, lado, ...resto }: { id: string; sinal: string; lado: 'antes' | 'depois' } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input id={id} {...resto} className={`${campo} tabular-nums ${lado === 'antes' ? 'pl-11' : 'pr-10'}`} />
      <span className={`pointer-events-none absolute top-1/2 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave ${lado === 'antes' ? 'left-4' : 'right-4'}`}>{sinal}</span>
    </div>
  )
}

// Caixa com o texto pronto + Copiar + WhatsApp
function CaixaTexto({ titulo, texto, telefone }: { titulo: string; texto: string; telefone?: string }) {
  const [aviso, setAviso] = useState('')
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('Copiado!')
    } catch {
      setAviso('Não deu pra copiar sozinho. Segure o dedo no texto e copie.')
    }
    setTimeout(() => setAviso(''), 2500)
  }
  const zap = telefone ? linkWhatsApp(telefone, texto) : `https://wa.me/?text=${encodeURIComponent(texto)}`
  return (
    <section className="cartao mt-3 flex flex-col gap-3 rounded-[22px] p-4 lg:p-5">
      <p className={tituloSecao}>{titulo}</p>
      <pre className="overflow-x-auto rounded-2xl border border-borda bg-fundo p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-texto select-all">{texto}</pre>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copiar} className={botaoClaro}>
          <Icone nome="copiar" tamanho={18} />
          Copiar
        </button>
        <a href={zap} target="_blank" rel="noreferrer" className={botaoVerde}>
          <Icone nome="whatsapp" tamanho={18} />
          WhatsApp
        </a>
      </div>
      {aviso && <p className="text-center text-xs font-semibold text-marca">{aviso}</p>}
    </section>
  )
}

export default function Calculadora() {
  const navegar = useNavigate()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [nome, setNome] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [capital, setCapital] = useState('1.000,00')
  const [juroPct, setJuroPct] = useState('10')
  const [inicio, setInicio] = useState(hoje())
  const [primeiro, setPrimeiro] = useState(proximoMes(hoje()))
  const [qtds, setQtds] = useState<number[]>(PADRAO)
  const [novaQtd, setNovaQtd] = useState('')
  const [calc, setCalc] = useState<Record<number, Calculo>>({})
  const [escolhida, setEscolhida] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [linkCadastro, setLinkCadastro] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nome_completo, telefone, status_cadastro').order('nome_completo'),
      supabase.from('fomentado_configuracoes').select('juro_padrao_percentual').maybeSingle(),
    ]).then(([{ data: cs }, { data: cfg }]) => {
      setClientes((cs as Cliente[]) ?? [])
      if (cfg?.juro_padrao_percentual != null) setJuroPct(percentualCompleto(Number(cfg.juro_padrao_percentual)))
    })
  }, [])

  const cap = capital ? numeroBr(capital) : 0
  const taxa = juroPct ? numeroBr(juroPct) : NaN

  // Simula todas as quantidades sempre que muda algum número
  useEffect(() => {
    if (!cap || cap <= 0 || isNaN(taxa) || !primeiro || !qtds.length || primeiro <= inicio) {
      const limpa = setTimeout(() => {
        setCalc({})
        setErro(primeiro && primeiro <= inicio ? 'A 1ª parcela precisa ser depois do dia do empréstimo.' : '')
      }, 0)
      return () => clearTimeout(limpa)
    }
    const t = setTimeout(async () => {
      const res = await Promise.all(
        qtds.map((n) =>
          supabase.rpc('emprestimo_simular', {
            p_modalidade: 'mensal', p_sistema: 'empresa', p_capital: cap, p_juro_mensal_percentual: taxa,
            p_quantidade: n, p_data_contrato: inicio, p_primeiro_vencimento: primeiro,
          }),
        ),
      )
      const erroSim = res.find((r) => r.error)?.error
      if (erroSim) { setErro(erroSim.message); setCalc({}); return }
      setErro('')
      setCalc(Object.fromEntries(qtds.map((n, k) => [n, res[k].data as Calculo])))
    }, 300)
    return () => clearTimeout(t)
  }, [cap, taxa, inicio, primeiro, qtds])

  const sugestoes = useMemo(() => {
    const busca = semAcento(nome.trim())
    if (cliente || busca.length < 2) return []
    return clientes.filter((c) => semAcento(c.nome_completo).includes(busca)).slice(0, 5)
  }, [nome, cliente, clientes])

  function digitarNome(t: string) {
    setNome(t)
    setCliente(null)
    setLinkCadastro('')
  }

  function escolherCliente(c: Cliente) {
    setCliente(c)
    setNome(c.nome_completo)
    setLinkCadastro('')
  }

  // Cliente pediu outra quantidade ("bota em 15"): entra na lista já escolhida
  function adicionarQtd() {
    const n = Number(novaQtd)
    if (!n || n < 1 || n > 120) return
    if (!qtds.includes(n)) setQtds([...qtds, n].sort((a, b) => a - b))
    setEscolhida(n)
    setNovaQtd('')
  }

  function tirarQtd(n: number) {
    setQtds(qtds.filter((q) => q !== n))
    if (escolhida === n) setEscolhida(null)
  }

  async function fecharEmprestimo() {
    if (!cliente || !escolhida) return
    setErro('')
    setSalvando(true)
    const { data, error } = await supabase.rpc('contrato_criar', {
      p_cliente_id: cliente.id, p_modalidade: 'mensal', p_sistema: 'empresa', p_capital: cap,
      p_juro_mensal_percentual: taxa, p_quantidade: escolhida, p_data_contrato: inicio, p_primeiro_vencimento: primeiro,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    navegar(`/contratos/${data}`)
  }

  async function gerarLinkCadastro() {
    setErro('')
    const { data, error } = await supabase.rpc('link_cadastro_criar')
    if (error) return setErro('Não foi possível gerar o link de cadastro.')
    setLinkCadastro(`${window.location.origin}/c/${data}`)
  }

  const opcoes = qtds.filter((n) => calc[n]).map((n) => calc[n].parcelas)
  const atual = escolhida ? calc[escolhida] : undefined
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? ''

  return (
    <Tela titulo="Calculadora" subtitulo="Simule, mande pro cliente e feche o empréstimo">
      <section className="cartao mt-4 flex flex-col gap-4 rounded-[26px] p-5 lg:p-6">
        <div className="relative">
          <label className={rotulo} htmlFor="nome">Cliente</label>
          <input id="nome" value={nome} onChange={(e) => digitarNome(e.target.value)} placeholder="Nome do cliente" autoComplete="off" className={campo} />
          {cliente && (
            <p className="mt-1.5 text-xs font-semibold text-marca">
              Cliente cadastrado{cliente.status_cadastro !== 'aprovado' && ' (cadastro ainda não aprovado)'}
            </p>
          )}
          {!cliente && nome.trim().length >= 2 && !sugestoes.length && <p className="mt-1.5 text-xs text-suave">Cliente novo (ainda sem cadastro)</p>}
          {sugestoes.length > 0 && (
            <ul className="cartao absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-2xl">
              {sugestoes.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => escolherCliente(c)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-superficie-2">
                    <span className="truncate font-semibold">{c.nome_completo}</span>
                    <Icone nome="seta" tamanho={16} className="shrink-0 text-suave" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="cap">Valor</label>
            <CampoComSinal id="cap" sinal="R$" lado="antes" inputMode="numeric" value={capital} onChange={(e) => setCapital(mascaraReais(e.target.value))} placeholder="1.000,00" />
          </div>
          <div>
            <label className={rotulo} htmlFor="juro">Juro ao mês</label>
            <CampoComSinal id="juro" sinal="%" lado="depois" inputMode="decimal" value={juroPct} onChange={(e) => setJuroPct(mascaraPercentual(e.target.value))} placeholder="10" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="ini">Dia do empréstimo</label>
            <input id="ini" type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPrimeiro(proximoMes(e.target.value)) }} className={campo} />
          </div>
          <div>
            <label className={rotulo} htmlFor="pv">1ª parcela</label>
            <input id="pv" type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} className={campo} />
          </div>
        </div>

        <div>
          <span className={rotulo}>Quantidades pra oferecer</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {qtds.map((n) => (
              <span key={n} className="flex h-9 items-center gap-1 rounded-xl bg-superficie-2 pr-1 pl-3 text-sm font-bold tabular-nums">
                {n}x
                <button type="button" onClick={() => tirarQtd(n)} aria-label={`Tirar ${n}x`} className="flex size-7 items-center justify-center rounded-lg text-suave hover:bg-borda hover:text-texto">
                  <Icone nome="xis" tamanho={14} />
                </button>
              </span>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); adicionarQtd() }} className="flex h-9 items-center gap-1 rounded-xl border border-dashed border-borda pr-1 pl-2">
              <input
                id="nova-qtd"
                aria-label="Outra quantidade"
                inputMode="numeric"
                value={novaQtd}
                onChange={(e) => setNovaQtd(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="outra"
                className="w-14 bg-transparent text-sm font-bold tabular-nums outline-none"
              />
              <button type="submit" aria-label="Adicionar quantidade" className="flex size-7 items-center justify-center rounded-lg text-marca hover:bg-superficie-2">
                <Icone nome="mais" tamanho={16} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {erro && <p role="alert" className={`${erroCaixa} mt-4`}>{erro}</p>}

      {opcoes.length > 0 && (
        <>
          <section className="mt-4">
            <p className={tituloSecao}>Toque na opção que o cliente escolheu</p>
            <div className="mt-2 flex flex-col gap-2">
              {qtds.filter((n) => calc[n]).map((n) => {
                const c = calc[n]
                const marcado = escolhida === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEscolhida(marcado ? null : n)}
                    aria-pressed={marcado}
                    className={`cartao flex items-center gap-3 rounded-[20px] p-4 text-left ring-2 transition ${marcado ? 'ring-marca-clara' : 'ring-transparent'}`}
                  >
                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${marcado ? 'verde' : 'border-2 border-borda'}`}>
                      {marcado && <Icone nome="certo" tamanho={14} />}
                    </span>
                    <span className="min-w-0 flex-1 font-bold tabular-nums">{forma(c.parcelas)}</span>
                    <span className="shrink-0 text-right text-xs text-suave tabular-nums">
                      Total {reais(c.total)}
                      <br />
                      Juro {reais(c.juro_total)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <CaixaTexto titulo="1. Simulação (todas as opções)" texto={textoSimulacao(cap, opcoes)} telefone={cliente?.telefone} />
        </>
      )}

      {atual && escolhida && (
        <>
          <CaixaTexto titulo={`2. Tarjeta (só ${escolhida}x)`} texto={textoTarjeta(nome, cap, atual.parcelas)} telefone={cliente?.telefone} />
          <CaixaTexto titulo="3. Extrato completo (depois de aprovado)" texto={textoExtrato(nome, cap, inicio, atual.parcelas)} telefone={cliente?.telefone} />

          <section className="mt-4 mb-6">
            {cliente?.status_cadastro === 'aprovado' && (
              <button onClick={fecharEmprestimo} disabled={salvando} className={`${botaoVerde} h-14 w-full text-lg`}>
                <Icone nome="moeda" />
                {salvando ? 'Salvando…' : `Fechar empréstimo de ${reais(cap)} em ${escolhida}x`}
              </button>
            )}
            {cliente && cliente.status_cadastro !== 'aprovado' && (
              <p className="cartao rounded-[20px] p-4 text-sm text-suave">
                O cadastro de {primeiroNome} ainda não foi aprovado.{' '}
                <Link to={`/clientes/${cliente.id}`} className="font-bold text-marca">Abrir a ficha</Link> pra aprovar e depois volte aqui pra fechar.
              </p>
            )}
            {!cliente && !linkCadastro && (
              <button onClick={gerarLinkCadastro} className={`${botaoClaro} h-14 w-full`}>
                <Icone nome="link" />
                Mandar link de cadastro{primeiroNome && ` pra ${primeiroNome}`}
              </button>
            )}
            {!cliente && linkCadastro && (
              <CaixaTexto
                titulo="Link de cadastro"
                texto={`Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Pra liberar seu empréstimo de ${valorTexto(cap)}, faça seu cadastro por este link: ${linkCadastro}`}
              />
            )}
          </section>
        </>
      )}
    </Tela>
  )
}
