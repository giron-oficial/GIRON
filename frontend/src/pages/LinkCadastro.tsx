import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { cpfValido, mascaraCpf, mascaraTelefone, soDigitos } from '../lib/formatos'
import { useGps } from '../lib/gps'
import { prepararArquivo } from '../lib/imagem'
import { supabase } from '../lib/supabase'

// Pagina PUBLICA (sem login) que o cliente abre pelo link de cadastro (RN-30 a RN-46)

type Info = { valido: boolean; empresa?: string; tenant_id?: string; tipo?: string }
type TipoArquivo = 'selfie' | 'documento' | 'comprovante' | 'foto_casa'

const campo = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-900'

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function Rotulo({ para, children, opcional }: { para: string; children: ReactNode; opcional?: boolean }) {
  return (
    <label htmlFor={para} className="mt-4 block text-sm font-medium">
      {children} {opcional && <span className="font-normal text-slate-500">(opcional)</span>}
    </label>
  )
}

function Foto({ id, rotulo, arquivo, aoEscolher, camera, pdf }: {
  id: string; rotulo: string; arquivo: File | null; aoEscolher: (f: File | null) => void; camera?: 'user' | 'environment'; pdf?: boolean
}) {
  return (
    <div className="mt-4">
      <span className="block text-sm font-medium">{rotulo}</span>
      <label htmlFor={id} className={`mt-1 flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${arquivo ? 'border-emerald-400 bg-emerald-50' : 'border-dashed border-slate-400'}`}>
        <span className="truncate">{arquivo ? `✅ ${arquivo.name}` : '📷 Tocar para tirar/escolher'}</span>
        {arquivo && <span className="ml-2 shrink-0 text-sm text-slate-600">trocar</span>}
      </label>
      <input id={id} type="file" className="hidden" accept={pdf ? 'image/*,application/pdf' : 'image/*'}
        {...(camera ? { capture: camera } : {})}
        onChange={(e) => aoEscolher(e.target.files?.[0] ?? null)} />
    </div>
  )
}

