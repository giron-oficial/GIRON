import { useEffect, useState, type FormEvent } from 'react'
import { erroEmPortugues, useAuth } from '../lib/auth'
import { carregarBarra, resumoGuardado, type ResumoBarra } from '../lib/barra'
import { dataBr, reais } from '../lib/formatos'
import { EMAIL_SUPORTE } from '../lib/marca'
import { supabase } from '../lib/supabase'
import { Grupo, Linha } from './Ajustes'
import Icone from './Icone'
import { campo, erroCaixa } from './estilo'

// "Meu plano" nas Configurações: a financeira VÊ o plano e o que está ligado (robô do Telegram, WhatsApp automático)
// e PEDE pra ativar: vê o novo valor, confirma com a senha e o dono do GIRON recebe o aviso e libera (migração 0022).

type Recurso = 'agente_telegram' | 'whatsapp_automatico'
const NOME: Record<Recurso, string> = { agente_telegram: 'robô do Telegram', whatsapp_automatico: 'WhatsApp automático' }
const ADICIONAL_ROBO = 20 // igual à migração 0022 (R$ 69,90 -> R$ 89,90)

function Selo({ ligado }: { ligado: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${ligado ? 'bg-sucesso/15 text-sucesso' : 'bg-superficie-2 text-suave'}`}>
      <span className={`size-1.5 rounded-full ${ligado ? 'bg-sucesso' : 'bg-suave/60'}`} />
      {ligado ? 'Ligado' : 'Desligado'}
    </span>
  )
}

function Pedido({ recurso, r, fechar, pronto }: { recurso: Recurso; r: ResumoBarra; fechar: () => void; pronto: () => void }) {
  const { session } = useAuth()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const nova = recurso === 'agente_telegram' ? r.mensalidade + ADICIONAL_ROBO : null

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    const email = session?.user.email
    if (!email || !senha) return
    setErro('')
    setEnviando(true)
    // Confere a senha entrando de novo com ela (mesma conta, a sessão continua)
    const login = await supabase.auth.signInWithPassword({ email, password: senha })
    if (login.error) {
      setEnviando(false)
      return setErro(login.error.message.toLowerCase().includes('invalid') ? 'Senha errada.' : erroEmPortugues(login.error.message))
    }
    const { error } = await supabase.rpc('pedir_ativacao', { p_recurso: recurso })
    setEnviando(false)
    if (error) return setErro(error.message.includes('ja esta ligado') ? 'Isso já está ligado na sua conta.' : 'Não foi possível mandar o pedido. Tente de novo.')
    pronto()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={fechar}>
      <form role="dialog" aria-modal="true" aria-label={`Ativar ${NOME[recurso]}`} onSubmit={confirmar} onClick={(e) => e.stopPropagation()} className="cartao flex w-full max-w-sm flex-col gap-4 rounded-[18px] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <span className="font-bold">Ativar o {NOME[recurso]}</span>
          <button type="button" onClick={fechar} aria-label="Fechar" className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-xl text-suave hover:bg-white/5">
            <Icone nome="xis" tamanho={18} />
          </button>
        </div>
        {nova !== null ? (
          <div className="rounded-2xl bg-superficie-2 p-4">
            <span className="text-xs text-suave">Sua mensalidade vai passar de</span>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-suave line-through">{reais(r.mensalidade)}</span>
              <span className="text-suave">para</span>
              <span className="font-display text-2xl font-extrabold">{reais(nova)}</span>
            </p>
            {r.testeGratisAte && <span className="mt-1 block text-xs text-suave">No teste grátis você não paga nada. O valor novo vale depois do teste.</span>}
          </div>
        ) : (
          <p className="rounded-2xl bg-superficie-2 p-4 text-sm text-suave">O valor do WhatsApp automático ainda vai ser combinado. O GIRON te passa o valor antes de ligar.</p>
        )}
        <label className="text-sm font-semibold">
          Digite sua senha pra confirmar
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} autoFocus />
        </label>
        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}
        <button type="submit" disabled={!senha || enviando} className={`${recurso === 'agente_telegram' ? 'telegram' : 'zap'} inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 font-extrabold disabled:opacity-60`}>
          {enviando ? 'Enviando…' : nova !== null ? `Confirmar ${reais(nova)} por mês` : 'Confirmar pedido'}
        </button>
      </form>
    </div>
  )
}

export default function MeuPlano() {
  const [r, setR] = useState<ResumoBarra | null>(resumoGuardado)
  const [pendentes, setPendentes] = useState<Recurso[]>([])
  const [abrir, setAbrir] = useState<Recurso | null>(null)
  const [aviso, setAviso] = useState('')
  const verPedidos = () =>
    supabase.from('pedidos_ativacao').select('recurso').eq('status', 'pendente').then(({ data }) => setPendentes((data ?? []).map((p) => p.recurso as Recurso)))
  useEffect(() => {
    carregarBarra().then(setR).catch(() => {})
    verPedidos()
  }, [])
  if (!r) return null

  const plano = r.testeGratisAte
    ? { titulo: 'Teste grátis', dica: r.testeFaltam === 0 ? 'Termina hoje' : `Faltam ${r.testeFaltam} ${r.testeFaltam === 1 ? 'dia' : 'dias'} (até ${dataBr(r.testeGratisAte)})` }
    : { titulo: `${reais(r.mensalidade)} por mês`, dica: r.proximaMensalidade ? `Próximo vencimento: ${dataBr(r.proximaMensalidade.vencimento)}` : 'Plano ativo' }
  const ativar = (recurso: Recurso, estilo: string) =>
    pendentes.includes(recurso) ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amanha/15 px-2.5 py-1 text-xs font-bold text-amanha">Pedido enviado</span>
    ) : (
      <button type="button" onClick={() => setAbrir(recurso)} className={`${estilo} inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-bold`}>
        Quero ativar
      </button>
    )

  return (
    <div>
      <Grupo icone="moeda" titulo="Meu plano" descricao="Pra ativar algo, toque em Quero ativar" cor="text-sucesso bg-sucesso/15">
        <Linha titulo={plano.titulo} dica={plano.dica} />
        <Linha
          titulo="Robô do Telegram"
          dica={r.robo ? 'Em construção: chega em breve' : 'Consulte e lance tudo pelo Telegram'}
        >
          {r.robo ? <Selo ligado /> : ativar('agente_telegram', 'telegram')}
        </Linha>
        <Linha
          titulo="WhatsApp automático"
          dica={
            r.whatsapp
              ? r.testeGratisAte
                ? 'No teste: 5 mensagens grátis'
                : 'O sistema cobra sozinho'
              : 'O sistema cobra seus clientes sozinho'
          }
        >
          {r.whatsapp ? <Selo ligado /> : ativar('whatsapp_automatico', 'zap')}
        </Linha>
        <Linha titulo="Suporte" dica={`GIRON · ${EMAIL_SUPORTE}`} />
      </Grupo>
      {aviso && <p role="status" className="mt-2 rounded-2xl bg-sucesso/15 px-4 py-3 text-sm font-semibold text-sucesso">{aviso}</p>}
      {abrir && (
        <Pedido
          recurso={abrir}
          r={r}
          fechar={() => setAbrir(null)}
          pronto={() => {
            setAviso(`Pedido enviado! O GIRON foi avisado e vai liberar o ${NOME[abrir]} em breve.`)
            setAbrir(null)
            verPedidos()
          }}
        />
      )}
    </div>
  )
}
