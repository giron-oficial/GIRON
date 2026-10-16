import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Icone from '../components/Icone'
import Tela from '../components/Tela'
import ChavesPix from '../components/ChavesPix'
import { botaoVerde, campo, erroCaixa, rotulo, tituloSecao } from '../components/estilo'
import { encargosAtraso } from '../lib/atraso'
import { mascaraPercentual, mascaraReais, numeroBr, percentualCompleto, reais, reaisCampo } from '../lib/formatos'
import { supabase } from '../lib/supabase'

// Configurações do Fomentado (fomentado_configuracoes): juro padrão, regras de atraso (5.5) e chaves Pix (5.9).

type Desde = 'vencimento' | 'critico'

export default function Configuracoes() {
  const [tenant, setTenant] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [juroPadrao, setJuroPadrao] = useState('')
  const [diasCritico, setDiasCritico] = useState('2')
  const [multa, setMulta] = useState('')
  const [juroDia, setJuroDia] = useState('')
  const [desde, setDesde] = useState<Desde>('vencimento')
  const [juroExtrato, setJuroExtrato] = useState(false)
  const [totalExtrato, setTotalExtrato] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('fomentados').select('id').maybeSingle(),
      supabase.from('fomentado_configuracoes').select('juro_padrao_percentual, dias_para_critico, multa_atraso_valor, juro_diario_atraso_valor, juro_atraso_desde, mostrar_juro_no_extrato, mostrar_total_no_extrato').maybeSingle(),
    ]).then(([{ data: f }, { data: c }]) => {
      setTenant(f?.id ?? null)
      if (c) {
        if (c.juro_padrao_percentual != null) setJuroPadrao(percentualCompleto(Number(c.juro_padrao_percentual)))
        setDiasCritico(String(c.dias_para_critico ?? 2))
        if (Number(c.multa_atraso_valor)) setMulta(reaisCampo(Number(c.multa_atraso_valor)))
        if (Number(c.juro_diario_atraso_valor)) setJuroDia(reaisCampo(Number(c.juro_diario_atraso_valor)))
        setDesde(c.juro_atraso_desde === 'critico' ? 'critico' : 'vencimento')
        setJuroExtrato(!!c.mostrar_juro_no_extrato)
        setTotalExtrato(!!c.mostrar_total_no_extrato)
      }
      setCarregando(false)
    })
  }, [])

  const dias = Number(diasCritico) || 0
  const regra = { multa: multa ? numeroBr(multa) : 0, juroDia: juroDia ? numeroBr(juroDia) : 0, diasCritico: dias, desde }
  const exemploDias = Math.max(dias + 5, 10)
  const exemplo = encargosAtraso(exemploDias, regra)

  async function salvar() {
    setErro(''); setSalvo(false)
    if (!tenant) return setErro('Sua conta ainda não está ligada a uma empresa.')
    if (dias < 2) return setErro('O Crítico precisa começar com pelo menos 2 dias de atraso.')
    setSalvando(true)
    const { error } = await supabase.from('fomentado_configuracoes').upsert({
      tenant_id: tenant,
      juro_padrao_percentual: juroPadrao ? numeroBr(juroPadrao) : null,
      dias_para_critico: dias,
      multa_atraso_valor: regra.multa,
      juro_diario_atraso_valor: regra.juroDia,
      juro_atraso_desde: desde,
      mostrar_juro_no_extrato: juroExtrato,
      mostrar_total_no_extrato: totalExtrato,
    })
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Confira os valores e tente de novo.')
    setSalvo(true)
  }

  if (carregando) return <Tela titulo="Configurações"><div className="mt-4 h-60 animate-pulse rounded-[22px] bg-superficie-2" /></Tela>

  return (
    <Tela titulo="Configurações" subtitulo="Valores que o sistema usa nos seus empréstimos">
      <section className="cartao mt-4 flex flex-col gap-4 rounded-[22px] p-5 lg:p-6">
        <h2 className={tituloSecao}>Empréstimo</h2>
        <div>
          <label className={rotulo} htmlFor="jp">Juro padrão ao mês <span className="font-normal text-suave">(já vem preenchido no empréstimo novo)</span></label>
          <div className="relative">
            <input id="jp" inputMode="decimal" value={juroPadrao} onChange={(e) => setJuroPadrao(mascaraPercentual(e.target.value))} placeholder="10" className={`${campo} pr-10 tabular-nums`} />
            <span className="pointer-events-none absolute top-1/2 right-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">%</span>
          </div>
        </div>
      </section>

      <section className="cartao mt-3 flex flex-col gap-4 rounded-[22px] p-5 lg:p-6">
        <div>
          <h2 className={tituloSecao}>Atraso: multa e juros</h2>
          <p className="mt-1 text-xs text-suave">Deixe em zero pra não cobrar. Na hora do pagamento você sempre pode mudar ou tirar (negociação).</p>
        </div>
        <div>
          <label className={rotulo} htmlFor="dc">Vira Crítico com quantos dias de atraso</label>
          <input id="dc" inputMode="numeric" value={diasCritico} onChange={(e) => setDiasCritico(e.target.value.replace(/\D/g, '').slice(0, 2))} className={`${campo} tabular-nums`} />
          <p className="mt-1 text-xs text-suave">
            {dias >= 2 ? `Vencido de 1 a ${dias - 1} ${dias - 1 === 1 ? 'dia' : 'dias'}; Crítico a partir do ${dias}º dia. Multa e juros começam no Crítico.` : 'Mínimo 2 dias.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="mu">Multa</label>
            <div className="relative">
              <input id="mu" inputMode="numeric" value={multa} onChange={(e) => setMulta(mascaraReais(e.target.value))} placeholder="0,00" className={`${campo} pl-11 tabular-nums`} />
              <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
            </div>
          </div>
          <div>
            <label className={rotulo} htmlFor="jd">Juro por dia</label>
            <div className="relative">
              <input id="jd" inputMode="numeric" value={juroDia} onChange={(e) => setJuroDia(mascaraReais(e.target.value))} placeholder="0,00" className={`${campo} pl-11 tabular-nums`} />
              <span className="pointer-events-none absolute top-1/2 left-4 mt-[3px] -translate-y-1/2 text-sm font-semibold text-suave">R$</span>
            </div>
          </div>
        </div>
        <div>
          <span className={rotulo}>O juro por dia conta</span>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl bg-superficie-2 p-1">
            {([['vencimento', 'Desde o vencimento'], ['critico', 'Só a partir do Crítico']] as [Desde, string][]).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setDesde(v)} aria-pressed={desde === v}
                className={`h-11 rounded-xl text-[13px] font-semibold transition ${desde === v ? 'bg-superficie text-marca' : 'text-suave'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {dias >= 2 && (regra.multa > 0 || regra.juroDia > 0) && (
          <p className="rounded-2xl bg-superficie-2 p-3 text-sm text-suave">
            Exemplo: parcela com <strong className="text-texto">{exemploDias} dias</strong> de atraso paga{' '}
            <strong className="text-texto">{reais(exemplo.multa)}</strong> de multa + <strong className="text-texto">{reais(exemplo.juro)}</strong> de juros
            ({exemplo.dias} {exemplo.dias === 1 ? 'dia' : 'dias'}) = <strong className="text-marca">{reais(exemplo.total)}</strong> a mais.
          </p>
        )}
      </section>

      <section className="cartao mt-3 flex flex-col gap-3 rounded-[22px] p-5 lg:p-6">
        <div>
          <h2 className={tituloSecao}>Extrato que vai pro cliente</h2>
          <p className="mt-1 text-xs text-suave">O extrato interno (só seu) sempre mostra tudo. Aqui você escolhe o que o cliente vê.</p>
        </div>
        {([[juroExtrato, setJuroExtrato, 'Mostrar o % de juro ao mês'], [totalExtrato, setTotalExtrato, 'Mostrar o valor total a pagar']] as [boolean, (v: boolean) => void, string][]).map(([v, set, t]) => (
          <label key={t} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-superficie-2 px-4 py-3 text-sm font-semibold">
            {t}
            <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="size-5 accent-marca" />
          </label>
        ))}
      </section>

      <Link to="/nova-senha" className="cartao mt-3 flex items-center justify-between rounded-[22px] p-5 text-sm font-bold lg:p-6">
        Trocar minha senha
        <span className="text-suave">›</span>
      </Link>

      {erro && <p role="alert" className={`${erroCaixa} mt-4`}>{erro}</p>}
      {salvo && <p className="mt-4 rounded-2xl bg-marca/15 px-4 py-3 text-sm font-semibold text-marca">Salvo. Já vale pros próximos cálculos.</p>}

      <button onClick={salvar} disabled={salvando} className={`${botaoVerde} mt-4 w-full`}>
        <Icone nome="certo" tamanho={18} />
        {salvando ? 'Salvando…' : 'Salvar configurações'}
      </button>

      <ChavesPix tenant={tenant} />
    </Tela>
  )
}
