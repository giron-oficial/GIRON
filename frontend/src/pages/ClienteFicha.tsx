import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icone, { type NomeIcone } from '../components/Icone'
import Tela from '../components/Tela'
import BarraRecuperacao from '../components/BarraRecuperacao'
import EditarCliente from '../components/EditarCliente'
import { recuperacao } from '../lib/recuperacao'
import { botaoClaro, botaoVerde, botaoZap, campo, iniciais, seloCadastro, seloContrato, tituloSecao } from '../components/estilo'
import { cpfEscondido, cpfValido, dataBr, idCliente, idContrato, linkWhatsApp, mascaraCpf, mascaraTelefone, nomeModalidade, reais } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'
import { cobrancasDoCliente, mensagemCliente, type Cobranca } from '../lib/painel'

type Arquivo = { id: string; tipo: string; caminho_arquivo: string }
type Local = { id: string; nome: string; latitude: number; longitude: number; precisao_metros: number | null; foto_arquivo: string | null; registrado_em: string }
type Cliente = {
  id: string; numero: number; nome_completo: string; cpf_final: string | null; telefone: string; status_cadastro: string; criado_em: string
  endereco: string | null; cep: string | null; trabalho_empresa: string | null; trabalho_endereco: string | null
  trabalho_telefone: string | null; trabalho_referencia: string | null; indicado_por: string | null
  valor_pretendido: number | null; modalidade_preferida: string | null; dia_vencimento_preferido: number | null
  cliente_arquivos: Arquivo[]; cliente_localizacoes: Local[]
  contratos: { id: string; numero: number; modalidade: string; capital: number; capital_em_aberto: number; status: string; data_contrato: string; pagamentos: { valor_pago: number; estornado_em: string | null; parte_juro: number; parte_capital: number; multa: number; juro_atraso: number }[] }[]
}

