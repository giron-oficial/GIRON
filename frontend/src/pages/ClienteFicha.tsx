import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import Tela from '../components/Tela'
import { cpfEscondido, cpfValido, linkWhatsApp, mascaraCpf, mascaraTelefone } from '../lib/formatos'
import { supabase } from '../lib/supabase'

type Arquivo = { id: string; tipo: string; caminho_arquivo: string }
type Local = { id: string; nome: string; latitude: number; longitude: number; precisao_metros: number | null; foto_arquivo: string | null; registrado_em: string }
type Cliente = {
  id: string; nome_completo: string; cpf_final: string | null; telefone: string; status_cadastro: string; criado_em: string
  endereco: string | null; cep: string | null; trabalho_empresa: string | null; trabalho_endereco: string | null
  trabalho_telefone: string | null; trabalho_referencia: string | null; indicado_por: string | null
  valor_pretendido: number | null; modalidade_preferida: string | null; dia_vencimento_preferido: number | null
  cliente_arquivos: Arquivo[]; cliente_localizacoes: Local[]
}

const nomeTipo: Record<string, string> = { selfie: 'Selfie', documento: 'CNH / RG', comprovante: 'Comprovante', foto_casa: 'Casa' }
const nomeModalidade: Record<string, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', recorrente: 'Recorrente' }

function Linha({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="shrink-0 text-slate-600">{rotulo}</span>
      <strong className="text-right">{valor}</strong>
    </div>
  )
}

const mapa = (l: Local) => `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`

