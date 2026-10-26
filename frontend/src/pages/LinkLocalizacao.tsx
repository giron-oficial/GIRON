import { useState, type FormEvent } from 'react'
import { useGps } from '../lib/gps'
import { prepararArquivo } from '../lib/imagem'
import { supabase } from '../lib/supabase'

// Pagina PUBLICA (sem login) do link de NOVA LOCALIZACAO (RN-45): o cliente escreve o nome do local,
// tira a foto e envia o GPS. Nao mostra nenhum outro dado dele. Depois do envio o link morre.
// Mesmo visual claro do link de cadastro (o dono ainda nao decidiu se a tela do cliente fica escura).

type Info = { empresa?: string; tenant_id?: string; primeiro_nome?: string }
const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900'

export default function LinkLocalizacao({ codigo, info }: { codigo: string; info: Info }) {
  const [nome, setNome] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState('')
  const [enviado, setEnviado] = useState(false)
  const gps = useGps()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (gps.estado === 'buscando') return setErro('Espere a localização terminar (ou toque em "Usar assim").')
    if (!gps.melhor) return setErro('Toque em "Enviar minha localização" e permita o acesso ao GPS.')
    try {
      let caminho: string | null = null
      if (foto) {
        setEtapa('Enviando foto…')
        const p = await prepararArquivo(foto)
        caminho = `${info.tenant_id}/${codigo}/local.${p.extensao}`
        const { error } = await supabase.storage.from('clientes').upload(caminho, p.blob, { contentType: p.tipo, upsert: false })
        if (error && !error.message.toLowerCase().includes('exists')) throw new Error('Falha ao enviar a foto. Confira sua internet e tente de novo.')
      }
      setEtapa('Enviando localização…')
      const { error } = await supabase.rpc('link_enviar_localizacao', {
        p_codigo: codigo,
        p_dados: { nome, latitude: gps.melhor.latitude, longitude: gps.melhor.longitude, precisao_metros: gps.melhor.precisao, foto: caminho },
      })
      if (error) throw new Error(error.message)
      setEnviado(true)
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não foi possível enviar. Tente de novo.')
    } finally {
      setEtapa('')
    }
  }

  const moldura = (conteudo: React.ReactNode) => (
    <main className="min-h-dvh bg-slate-50 px-4 pb-12 pt-6 text-slate-900">
      <div className="mx-auto max-w-md">{conteudo}</div>
    </main>
  )

  if (enviado) return moldura(
    <div className="mt-10 rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-5xl">✅</p>
      <h1 className="mt-3 text-2xl font-bold">Localização enviada!</h1>
      <p className="mt-2 text-slate-600">{info.empresa} já recebeu. Pode fechar esta página.</p>
    </div>,
  )

  const gpsTexto = {
    parado: '',
    buscando: `Melhorando a precisão… ${gps.melhor ? `${gps.melhor.precisao} m` : ''} (${gps.segundos}s de 60s)`,
    pronto: gps.melhor ? `✅ Localização registrada (precisão ${gps.melhor.precisao} m)` : '',
    negado: '⚠️ Localização não autorizada. Toque em "Permitir" quando o celular perguntar.',
    indisponivel: '⚠️ Não foi possível pegar a localização. Tente de novo em local aberto.',
  }[gps.estado]

  return moldura(
    <form onSubmit={enviar}>
      <p className="text-sm text-slate-500">{info.empresa}</p>
      <h1 className="text-2xl font-bold">{info.primeiro_nome ? `${info.primeiro_nome}, ` : ''}envie sua nova localização</h1>
      <p className="mt-1 text-slate-600">⚠️ Faça isto <strong>estando no local</strong>. Leva menos de 1 minuto.</p>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">1. Que lugar é este?</h2>
        <label htmlFor="nome" className="mt-4 block text-sm font-medium">Nome do local</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Casa nova, Trabalho, Casa da mãe" className={campo} />
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">2. Foto da frente do local <span className="font-normal text-slate-500">(opcional)</span></h2>
        <label htmlFor="foto" className={`mt-4 flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${foto ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-slate-400'}`}>
          <span className="truncate">{foto ? `✅ ${foto.name}` : '📷 Tocar para tirar a foto'}</span>
          {foto && <span className="ml-2 shrink-0 text-sm text-slate-600">trocar</span>}
        </label>
        <input id="foto" type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">3. Sua localização</h2>
        <p className="mt-1 text-sm text-slate-500">O celular vai pedir permissão: toque em “Permitir”.</p>
        {gps.estado !== 'pronto' && (
          <button type="button" onClick={gps.iniciar} disabled={gps.estado === 'buscando'} className="mt-4 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60">
            📍 {gps.estado === 'buscando' ? 'Buscando…' : 'Enviar minha localização'}
          </button>
        )}
        {gpsTexto && <p className="mt-3 text-sm">{gpsTexto}</p>}
        {gps.estado === 'buscando' && gps.melhor && (
          <button type="button" onClick={gps.usarAssim} className="mt-2 text-sm text-slate-600 underline">Usar assim ({gps.melhor.precisao} m)</button>
        )}
        {gps.estado === 'pronto' && (
          <button type="button" onClick={gps.iniciar} className="mt-2 text-sm text-slate-600 underline">Pegar de novo</button>
        )}
      </section>

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <button type="submit" disabled={!!etapa} className="mt-6 w-full rounded-xl bg-[#1F6FEF] py-4 text-lg font-semibold text-white disabled:opacity-60">
        {etapa || 'Enviar localização'}
      </button>
    </form>,
  )
}
