import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import { botaoClaro, botaoVerde, tituloSecao } from '../components/estilo'
import { encargosAtraso, regraDaConfig, type RegraAtraso } from '../lib/atraso'
import { dataBr, idCliente, idContrato, linkWhatsApp, nomeModalidade, percentualCompleto, reais } from '../lib/formatos'
import { compartilharImagem, reciboImagem, reciboTexto, type LinhaRecibo } from '../lib/recibo'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'

// Extrato do contrato (regra 5.7), com cara de recibo de impressora térmica, em imagem pro WhatsApp.
//  * Pro cliente: empresa, Pix, contrato e parcelas. Mostrar % de juro e total só se o dono ligou em Configurações.
//  * Da empresa (interno, nunca vai pro cliente): tudo, com juros ganhos e cada pagamento.

type Parcela = { numero: number; vencimento: string; valor: number; parte_juro: number; parte_capital: number; status: string }
type Pagamento = { pago_em: string; valor_pago: number; parte_juro: number; parte_capital: number; multa: number; juro_atraso: number; estornado_em: string | null; tipo: string }
type Dados = {
  contrato: {
    id: string; numero: number; modalidade: string; sistema_calculo: string | null; capital: number; juro_percentual: number; juro_valor: number
    data_contrato: string; status: string; capital_em_aberto: number
    clientes: { numero: number; nome_completo: string; telefone: string } | null
    parcelas: Parcela[]; pagamentos: Pagamento[]
  }
  empresa: { nome_empresa: string } | null
  pix: { numero: number; tipo: string; chave: string; padrao: boolean }[]
  config: { mostrar_juro_no_extrato: boolean; mostrar_total_no_extrato: boolean } & Parameters<typeof regraDaConfig>[0]
}
type Modo = 'cliente' | 'empresa'

const hoje = () => new Date().toLocaleDateString('sv-SE')
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)
const curto = (iso: string) => dataBr(iso).slice(0, 5)
const semRS = (v: number) => reais(v).replace('R$', '').trim()

