import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CampoMini, Grupo, Linha, Passos } from '../components/Ajustes'
import ChavesPix from '../components/ChavesPix'
import Icone from '../components/Icone'
import Interruptor from '../components/Interruptor'
import MeuPlano from '../components/MeuPlano'
import MinhaEmpresa from '../components/MinhaEmpresa'
import Tela from '../components/Tela'
import { erroCaixa } from '../components/estilo'
import { encargosAtraso } from '../lib/atraso'
import { useAuth } from '../lib/auth'
import { mascaraPercentual, mascaraReais, numeroBr, percentualCompleto, reais, reaisCampo } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import { supabase } from '../lib/supabase'

// Configurações do Fomentado (fomentado_configuracoes), no estilo "ajustes do celular":
// marca da empresa (logo e nome), juro padrão, regras de atraso (5.5), o que o cliente vê no extrato (5.7), chaves Pix (5.9) e conta.
// Só aparece "Salvar" quando algo mudou; as chaves Pix gravam sozinhas.

type Desde = 'vencimento' | 'critico'
type Valores = { juroPadrao: string; dias: number; multa: string; juroDia: string; desde: Desde; juroExtrato: boolean; totalExtrato: boolean }
const inicial: Valores = { juroPadrao: '', dias: 2, multa: '', juroDia: '', desde: 'vencimento', juroExtrato: false, totalExtrato: false }