export default function ClienteFicha() {
  const { id } = useParams()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [cpfCompleto, setCpfCompleto] = useState('')
  const [novoCpf, setNovoCpf] = useState('')
  const [erroCpf, setErroCpf] = useState('')
  const [recarregar, setRecarregar] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [erroStatus, setErroStatus] = useState('')

  useEffect(() => {
    supabase
      .from('clientes')
      .select(`id, nome_completo, cpf_final, telefone, status_cadastro, criado_em, endereco, cep, trabalho_empresa,
               trabalho_endereco, trabalho_telefone, trabalho_referencia, indicado_por, valor_pretendido,
               modalidade_preferida, dia_vencimento_preferido,
               cliente_arquivos(id, tipo, caminho_arquivo),
               cliente_localizacoes(id, nome, latitude, longitude, precisao_metros, foto_arquivo, registrado_em)`)
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
    setRecarregar((n) => n + 1)
  }

  if (carregando) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Carregando…</p></Tela>
  if (!cliente) return <Tela voltar="/clientes"><p className="mt-6 text-slate-600">Cliente não encontrado.</p></Tela>

  const selfie = cliente.cliente_arquivos.find((a) => a.tipo === 'selfie')
  const fotos = cliente.cliente_arquivos.filter((a) => a.tipo !== 'selfie')

  return (
    <Tela voltar="/clientes">
      <div className="mt-4 flex items-center gap-4">
        {selfie && urls[selfie.caminho_arquivo] ? (
          <a href={urls[selfie.caminho_arquivo]} target="_blank" rel="noreferrer">
            <img src={urls[selfie.caminho_arquivo]} alt="Selfie" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          </a>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-3xl">👤</div>
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight">{cliente.nome_completo}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(cliente.criado_em).toLocaleDateString('pt-BR')} ·{' '}
            {{ pendente: '🟡 pendente de aprovação', aprovado: '✅ aprovado', reprovado: '❌ reprovado' }[cliente.status_cadastro] ?? cliente.status_cadastro}
          </p>
        </div>
      </div>

      {cliente.status_cadastro !== 'aprovado' && (
        <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">
            {cliente.status_cadastro === 'pendente' ? 'Cadastro esperando sua análise' : 'Cadastro reprovado'}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => mudarStatus('aprovado')} disabled={salvandoStatus}
              className="flex-1 rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-60">✅ Aprovar</button>
            {cliente.status_cadastro === 'pendente' && (
              <button onClick={() => mudarStatus('reprovado')} disabled={salvandoStatus}
                className="flex-1 rounded-xl border border-red-300 bg-white py-3 font-semibold text-red-700 disabled:opacity-60">❌ Reprovar</button>
            )}
          </div>
          {erroStatus && <p role="alert" className="mt-2 text-sm text-red-700">{erroStatus}</p>}
        </section>
      )}

      <a href={linkWhatsApp(cliente.telefone)} target="_blank" rel="noreferrer"
         className="mt-4 block w-full rounded-xl bg-emerald-600 py-3 text-center font-semibold text-white">
        💬 Chamar no WhatsApp
      </a>

      <section className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
        <Linha rotulo="Telefone" valor={mascaraTelefone(cliente.telefone)} />
        {cliente.cpf_final ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-slate-600">CPF</span>
            <span className="flex items-center gap-2">
              <strong>{cpfCompleto || cpfEscondido(cliente.cpf_final)}</strong>
              <button onClick={mostrarCpf} className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
                {cpfCompleto ? 'Ocultar' : 'Mostrar'}
              </button>
            </span>
          </div>
        ) : (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">CPF</span>
              <strong className="text-amber-700">⚠️ SEM CPF</strong>
            </div>
            <div className="mt-3 flex gap-2">
              <input inputMode="numeric" value={novoCpf} onChange={(e) => setNovoCpf(mascaraCpf(e.target.value))}
                placeholder="Completar CPF" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900" />
              <button onClick={salvarCpf} className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-white">Salvar</button>
            </div>
            {erroCpf && <p role="alert" className="mt-2 text-sm text-red-700">{erroCpf}</p>}
          </div>
        )}
        <Linha rotulo="Endereço" valor={cliente.endereco} />
        <Linha rotulo="CEP" valor={cliente.cep} />
        <Linha rotulo="Indicado por" valor={cliente.indicado_por} />
      </section>

      {(cliente.valor_pretendido || cliente.modalidade_preferida || cliente.dia_vencimento_preferido) && (
        <section className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          <p className="px-4 pt-3 text-sm font-semibold text-slate-500">O QUE O CLIENTE PEDIU</p>
          <Linha rotulo="Valor" valor={cliente.valor_pretendido ? `R$ ${Number(cliente.valor_pretendido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
          <Linha rotulo="Modalidade" valor={cliente.modalidade_preferida ? nomeModalidade[cliente.modalidade_preferida] : null} />
          <Linha rotulo="Dia de vencimento" valor={cliente.dia_vencimento_preferido ? `todo dia ${cliente.dia_vencimento_preferido}` : null} />
        </section>
      )}

      {(cliente.trabalho_empresa || cliente.trabalho_endereco || cliente.trabalho_telefone) && (
        <section className="mt-4 divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
          <p className="px-4 pt-3 text-sm font-semibold text-slate-500">TRABALHO</p>
          <Linha rotulo="Empresa" valor={cliente.trabalho_empresa} />
          <Linha rotulo="Endereço" valor={cliente.trabalho_endereco} />
          <Linha rotulo="Telefone" valor={cliente.trabalho_telefone ? mascaraTelefone(cliente.trabalho_telefone) : null} />
          <Linha rotulo="Referência" valor={cliente.trabalho_referencia} />
        </section>
      )}

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">LOCALIZAÇÕES</p>
        {cliente.cliente_localizacoes.length === 0 && <p className="mt-2 text-slate-600">⚠️ Sem localização.</p>}
        {cliente.cliente_localizacoes.map((l) => (
          <div key={l.id} className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              {l.foto_arquivo && urls[l.foto_arquivo] && (
                <img src={urls[l.foto_arquivo]} alt={l.nome} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              )}
              <div>
                <strong>📍 {l.nome}</strong>
                <p className="text-sm text-slate-500">
                  {l.precisao_metros !== null ? `precisão ${Math.round(l.precisao_metros)} m · ` : ''}
                  {new Date(l.registrado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <a href={mapa(l)} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-slate-900 py-2 text-center text-sm font-semibold text-white">🗺️ Abrir no mapa</a>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${cliente.nome_completo} - ${l.nome}: ${mapa(l)}`)}`} target="_blank" rel="noreferrer"
                 className="flex-1 rounded-xl bg-emerald-600 py-2 text-center text-sm font-semibold text-white">💬 Mandar no WhatsApp</a>
            </div>
          </div>
        ))}
      </section>

      {fotos.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">FOTOS E DOCUMENTOS</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {fotos.map((a) => (
              <a key={a.id} href={urls[a.caminho_arquivo]} target="_blank" rel="noreferrer" className="block rounded-xl bg-slate-50 p-2 text-center">
                {a.caminho_arquivo.endsWith('.pdf') ? (
                  <div className="flex h-24 items-center justify-center text-4xl">📄</div>
                ) : urls[a.caminho_arquivo] ? (
                  <img src={urls[a.caminho_arquivo]} alt={nomeTipo[a.tipo]} className="h-24 w-full rounded-lg object-cover" />
                ) : (
                  <div className="h-24" />
                )}
                <span className="mt-1 block text-sm">{nomeTipo[a.tipo] ?? a.tipo}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </Tela>
  )
}