function montar(d: Dados, modo: Modo, pixEscolhido: number | null, regra: RegraAtraso): LinhaRecibo[] {
  const c = d.contrato
  const cli = c.clientes
  const recorrente = c.modalidade === 'recorrente'
  const validos = c.pagamentos.filter((p) => !p.estornado_em)
  const pago = validos.reduce((t, p) => t + Number(p.valor_pago), 0)
  const juros = validos.reduce((t, p) => t + Number(p.parte_juro) + Number(p.multa) + Number(p.juro_atraso), 0)
  const capital = validos.reduce((t, p) => t + Number(p.parte_capital), 0)
  const abertas = c.parcelas.filter((p) => p.status !== 'paga')
  const pix = d.pix.find((p) => p.numero === pixEscolhido) ?? d.pix.find((p) => p.padrao) ?? d.pix[0]
  const total = c.parcelas.reduce((t, p) => t + Number(p.valor), 0)
  const L: LinhaRecibo[] = []

  L.push({ t: 'texto', v: (d.empresa?.nome_empresa ?? 'GIRON').toLocaleUpperCase('pt-BR'), negrito: true, centro: true })
  L.push({ t: 'texto', v: modo === 'empresa' ? 'EXTRATO INTERNO (NÃO ENVIAR)' : 'EXTRATO DO EMPRÉSTIMO', centro: true, pequeno: true })
  L.push({ t: 'texto', v: `emitido em ${dataBr(hoje())}`, centro: true, pequeno: true })
  L.push({ t: 'linha' })
  if (cli) {
    L.push({ t: 'texto', v: cli.nome_completo.toLocaleUpperCase('pt-BR'), negrito: true })
    L.push({ t: 'texto', v: `${idCliente(cli.numero)} · ${idContrato(c.numero)}`, pequeno: true })
  }
  L.push({ t: 'vazio' })
  L.push({ t: 'par', a: 'Emprestado', b: reais(c.capital), negrito: true })
  L.push({ t: 'par', a: 'Data', b: dataBr(c.data_contrato) })
  L.push({ t: 'par', a: 'Forma', b: recorrente ? 'Recorrente (juro mensal)' : `${c.parcelas.length}x ${nomeModalidade[c.modalidade] ?? c.modalidade}` })
  if (modo === 'empresa' || d.config.mostrar_juro_no_extrato) L.push({ t: 'par', a: 'Juro ao mês', b: `${percentualCompleto(Number(c.juro_percentual)).slice(0, 8)}%` })
  if (!recorrente && (modo === 'empresa' || d.config.mostrar_total_no_extrato)) L.push({ t: 'par', a: 'Total a pagar', b: reais(total) })
  if (recorrente) L.push({ t: 'par', a: 'Capital em aberto', b: reais(c.capital_em_aberto), negrito: true })
  L.push({ t: 'linha' })

  L.push({ t: 'texto', v: recorrente ? 'JUROS' : 'PARCELAS', negrito: true })
  for (const p of c.parcelas) {
    const atraso = p.status === 'paga' ? 0 : diasEntre(p.vencimento, hoje())
    const enc = p.status !== 'paga' && atraso > 0 ? encargosAtraso(atraso, regra).total : 0
    const marca = p.status === 'paga' ? 'PAGA' : p.status === 'parcial' ? 'PARCIAL' : atraso > 0 ? `ATRASO ${atraso}d` : ''
    const valor = p.status === 'paga' ? semRS(Number(p.valor)) : reais(Number(p.valor) + enc)
    L.push({ t: 'par', a: `${String(p.numero).padStart(2, '0')}  ${curto(p.vencimento)}  ${marca}`.trimEnd(), b: valor, negrito: p.status !== 'paga' && atraso >= 0 && abertas[0]?.numero === p.numero })
  }
  if (c.parcelas.some((p) => p.status !== 'paga' && diasEntre(p.vencimento, hoje()) > 0) && (regra.multa > 0 || regra.juroDia > 0)) {
    L.push({ t: 'texto', v: 'valores em atraso já incluem multa e juros do dia', pequeno: true })
  }
  L.push({ t: 'linha' })

  if (modo === 'empresa') {
    L.push({ t: 'texto', v: 'PAGAMENTOS RECEBIDOS', negrito: true })
    if (validos.length === 0) L.push({ t: 'texto', v: 'nenhum ainda', pequeno: true })
    for (const p of [...validos].sort((a, b) => a.pago_em.localeCompare(b.pago_em))) {
      const enc = Number(p.multa) + Number(p.juro_atraso)
      L.push({ t: 'par', a: `${curto(p.pago_em)}  ${p.tipo === 'amortizacao' ? 'amortiz.' : `j ${semRS(Number(p.parte_juro))} c ${semRS(Number(p.parte_capital))}`}${enc > 0 ? ` +${semRS(enc)}` : ''}`, b: reais(p.valor_pago) })
    }
    L.push({ t: 'linha' })
    L.push({ t: 'par', a: 'Total recebido', b: reais(pago), negrito: true })
    L.push({ t: 'par', a: '  juros ganhos', b: reais(juros) })
    L.push({ t: 'par', a: '  capital de volta', b: reais(capital) })
    L.push({ t: 'par', a: 'Falta de capital', b: reais(c.capital_em_aberto) })
    const dif = pago - Number(c.capital)
    L.push({ t: 'par', a: dif < 0 ? 'Falta pra empatar' : dif === 0 ? 'Empatou' : 'Lucro sobre o emprestado', b: reais(Math.abs(dif)), negrito: true })
    L.push({ t: 'linha' })
  } else {
    const falta = abertas.reduce((t, p) => t + Number(p.valor), 0)
    if (!recorrente) L.push({ t: 'par', a: `Pagas ${c.parcelas.length - abertas.length} de ${c.parcelas.length}`, b: `falta ${reais(falta)}`, negrito: true })
    if (pix) {
      L.push({ t: 'vazio' })
      L.push({ t: 'texto', v: `PIX (${pix.tipo === 'aleatoria' ? 'chave aleatória' : pix.tipo.toUpperCase()})`, negrito: true, centro: true })
      L.push({ t: 'texto', v: pix.chave, centro: true })
    }
    L.push({ t: 'linha' })
    L.push({ t: 'texto', v: 'Obrigado pela confiança!', centro: true, pequeno: true })
  }
  return L
}