export default function Configuracoes() {
  const { session } = useAuth()
  const [tenant, setTenant] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [v, setV] = useState<Valores>(inicial)
  const [salvoNoBanco, setSalvoNoBanco] = useState<Valores>(inicial)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const muda = <K extends keyof Valores>(k: K, x: Valores[K]) => { setV((a) => ({ ...a, [k]: x })); setSalvo(false) }

  useEffect(() => {
    Promise.all([
      supabase.from('fomentados').select('id').maybeSingle(),
      supabase.from('fomentado_configuracoes').select('juro_padrao_percentual, dias_para_critico, multa_atraso_valor, juro_diario_atraso_valor, juro_atraso_desde, mostrar_juro_no_extrato, mostrar_total_no_extrato').maybeSingle(),
    ]).then(([{ data: f }, { data: c }]) => {
      setTenant(f?.id ?? null)
      if (c) {
        const lido: Valores = {
          juroPadrao: c.juro_padrao_percentual != null ? percentualCompleto(Number(c.juro_padrao_percentual)) : '',
          dias: c.dias_para_critico ?? 2,
          multa: Number(c.multa_atraso_valor) ? reaisCampo(Number(c.multa_atraso_valor)) : '',
          juroDia: Number(c.juro_diario_atraso_valor) ? reaisCampo(Number(c.juro_diario_atraso_valor)) : '',
          desde: c.juro_atraso_desde === 'critico' ? 'critico' : 'vencimento',
          juroExtrato: !!c.mostrar_juro_no_extrato,
          totalExtrato: !!c.mostrar_total_no_extrato,
        }
        setV(lido); setSalvoNoBanco(lido)
      }
      setCarregando(false)
    })
  }, [])

  const regra = useMemo(() => ({ multa: v.multa ? numeroBr(v.multa) : 0, juroDia: v.juroDia ? numeroBr(v.juroDia) : 0, diasCritico: v.dias, desde: v.desde }), [v])
  const cobra = regra.multa > 0 || regra.juroDia > 0
  const exemploDias = Math.max(v.dias + 5, 10)
  const exemplo = encargosAtraso(exemploDias, regra)
  const mudou = JSON.stringify(v) !== JSON.stringify(salvoNoBanco)

  async function salvar() {
    setErro(''); setSalvo(false)
    if (!tenant) return setErro('Sua conta ainda não está ligada a uma empresa.')
    setSalvando(true)
    const { error } = await supabase.from('fomentado_configuracoes').upsert({
      tenant_id: tenant,
      juro_padrao_percentual: v.juroPadrao ? numeroBr(v.juroPadrao) : null,
      dias_para_critico: v.dias,
      multa_atraso_valor: regra.multa,
      juro_diario_atraso_valor: regra.juroDia,
      juro_atraso_desde: v.desde,
      mostrar_juro_no_extrato: v.juroExtrato,
      mostrar_total_no_extrato: v.totalExtrato,
    })
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Confira os valores e tente de novo.')
    rastrear('configuracoes_salvas')
    setSalvoNoBanco(v); setSalvo(true)
  }

  if (carregando) {
    return (
      <Tela titulo="Configurações">
        <div className="mt-4 flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-[18px] bg-superficie-2" />)}</div>
      </Tela>
    )
  }

  const diasVencido = v.dias - 1
  return (
    <Tela titulo="Configurações" subtitulo="Regras que o sistema usa nos seus empréstimos">
      <div className="mt-4 flex flex-col gap-3 lg:mt-5">
        <MeuPlano />

        <MinhaEmpresa />

        <Grupo icone="porcento" titulo="Juros" descricao="Já vem preenchido quando você faz um empréstimo novo">
          <Linha titulo="Juro padrão ao mês" htmlFor="jp">
            <CampoMini id="jp" valor={v.juroPadrao} onChange={(x) => muda('juroPadrao', mascaraPercentual(x))} sufixo="%" placeholder="10" inputMode="decimal" largura="w-28" />
          </Linha>
        </Grupo>

        <Grupo icone="relogio" titulo="Atraso" descricao="Deixe multa e juro em zero pra não cobrar. Na hora de receber você sempre pode negociar." cor="text-vencido bg-vencido/15">
          <Linha titulo="Vira Crítico com" dica="Antes disso a parcela fica só como Vencida">
            <Passos valor={v.dias} onChange={(x) => muda('dias', x)} min={2} max={60} sufixo={v.dias === 1 ? 'dia' : 'dias'} />
          </Linha>

          {/* linha do tempo: em dia → vencido → crítico */}
          <div className="px-4 py-4 lg:px-5">
            <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
              <span className="flex-[2.5] rounded-full bg-gradient-to-r from-marca-clara to-marca" />
              <span className="flex-[2.2] rounded-full bg-gradient-to-r from-amanha to-amanha/70" />
              <span className="flex-[2] rounded-full bg-gradient-to-r from-hoje to-hoje/70" />
              <span className="rounded-full bg-gradient-to-r from-vencido to-vencido/70" style={{ flex: Math.min(diasVencido, 8) + 1.5 }} />
              <span className="flex-[4] rounded-full bg-gradient-to-r from-critico to-critico/70" />
            </div>
            <div className="mt-2 flex gap-1 text-[11px] leading-tight font-semibold">
              <span className="flex-[2.5] text-marca">Em dia</span>
              <span className="flex-[2.2] text-amanha">Amanhã<br /><span className="font-medium text-suave">vence</span></span>
              <span className="flex-[2] text-hoje">Hoje<br /><span className="font-medium text-suave">vence</span></span>
              <span className="text-vencido" style={{ flex: Math.min(diasVencido, 8) + 1.5 }}>Vencido<br /><span className="font-medium text-suave">{diasVencido === 1 ? '1 dia' : `1 a ${diasVencido} dias`}</span></span>
              <span className="flex-[4] text-critico">Crítico<br /><span className="font-medium text-suave">{v.dias}º dia{cobra ? ' · multa e juro' : ''}</span></span>
            </div>
          </div>

          <Linha titulo="Multa" dica="Valor único, cobrado uma vez quando vira Crítico" htmlFor="mu">
            <CampoMini id="mu" valor={v.multa} onChange={(x) => muda('multa', mascaraReais(x))} prefixo="R$" placeholder="0,00" />
          </Linha>
          <Linha titulo="Juro por dia de atraso" dica="Soma todo dia enquanto não paga" htmlFor="jd">
            <CampoMini id="jd" valor={v.juroDia} onChange={(x) => muda('juroDia', mascaraReais(x))} prefixo="R$" placeholder="0,00" />
          </Linha>
          {regra.juroDia > 0 && (
            <Linha titulo="Juro conta desde o vencimento" dica={v.desde === 'vencimento' ? 'Ligado: conta desde o 1º dia de atraso (cobrado quando vira Crítico)' : 'Desligado: só começa a contar no dia que vira Crítico'}>
              <Interruptor ligado={v.desde === 'vencimento'} onChange={(x) => muda('desde', x ? 'vencimento' : 'critico')} rotulo="Juro por dia conta desde o vencimento" />
            </Linha>
          )}
          {cobra && (
            <div className="flex items-center gap-3 bg-superficie-2/40 px-4 py-3.5 lg:px-5">
              <div className="min-w-0 flex-1 text-sm text-suave">
                Exemplo: <strong className="text-texto">{exemploDias} dias</strong> de atraso = {reais(exemplo.multa)} de multa + {reais(exemplo.juro)} de juro ({exemplo.dias} {exemplo.dias === 1 ? 'dia' : 'dias'})
              </div>
              <span className="shrink-0 text-lg font-extrabold tabular-nums text-vencido">+{reais(exemplo.total)}</span>
            </div>
          )}
        </Grupo>

        <Grupo icone="recibo" titulo="Extrato do cliente" descricao="O extrato interno (só seu) sempre mostra tudo" cor="text-amanha bg-amanha/15">
          <Linha titulo="Mostrar o % de juro ao mês">
            <Interruptor ligado={v.juroExtrato} onChange={(x) => muda('juroExtrato', x)} rotulo="Mostrar o % de juro ao mês no extrato do cliente" />
          </Linha>
          <Linha titulo="Mostrar o total a pagar" dica="Soma de todas as parcelas">
            <Interruptor ligado={v.totalExtrato} onChange={(x) => muda('totalExtrato', x)} rotulo="Mostrar o total a pagar no extrato do cliente" />
          </Linha>
        </Grupo>

        <ChavesPix tenant={tenant} />

        <Grupo icone="cadeado" titulo="Conta" cor="text-suave bg-superficie-2">
          <Linha titulo="E-mail de acesso" dica={session?.user.email} />
          <Link to="/nova-senha" className="flex items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-semibold transition hover:bg-superficie-2/40 lg:px-5">
            Trocar minha senha
            <Icone nome="direita" tamanho={18} className="text-suave" />
          </Link>
        </Grupo>

        {erro && <p role="alert" className={erroCaixa}>{erro}</p>}
      </div>

      {/* barra de salvar: só aparece quando algo mudou; fica grudada embaixo enquanto rola */}
      <div className={`sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-10 mt-4 transition-all lg:bottom-4 ${mudou || salvo ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
        {salvo && !mudou ? (
          <p className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-marca/40 bg-tinta px-4 text-sm font-bold text-marca shadow-xl shadow-black/40">
            <Icone nome="certo" tamanho={18} />
            Salvo. Já vale pros próximos cálculos.
          </p>
        ) : (
          <div className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-borda bg-tinta py-1.5 pr-1.5 pl-4 shadow-xl shadow-black/40">
            <span className="text-sm font-semibold text-suave">Alterações não salvas</span>
            <button onClick={salvar} disabled={salvando} className="verde inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-extrabold disabled:opacity-60">
              <Icone nome="certo" tamanho={18} />
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    </Tela>
  )
}