export default function LinkCadastro() {
  const { codigo = '' } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [d, setD] = useState({
    nome_completo: '', cpf: '', telefone: '', cep: '', endereco: '',
    trabalho_empresa: '', trabalho_endereco: '', trabalho_telefone: '', trabalho_referencia: '',
    indicado_por: '', valor_pretendido: '', modalidade_preferida: '', dia_vencimento_preferido: '',
  })
  const [fotos, setFotos] = useState<Record<string, File | null>>({ selfie: null, documento: null, comprovante: null, casa1: null, casa2: null })
  const [consentimento, setConsentimento] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState('')
  const [enviado, setEnviado] = useState(false)
  const gps = useGps()

  useEffect(() => {
    supabase.rpc('link_info', { p_codigo: codigo }).then(({ data }) => setInfo((data as Info) ?? { valido: false }))
  }, [codigo])

  const muda = (k: keyof typeof d) => (v: string) => setD((x) => ({ ...x, [k]: v }))

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (d.nome_completo.trim().length < 3) return setErro('Informe seu nome completo.')
    if (!cpfValido(d.cpf)) return setErro('CPF inválido. Confira os números.')
    if (soDigitos(d.telefone).length < 10) return setErro('Telefone inválido. Use DDD + número.')
    if (!consentimento) return setErro('Marque a caixinha autorizando o uso dos seus dados.')
    if (gps.estado === 'buscando') return setErro('Espere a localização terminar (ou toque em "Usar assim").')

    try {
      const pasta = `${info!.tenant_id}/${codigo}`
      const arquivos: { tipo: TipoArquivo; caminho: string }[] = []
      const lista: [string, TipoArquivo][] = [['selfie', 'selfie'], ['documento', 'documento'], ['comprovante', 'comprovante'], ['casa1', 'foto_casa'], ['casa2', 'foto_casa']]
      let n = 0
      for (const [chave, tipo] of lista) {
        const f = fotos[chave]
        if (!f) continue
        n++
        setEtapa(`Enviando foto ${n}…`)
        const p = await prepararArquivo(f)
        const caminho = `${pasta}/${chave}.${p.extensao}`
        const { error } = await supabase.storage.from('clientes').upload(caminho, p.blob, { contentType: p.tipo, upsert: false })
        if (error && !error.message.toLowerCase().includes('exists')) throw new Error('Falha ao enviar uma foto. Confira sua internet e tente de novo.')
        arquivos.push({ tipo, caminho })
      }
      const fotoLocal = arquivos.find((a) => a.caminho.includes('/casa1.'))?.caminho ?? null
      setEtapa('Enviando cadastro…')
      const { error } = await supabase.rpc('link_enviar_cadastro', {
        p_codigo: codigo,
        p_dados: {
          ...d,
          telefone: soDigitos(d.telefone),
          valor_pretendido: soDigitos(d.valor_pretendido),
          consentimento,
          arquivos,
          localizacao: gps.melhor
            ? { nome: 'Minha casa', latitude: gps.melhor.latitude, longitude: gps.melhor.longitude, precisao_metros: gps.melhor.precisao, foto: fotoLocal }
            : null,
        },
      })
      if (error) throw new Error(error.message)
      setEnviado(true)
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não foi possível enviar. Tente de novo.')
    } finally {
      setEtapa('')
    }
  }

  const moldura = (conteudo: ReactNode) => (
    <main className="min-h-dvh bg-slate-50 px-4 pb-12 pt-6 text-slate-900">
      <div className="mx-auto max-w-md">{conteudo}</div>
    </main>
  )

  if (!info) return moldura(<p className="text-slate-600">Carregando…</p>)
  if (enviado) return moldura(
    <div className="mt-10 rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-5xl">✅</p>
      <h1 className="mt-3 text-2xl font-bold">Enviado com sucesso!</h1>
      <p className="mt-2 text-slate-600">{info.empresa} vai analisar seu cadastro e entrar em contato.</p>
    </div>,
  )
  if (!info.valido) return moldura(
    <div className="mt-10 rounded-2xl bg-white p-6 text-center shadow-sm">
      <p className="text-5xl">⛔</p>
      <h1 className="mt-3 text-xl font-bold">Este link não está mais valendo</h1>
      <p className="mt-2 text-slate-600">Ele já foi usado ou venceu. Peça um novo link para quem te enviou.</p>
    </div>,
  )

  const gpsTexto = {
    parado: '',
    buscando: `Melhorando a precisão… ${gps.melhor ? `${gps.melhor.precisao} m` : ''} (${gps.segundos}s de 60s)`,
    pronto: gps.melhor ? `✅ Localização registrada (precisão ${gps.melhor.precisao} m)` : '',
    negado: '⚠️ Localização não autorizada. Você pode enviar mesmo assim.',
    indisponivel: '⚠️ Não foi possível pegar a localização. Você pode enviar mesmo assim.',
  }[gps.estado]

  return moldura(
    <form onSubmit={enviar}>
      <p className="text-sm text-slate-500">Cadastro para</p>
      <h1 className="text-2xl font-bold">{info.empresa}</h1>
      <p className="mt-1 text-slate-600">Preencha com calma. Campos sem “(opcional)” são obrigatórios.</p>

      <Bloco titulo="1. Seus dados">
        <Rotulo para="nome">Nome completo</Rotulo>
        <input id="nome" autoComplete="name" value={d.nome_completo} onChange={(e) => muda('nome_completo')(e.target.value)} className={campo} />
        <Rotulo para="cpf">CPF</Rotulo>
        <input id="cpf" inputMode="numeric" value={d.cpf} onChange={(e) => muda('cpf')(mascaraCpf(e.target.value))} placeholder="000.000.000-00" className={campo} />
        <Rotulo para="tel">Telefone (WhatsApp)</Rotulo>
        <input id="tel" inputMode="tel" autoComplete="tel" value={d.telefone} onChange={(e) => muda('telefone')(mascaraTelefone(e.target.value))} placeholder="(63) 99999-0000" className={campo} />
        <Rotulo para="cep" opcional>CEP</Rotulo>
        <input id="cep" inputMode="numeric" autoComplete="postal-code" value={d.cep} onChange={(e) => muda('cep')(e.target.value)} className={campo} />
        <Rotulo para="end" opcional>Endereço completo</Rotulo>
        <input id="end" autoComplete="street-address" value={d.endereco} onChange={(e) => muda('endereco')(e.target.value)} placeholder="Rua, número, bairro, cidade" className={campo} />
      </Bloco>

      <Bloco titulo="2. Onde você trabalha">
        <Rotulo para="temp" opcional>Nome da empresa</Rotulo>
        <input id="temp" value={d.trabalho_empresa} onChange={(e) => muda('trabalho_empresa')(e.target.value)} className={campo} />
        <Rotulo para="tend" opcional>Endereço do trabalho</Rotulo>
        <input id="tend" value={d.trabalho_endereco} onChange={(e) => muda('trabalho_endereco')(e.target.value)} className={campo} />
        <Rotulo para="ttel" opcional>Telefone do trabalho</Rotulo>
        <input id="ttel" inputMode="tel" value={d.trabalho_telefone} onChange={(e) => muda('trabalho_telefone')(mascaraTelefone(e.target.value))} className={campo} />
        <Rotulo para="tref" opcional>Ponto de referência</Rotulo>
        <input id="tref" value={d.trabalho_referencia} onChange={(e) => muda('trabalho_referencia')(e.target.value)} className={campo} />
      </Bloco>

      <Bloco titulo="3. O empréstimo">
        <Rotulo para="ind" opcional>Quem te indicou</Rotulo>
        <input id="ind" value={d.indicado_por} onChange={(e) => muda('indicado_por')(e.target.value)} className={campo} />
        <Rotulo para="val" opcional>Valor que você precisa (R$)</Rotulo>
        <input id="val" inputMode="numeric" value={d.valor_pretendido} onChange={(e) => muda('valor_pretendido')(soDigitos(e.target.value))} placeholder="Ex.: 1000" className={campo} />
        <Rotulo para="mod" opcional>Como prefere pagar</Rotulo>
        <select id="mod" value={d.modalidade_preferida} onChange={(e) => muda('modalidade_preferida')(e.target.value)} className={campo}>
          <option value="">Escolher…</option>
          <option value="diario">Diário</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
          <option value="recorrente">Recorrente (só o juro todo mês)</option>
        </select>
        <Rotulo para="dia" opcional>Melhor dia de vencimento</Rotulo>
        <input id="dia" inputMode="numeric" value={d.dia_vencimento_preferido} onChange={(e) => muda('dia_vencimento_preferido')(soDigitos(e.target.value).slice(0, 2))} placeholder="Ex.: 10" className={campo} />
      </Bloco>

      <Bloco titulo="4. Fotos e documentos">
        <p className="mt-1 text-sm text-slate-500">Pode tirar na hora com a câmera. As fotos ficam guardadas com segurança.</p>
        <Foto id="f-selfie" rotulo="Selfie (foto do seu rosto)" camera="user" arquivo={fotos.selfie} aoEscolher={(f) => setFotos((x) => ({ ...x, selfie: f }))} />
        <Foto id="f-doc" rotulo="CNH ou RG" arquivo={fotos.documento} aoEscolher={(f) => setFotos((x) => ({ ...x, documento: f }))} />
        <Foto id="f-comp" rotulo="Comprovante de endereço (foto ou PDF)" pdf arquivo={fotos.comprovante} aoEscolher={(f) => setFotos((x) => ({ ...x, comprovante: f }))} />
        <Foto id="f-casa1" rotulo="Foto da frente da casa" camera="environment" arquivo={fotos.casa1} aoEscolher={(f) => setFotos((x) => ({ ...x, casa1: f }))} />
        <Foto id="f-casa2" rotulo="Outra foto da frente da casa" camera="environment" arquivo={fotos.casa2} aoEscolher={(f) => setFotos((x) => ({ ...x, casa2: f }))} />
      </Bloco>

      <Bloco titulo="5. Localização da sua casa">
        <p className="mt-1 text-sm text-slate-500">⚠️ Faça esta parte <strong>estando em casa</strong>. O celular vai pedir permissão: toque em “Permitir”.</p>
        {gps.estado !== 'pronto' && (
          <button type="button" onClick={gps.iniciar} disabled={gps.estado === 'buscando'}
            className="mt-4 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60">
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
      </Bloco>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
          <span className="text-sm">Autorizo o uso dos meus dados, fotos e localização por <strong>{info.empresa}</strong> para análise e controle do meu cadastro.</span>
        </label>
      </section>

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <button type="submit" disabled={!!etapa} className="mt-6 w-full rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-60">
        {etapa || 'Enviar cadastro'}
      </button>
    </form>,
  )
}