export default function Extrato() {
  const { id } = useParams()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState<Modo>('cliente')
  const [pixEscolhido, setPixEscolhido] = useState<number | null>(null)
  const [imagem, setImagem] = useState<string>('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    Promise.all([
      supabase
        .from('contratos')
        .select(`id, numero, modalidade, sistema_calculo, capital, juro_percentual, juro_valor, data_contrato, status, capital_em_aberto,
                 clientes(numero, nome_completo, telefone), parcelas(numero, vencimento, valor, parte_juro, parte_capital, status),
                 pagamentos(pago_em, valor_pago, parte_juro, parte_capital, multa, juro_atraso, estornado_em, tipo)`)
        .eq('id', id!)
        .order('numero', { referencedTable: 'parcelas' })
        .maybeSingle(),
      supabase.from('fomentados').select('nome_empresa').maybeSingle(),
      supabase.from('chaves_pix').select('numero, tipo, chave, padrao').order('numero'),
      supabase.from('fomentado_configuracoes').select('mostrar_juro_no_extrato, mostrar_total_no_extrato, dias_para_critico, multa_atraso_valor, juro_diario_atraso_valor, juro_atraso_desde').maybeSingle(),
    ]).then(([c, e, p, cfg]) => {
      if (c.error || !c.data) return setErro('Não foi possível carregar o contrato.')
      setD({
        contrato: c.data as unknown as Dados['contrato'],
        empresa: e.data as Dados['empresa'],
        pix: (p.data ?? []) as Dados['pix'],
        config: { mostrar_juro_no_extrato: false, mostrar_total_no_extrato: false, ...(cfg.data ?? {}) } as Dados['config'],
      })
    })
  }, [id])

  const regra = useMemo(() => regraDaConfig(d?.config ?? null), [d])
  const linhas = useMemo(() => (d ? montar(d, modo, pixEscolhido, regra) : []), [d, modo, pixEscolhido, regra])
  const texto = useMemo(() => reciboTexto(linhas), [linhas])

  useEffect(() => {
    if (!linhas.length) return
    let vivo = true
    document.fonts?.ready.then(() => reciboImagem(linhas)).then((b) => {
      if (!vivo) return
      setBlob(b)
      setImagem((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b) })
    })
    return () => { vivo = false }
  }, [linhas])

  async function enviar() {
    if (!blob || !d) return
    setAviso('')
    try {
      const nome = `extrato-${idCliente(d.contrato.clientes?.numero ?? 0).slice(1)}-${idContrato(d.contrato.numero)}.png`
      const r = await compartilharImagem(blob, nome, 'Extrato')
      if (r === 'baixado') setAviso('Imagem baixada. Anexe no WhatsApp (neste aparelho não dá pra compartilhar direto).')
      rastrear('cobranca_enviada', { canal: 'extrato_imagem', modo })
    } catch {
      /* usuário cancelou o compartilhar */
    }
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('Texto copiado!')
      rastrear('cobranca_enviada', { canal: 'extrato_texto', modo })
    } catch {
      setAviso('Não deu pra copiar sozinho. Segure o dedo no texto e copie.')
    }
    setTimeout(() => setAviso(''), 3000)
  }

  if (erro) return <Tela titulo="Extrato" voltar={`/contratos/${id}`}><p className="mt-4 text-sm font-semibold text-vencido">{erro}</p></Tela>
  if (!d) return <Tela titulo="Extrato" voltar={`/contratos/${id}`}><div className="mt-4 h-96 animate-pulse rounded-[22px] bg-superficie-2" /></Tela>

  const cli = d.contrato.clientes
  const zapTexto = cli ? linkWhatsApp(cli.telefone, texto) : `https://wa.me/?text=${encodeURIComponent(texto)}`

  return (
    <Tela titulo="Extrato" subtitulo={cli ? `${cli.nome_completo} · ${idCliente(cli.numero)} · ${idContrato(d.contrato.numero)}` : undefined} voltar={`/contratos/${id}`} largo>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-superficie-2 p-1 lg:max-w-md">
        {([['cliente', 'Pro cliente'], ['empresa', 'Da empresa (interno)']] as [Modo, string][]).map(([m, t]) => (
          <button key={m} type="button" onClick={() => setModo(m)} aria-pressed={modo === m} className={`h-11 rounded-xl text-[13px] font-semibold transition ${modo === m ? 'bg-superficie text-marca' : 'text-suave'}`}>
            {t}
          </button>
        ))}
      </div>
      {modo === 'empresa' && <p className="mt-2 text-xs font-semibold text-amanha">Este é só pra você. Tem os juros ganhos. Não mande pro cliente.</p>}
      {modo === 'cliente' && d.pix.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-suave">Pix que vai no extrato:</span>
          {d.pix.map((p) => {
            const ativo = (pixEscolhido ?? d.pix.find((x) => x.padrao)?.numero) === p.numero
            return (
              <button key={p.numero} type="button" onClick={() => setPixEscolhido(p.numero)} aria-pressed={ativo} className={`h-8 rounded-full px-3 text-xs font-bold ${ativo ? 'verde' : 'bg-superficie-2 text-suave'}`}>
                Pix {p.numero}{p.padrao ? ' (padrão)' : ''}
              </button>
            )
          })}
        </div>
      )}
      {modo === 'cliente' && d.pix.length === 0 && <p className="mt-2 text-xs text-suave">Cadastre sua chave Pix em Configurações pra ela sair no extrato.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="mx-auto w-full max-w-[384px] overflow-hidden rounded-2xl bg-[#FFFDF7] shadow-2xl shadow-black/40">
          {imagem ? <img src={imagem} alt="Extrato" className="block w-full" /> : <div className="h-96 animate-pulse bg-superficie-2" />}
        </div>
        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <section className="cartao flex flex-col gap-2 rounded-[22px] p-4">
            <h2 className={tituloSecao}>Enviar</h2>
            <button type="button" onClick={enviar} disabled={!blob} className={`${botaoVerde} w-full`}>
              <Icone nome="whatsapp" tamanho={18} />
              Enviar imagem no WhatsApp
            </button>
            <p className="text-center text-[11px] text-suave">No celular abre o "compartilhar" e você escolhe o WhatsApp e a conversa.</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={zapTexto} target="_blank" rel="noreferrer" onClick={() => rastrear('cobranca_enviada', { canal: 'extrato_texto', modo })} className={botaoClaro}>
                <Icone nome="whatsapp" tamanho={18} />
                Só o texto
              </a>
              <button type="button" onClick={copiar} className={botaoClaro}>
                <Icone nome="copiar" tamanho={18} />
                Copiar texto
              </button>
            </div>
            {aviso && <p className="text-center text-xs font-semibold text-marca">{aviso}</p>}
          </section>
          <details className="cartao rounded-[22px] p-4">
            <summary className={`${tituloSecao} cursor-pointer`}>Ver como texto</summary>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-borda bg-fundo p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-texto select-all">{texto}</pre>
          </details>
        </div>
      </div>
    </Tela>
  )
}