const nomeTipo: Record<string, string> = { selfie: 'Selfie', documento: 'CNH / RG', comprovante: 'Comprovante', foto_casa: 'Casa' }
const mapa = (l: Local) => `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="shrink-0 text-sm text-suave">{rotulo}</span>
      <span className="text-right text-sm font-semibold">{valor}</span>
    </div>
  )
}

function Bloco({ titulo, icone, acao, children }: { titulo: string; icone: NomeIcone; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="cartao rounded-[22px] p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className={`${tituloSecao} flex items-center gap-2`}>
          <Icone nome={icone} tamanho={16} />
          {titulo}
        </h2>
        {acao}
      </div>
      <div className="mt-1">{children}</div>
    </section>
  )
}

export default function ClienteFicha() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cpfCompleto, setCpfCompleto] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [erroCpf, setErroCpf] = useState('')
  const [recarregar, setRecarregar] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [erroStatus, setErroStatus] = useState('')
  const [linkLocal, setLinkLocal] = useState('')
  const [copiadoLocal, setCopiadoLocal] = useState(false)
  const [erroLocal, setErroLocal] = useState('')
  const [editando, setEditando] = useState(false)
  // Parcelas que vencem hoje ou já venceram: o botão WhatsApp já abre com a cobrança escrita
  const [cobrar, setCobrar] = useState<{ cobrancas: Cobranca[]; chavePix: string | null } | null>(null)

  useEffect(() => {
    cobrancasDoCliente(id!).then(setCobrar).catch(() => setCobrar(null))
  }, [id, recarregar])

  useEffect(() => {
    supabase
      .from('clientes')
      .select(`id, numero, nome_completo, cpf_final, telefone, status_cadastro, criado_em, endereco, cep, trabalho_empresa,
               trabalho_endereco, trabalho_telefone, trabalho_referencia, indicado_por, valor_pretendido,
               modalidade_preferida, dia_vencimento_preferido,
               cliente_arquivos(id, tipo, caminho_arquivo),
               cliente_localizacoes(id, nome, latitude, longitude, precisao_metros, foto_arquivo, registrado_em),
               contratos(id, numero, modalidade, capital, capital_em_aberto, status, data_contrato, pagamentos(valor_pago, estornado_em, parte_juro, parte_capital, multa, juro_atraso))`)
      .eq('id', id!)
      .maybeSingle()
      .then(async ({ data }) => {
        const c = data as Cliente | null
        setCliente(c)
        setCarregando(false)
        const caminhos = [...(c?.cliente_arquivos.map((a) => a.caminho_arquivo) ?? []),
          ...(c?.cliente_localizacoes.map((l) => l.foto_arquivo).filter((x): x is string => !!x) ?? [])]
        if (caminhos.length) {
          // link temporario (10 min) pra ver cada foto - o cofre e privado
          const { data: assinadas } = await supabase.storage.from('clientes').createSignedUrls([...new Set(caminhos)], 600)
          setUrls(Object.fromEntries((assinadas ?? []).filter((a) => a.signedUrl).map((a) => [a.path!, a.signedUrl as string])))
        }
      })
  }, [id, recarregar])

  async function mostrarCpf() {
    if (cpfCompleto) return setCpfCompleto('')
    const { data } = await supabase.rpc('cliente_cpf', { p_cliente_id: id })
    if (data) setCpfCompleto(mascaraCpf(data))
  }

  async function salvarCpf() {
    setErroCpf('')
    if (!cpfValido(novoCpf)) return setErroCpf('CPF inválido. Confira os números.')
    const { error } = await supabase.rpc('cliente_definir_cpf', { p_cliente_id: id, p_cpf: novoCpf })
    if (error) return setErroCpf(error.message.startsWith('Já existe') ? error.message : 'Não foi possível salvar.')
    setNovoCpf('')
    setRecarregar((n) => n + 1)
  }

  async function mudarStatus(novo: 'aprovado' | 'reprovado') {
    if (novo === 'reprovado' && !window.confirm('Reprovar este cadastro? Ele fica guardado como reprovado e pode ser aprovado depois.')) return
    setErroStatus('')
    setSalvandoStatus(true)
    const { error } = await supabase.from('clientes').update({ status_cadastro: novo }).eq('id', id!)
    setSalvandoStatus(false)
    if (error) return setErroStatus('Não foi possível salvar. Confira se a mensalidade está em dia.')
    rastrear('cadastro_avaliado', { resultado: novo })
    // aprovou: ja vai direto pro emprestimo, preenchido com o que o cliente pediu (RN-35)
    if (novo === 'aprovado') return navegar(`/clientes/${id}/emprestimo`)
    setRecarregar((n) => n + 1)
  }

  if (carregando) return <Tela voltar="/clientes"><div className="mt-4 h-40 animate-pulse rounded-[26px] bg-superficie-2" /></Tela>
  if (!cliente) return <Tela voltar="/clientes"><p className="mt-6 text-suave">Cliente não encontrado.</p></Tela>

  const selfie = cliente.cliente_arquivos.find((a) => a.tipo === 'selfie')
  const fotos = cliente.cliente_arquivos.filter((a) => a.tipo !== 'selfie')
  const selo = seloCadastro[cliente.status_cadastro] ?? seloCadastro.pendente
  const contratos = [...cliente.contratos].sort((a, b) => b.numero - a.numero)
  // Histórico (regra 5.4): soma de todos os contratos que valem (sem cancelados e sem o Recorrente que virou parcelado)
  const valem = cliente.contratos.filter((k) => k.status !== 'cancelado' && k.status !== 'convertido')
  const pagosValidos = valem.flatMap((k) => k.pagamentos ?? []).filter((p) => !p.estornado_em)
  const hist = {
    contratos: valem.length,
    quitados: valem.filter((k) => k.status === 'quitado').length,
    emprestado: valem.reduce((t, k) => t + Number(k.capital), 0),
    pago: pagosValidos.reduce((t, p) => t + Number(p.valor_pago), 0),
    juros: pagosValidos.reduce((t, p) => t + Number(p.parte_juro) + Number(p.multa) + Number(p.juro_atraso), 0),
    capital: pagosValidos.reduce((t, p) => t + Number(p.parte_capital), 0),
    encargos: pagosValidos.reduce((t, p) => t + Number(p.multa) + Number(p.juro_atraso), 0),
    comAtraso: pagosValidos.filter((p) => Number(p.multa) + Number(p.juro_atraso) > 0).length,
  }
  const saldo = hist.pago - hist.emprestado

  async function pedirLocalizacao() {
    setErroLocal(''); setCopiadoLocal(false)
    const { data, error } = await supabase.rpc('link_localizacao_criar', { p_cliente_id: cliente!.id })
    if (error) return setErroLocal('Não foi possível gerar o link.')
    rastrear('localizacao_solicitada')
    setLinkLocal(`${window.location.origin}/c/${data}`)
  }
  async function copiarLocal() {
    try { await navigator.clipboard.writeText(linkLocal); setCopiadoLocal(true) } catch { setErroLocal('Não deu pra copiar sozinho. Segure o dedo no link e copie.') }
  }
  const ativos = contratos.filter((k) => k.status === 'ativo')
  const emAberto = ativos.reduce((t, k) => t + Number(k.capital_em_aberto), 0)

  return (
    <Tela voltar="/clientes" largo>
      {/* Cabeçalho do cliente */}
      <section className="cartao mt-2 flex flex-col gap-4 rounded-[26px] p-4 lg:flex-row lg:items-center lg:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {selfie && urls[selfie.caminho_arquivo] ? (
            <a href={urls[selfie.caminho_arquivo]} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={urls[selfie.caminho_arquivo]} alt="Selfie do cliente" className="size-18 rounded-[20px] object-cover" />
            </a>
          ) : (
            <span className={`flex size-18 shrink-0 items-center justify-center rounded-[20px] text-2xl font-extrabold ${selo.avatar}`}>{iniciais(cliente.nome_completo)}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl leading-tight font-bold lg:text-2xl">{cliente.nome_completo}</h1>
            <p className="mt-0.5 text-sm font-bold text-texto/80 tabular-nums">{idCliente(cliente.numero)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selo.classe}`}>{selo.texto}</span>
              <span className="text-xs text-suave">desde {new Date(cliente.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
        {ativos.length > 0 && (
          <div className="flex gap-6 border-t border-superficie-2 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div>
              <p className="text-xs text-suave">Em aberto</p>
              <p className="text-lg font-bold tabular-nums">{reais(emAberto).replace(',00', '')}</p>
            </div>
            <div>
              <p className="text-xs text-suave">Contratos ativos</p>
              <p className="text-lg font-bold">{ativos.length}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 lg:flex">
          {cliente.status_cadastro === 'aprovado' && (
            <Link to={`/clientes/${cliente.id}/emprestimo`} className={botaoVerde}>
              <Icone nome="moeda" tamanho={18} />
              Novo empréstimo
            </Link>
          )}
          {cobrar?.cobrancas.length ? (
            <a
              href={linkWhatsApp(cliente.telefone, mensagemCliente(cobrar.cobrancas, cobrar.chavePix))}
              target="_blank"
              rel="noreferrer"
              onClick={() => rastrear('cobranca_enviada', { canal: 'whatsapp_ficha', situacao: cobrar.cobrancas.some((c) => c.situacao !== 'hoje') ? 'atrasado' : 'vence_hoje' })}
              className={`${botaoZap} ${cliente.status_cadastro === 'aprovado' ? '' : 'col-span-2'}`}
            >
              <Icone nome="whatsapp" tamanho={18} />
              {cobrar.cobrancas.some((c) => c.situacao !== 'hoje') ? 'Cobrar atraso' : 'Cobrar hoje'}
            </a>
          ) : (
            <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer" className={`${botaoClaro} ${cliente.status_cadastro === 'aprovado' ? '' : 'col-span-2'}`}>
              <Icone nome="whatsapp" tamanho={18} />
              WhatsApp
            </a>
          )}
        </div>
      </section>

      {/* Resumo do cliente até hoje (pedido do dono, 28/10/2026): quanto saiu pra ele e quanto já voltou */}
      {hist.contratos > 0 && (
        <section aria-label="Resumo do cliente" className="vidro mt-3 grid grid-cols-2 rounded-[22px] p-4 lg:p-5">
          <div className="@container flex min-w-0 flex-col gap-0.5 pr-3">
            <span className="text-[11px] tracking-[0.12em] text-suave uppercase">Emprestado</span>
            <span className="truncate font-display text-[clamp(15px,11cqi,28px)] leading-tight font-extrabold tabular-nums">{reais(hist.emprestado)}</span>
            <span className="text-xs text-suave">{hist.contratos} {hist.contratos === 1 ? 'contrato' : 'contratos'} até hoje</span>
          </div>
          <div className="@container flex min-w-0 flex-col gap-0.5 border-l border-superficie-2 pl-3 lg:pl-5">
            <span className="text-[11px] tracking-[0.12em] text-suave uppercase">Recebido</span>
            <span className="truncate font-display text-[clamp(15px,11cqi,28px)] leading-tight font-extrabold tabular-nums">{reais(hist.pago)}</span>
            {saldo >= 0 ? (
              <span className="text-xs font-semibold text-sucesso tabular-nums">▲ {reais(saldo)} a mais (lucro)</span>
            ) : (
              <span className="text-xs text-suave tabular-nums">faltam {reais(-saldo)} pra empatar</span>
            )}
          </div>
        </section>
      )}

      {cliente.status_cadastro !== 'aprovado' && (
        <section className="mt-3 flex flex-col gap-3 rounded-[22px] bg-linear-135 from-[#F5C02E] to-[#D99A00] p-4 text-white shadow-lg shadow-amanha/30 lg:flex-row lg:items-center lg:p-5">
          <div className="flex-1">
            <p className="font-bold">{cliente.status_cadastro === 'pendente' ? 'Cadastro esperando sua análise' : 'Cadastro reprovado'}</p>
            <p className="text-sm text-white/85">Confira os dados e as fotos abaixo antes de decidir.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <button onClick={() => mudarStatus('aprovado')} disabled={salvandoStatus} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-sobre-verde px-5 font-bold text-marca disabled:opacity-60">
              <Icone nome="certo" tamanho={18} />
              Aprovar
            </button>
            {cliente.status_cadastro === 'pendente' && (
              <button onClick={() => mudarStatus('reprovado')} disabled={salvandoStatus} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/20 px-5 font-bold disabled:opacity-60">
                <Icone nome="xis" tamanho={18} />
                Reprovar
              </button>
            )}
          </div>
          {erroStatus && <p role="alert" className="text-sm font-semibold">{erroStatus}</p>}
        </section>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          <Bloco
            titulo="Dados"
            icone="usuario"
            acao={
              <button onClick={() => setEditando(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-superficie-2 px-3 text-sm font-semibold text-marca hover:text-texto">
                <Icone nome="lapis" tamanho={15} />
                Editar
              </button>
            }
          >
            <div className="divide-y divide-superficie-2">
              <Linha rotulo="Telefone" valor={mascaraTelefone(cliente.telefone)} />
              {cliente.cpf_final ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm text-suave">CPF</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{cpfCompleto || cpfEscondido(cliente.cpf_final)}</span>
                    <button onClick={mostrarCpf} className="rounded-lg bg-superficie-2 px-2.5 py-1 text-xs font-semibold text-suave hover:text-texto">
                      {cpfCompleto ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </span>
                </div>
              ) : (
                <div className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-suave">CPF</span>
                    <span className="rounded-full bg-amanha/15 px-2.5 py-1 text-[11px] font-bold text-amanha">Sem CPF</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input inputMode="numeric" value={novoCpf} onChange={(e) => setNovoCpf(mascaraCpf(e.target.value))} placeholder="Completar CPF" aria-label="Completar CPF" className={`${campo} mt-0`} />
                    <button onClick={salvarCpf} className="shrink-0 rounded-2xl border border-borda bg-superficie-2 px-4 font-semibold">Salvar</button>
                  </div>
                  {erroCpf && <p role="alert" className="mt-2 text-sm font-semibold text-vencido">{erroCpf}</p>}
                </div>
              )}
              <Linha rotulo="Endereço" valor={cliente.endereco} />
              <Linha rotulo="CEP" valor={cliente.cep} />
              <Linha rotulo="Indicado por" valor={cliente.indicado_por} />
            </div>
          </Bloco>

          {(cliente.valor_pretendido || cliente.modalidade_preferida || cliente.dia_vencimento_preferido) && (
            <Bloco titulo="O que o cliente pediu" icone="moeda">
              <div className="divide-y divide-superficie-2">
                <Linha rotulo="Valor" valor={cliente.valor_pretendido ? reais(cliente.valor_pretendido) : null} />
                <Linha rotulo="Modalidade" valor={cliente.modalidade_preferida ? nomeModalidade[cliente.modalidade_preferida] : null} />
                <Linha rotulo="Dia de vencimento" valor={cliente.dia_vencimento_preferido ? `todo dia ${cliente.dia_vencimento_preferido}` : null} />
              </div>
            </Bloco>
          )}

          {editando && (
            <EditarCliente
              cliente={cliente}
              fechar={() => setEditando(false)}
              salvo={() => {
                setEditando(false)
                setRecarregar((n) => n + 1)
              }}
            />
          )}

          {(cliente.trabalho_empresa || cliente.trabalho_endereco || cliente.trabalho_telefone) && (
            <Bloco titulo="Trabalho" icone="maleta">
              <div className="divide-y divide-superficie-2">
                <Linha rotulo="Empresa" valor={cliente.trabalho_empresa} />
                <Linha rotulo="Endereço" valor={cliente.trabalho_endereco} />
                <Linha rotulo="Telefone" valor={cliente.trabalho_telefone ? mascaraTelefone(cliente.trabalho_telefone) : null} />
                <Linha rotulo="Referência" valor={cliente.trabalho_referencia} />
              </div>
            </Bloco>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {hist.contratos > 0 && (
            <Bloco titulo="Histórico" icone="relatorios">
              <div className="grid grid-cols-2 gap-x-4 pt-2 sm:grid-cols-4">
                <div className="py-2"><p className="text-xs text-suave">Emprestado no total</p><p className="text-base font-bold tabular-nums">{reais(hist.emprestado)}</p></div>
                <div className="py-2"><p className="text-xs text-suave">Pago no total</p><p className="text-base font-bold tabular-nums">{reais(hist.pago)}</p></div>
                <div className="py-2"><p className="text-xs text-suave">Foi juro</p><p className="text-base font-bold text-marca tabular-nums">{reais(hist.juros)}</p>{hist.encargos > 0 && <p className="text-[11px] text-suave">inclui {reais(hist.encargos)} de atraso</p>}</div>
                <div className="py-2"><p className="text-xs text-suave">Foi capital</p><p className="text-base font-bold text-hoje tabular-nums">{reais(hist.capital)}</p></div>
              </div>
              <div className={`mt-1 flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ${saldo < 0 ? 'bg-vencido/15' : saldo === 0 ? 'bg-hoje/15' : 'bg-marca/15'}`}>
                <span className="text-sm font-semibold">{saldo < 0 ? 'Ainda em risco' : saldo === 0 ? 'Empatou' : 'Já deu lucro'}</span>
                <span className={`text-sm font-extrabold tabular-nums ${saldo < 0 ? 'text-vencido' : saldo === 0 ? 'text-hoje' : 'text-marca'}`}>
                  {saldo < 0 ? `falta ${reais(-saldo)} pra empatar` : saldo === 0 ? reais(0) : `${reais(saldo)} acima do emprestado`}
                </span>
              </div>
              <p className="mt-2 text-xs text-suave">
                {hist.contratos} {hist.contratos === 1 ? 'contrato' : 'contratos'} · {hist.quitados} {hist.quitados === 1 ? 'quitado' : 'quitados'} · {pagosValidos.length} {pagosValidos.length === 1 ? 'pagamento' : 'pagamentos'}
                {hist.comAtraso > 0 ? ` · ${hist.comAtraso} com multa ou juro de atraso` : pagosValidos.length > 0 ? ' · nenhum com atraso cobrado' : ''}
              </p>
            </Bloco>
          )}

          <Bloco titulo="Empréstimos" icone="contratos">
            {contratos.length === 0 && <p className="py-3 text-sm text-suave">Nenhum empréstimo ainda.</p>}
            <ul className="flex flex-col gap-2 pt-2">
              {contratos.map((k) => {
                const sc = seloContrato[k.status] ?? seloContrato.ativo
                return (
                  <li key={k.id}>
                    <Link to={`/contratos/${k.id}`} className="flex items-center gap-3 rounded-2xl bg-superficie-2/70 p-3 transition hover:bg-superficie-2">
                      <span className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-superficie px-2.5 text-xs font-extrabold tabular-nums">{idContrato(k.numero)}</span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-bold">
                          {reais(k.capital)} <span className="font-normal text-suave">· {nomeModalidade[k.modalidade] ?? k.modalidade}</span>
                        </span>
                        <span className="text-xs text-suave">
                          {dataBr(k.data_contrato)}
                          {k.status === 'ativo' ? ` · falta ${reais(k.capital_em_aberto)}` : ''}
                        </span>
                        <BarraRecuperacao r={recuperacao(k.capital, k.pagamentos ?? [])} compacta />
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${sc.classe}`}>{sc.texto}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Bloco>

          <Bloco titulo="Localizações" icone="pin">
            <div className="flex flex-col gap-2 pt-2">
              <button type="button" onClick={pedirLocalizacao} className={`${botaoClaro} w-full`}>
                <Icone nome="link" tamanho={18} />
                Pedir nova localização
              </button>
              {erroLocal && <p className="text-sm font-semibold text-vencido">{erroLocal}</p>}
              {linkLocal && (
                <div className="flex flex-col gap-2 rounded-2xl bg-superficie-2/70 p-3">
                  <p className="text-xs text-suave">Link pronto. Vale 7 dias e só pode ser usado uma vez. O cliente só vê o nome da empresa e o primeiro nome dele.</p>
                  <p className="rounded-xl bg-superficie px-3 py-2 text-xs font-medium break-all">{linkLocal}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={linkWhatsApp(cliente.telefone, `Olá, ${cliente.nome_completo.split(' ')[0]}! Quando estiver no local, abra este link e envie sua nova localização: ${linkLocal}`)} target="_blank" rel="noreferrer" className="zap inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold">
                      <Icone nome="whatsapp" tamanho={16} />
                      Mandar
                    </a>
                    <button type="button" onClick={copiarLocal} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-borda bg-superficie-2 text-sm font-semibold">
                      <Icone nome={copiadoLocal ? 'certo' : 'copiar'} tamanho={16} />
                      {copiadoLocal ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {cliente.cliente_localizacoes.length === 0 && <p className="py-3 text-sm text-suave">Sem localização registrada.</p>}
            <div className="flex flex-col gap-2 pt-2">
              {cliente.cliente_localizacoes.map((l) => (
                <div key={l.id} className="rounded-2xl bg-superficie-2/70 p-3">
                  <div className="flex items-center gap-3">
                    {l.foto_arquivo && urls[l.foto_arquivo] ? (
                      <img src={urls[l.foto_arquivo]} alt={l.nome} className="size-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-superficie text-hoje">
                        <Icone nome="pin" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{l.nome}</p>
                      <p className="text-xs text-suave">
                        {l.precisao_metros !== null ? `precisão ${Math.round(l.precisao_metros)} m · ` : ''}
                        {new Date(l.registrado_em).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <a href={mapa(l)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-borda bg-superficie-2 text-sm font-semibold">
                      <Icone nome="pin" tamanho={16} />
                      Abrir no mapa
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${cliente.nome_completo} - ${l.nome}: ${mapa(l)}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="zap inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold"
                    >
                      <Icone nome="whatsapp" tamanho={16} />
                      Mandar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Bloco>

          {fotos.length > 0 && (
            <Bloco titulo="Fotos e documentos" icone="imagem">
              <div className="grid grid-cols-2 gap-2 pt-2 lg:grid-cols-3">
                {fotos.map((a) => (
                  <a key={a.id} href={urls[a.caminho_arquivo]} target="_blank" rel="noreferrer" className="block rounded-2xl bg-superficie-2/70 p-2 text-center">
                    {a.caminho_arquivo.endsWith('.pdf') ? (
                      <div className="flex h-24 items-center justify-center text-suave">
                        <Icone nome="contratos" tamanho={32} />
                      </div>
                    ) : urls[a.caminho_arquivo] ? (
                      <img src={urls[a.caminho_arquivo]} alt={nomeTipo[a.tipo] ?? a.tipo} className="h-24 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="h-24" />
                    )}
                    <span className="mt-1 block text-xs font-semibold">{nomeTipo[a.tipo] ?? a.tipo}</span>
                  </a>
                ))}
              </div>
            </Bloco>
          )}
        </div>
      </div>
    </Tela>
  )
}
