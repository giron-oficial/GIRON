import { supabase } from './supabase'
import { urlLogo } from './marca'

// Painel do Dono: o dono do GIRON acompanha as financeiras que assinam o sistema
// (mensalidades, implantação, teste grátis, bloqueio). Nunca vê os clientes delas, só números.

export type Cobranca = {
  id: string
  tenantId: string
  tipo: 'mensalidade' | 'implantacao'
  vencimento: string
  valor: number
  pagoEm: string | null
  parcela: number | null
  parcelasTotal: number | null
}

export type SituacaoFinanceira = 'teste' | 'em_dia' | 'vence_hoje' | 'atrasada' | 'parcial' | 'bloqueada' | 'sem_cobranca'

export type Financeira = {
  id: string
  nome: string
  subdominio: string
  logo: string | null
  criadoEm: string
  statusAcesso: string
  bloqueioManual: boolean
  testeGratisAte: string | null
  testeFaltam: number
  liberadoManualAte: string | null
  mensalidade: number
  responsavel: string
  telefone: string
  observacao: string
  robo: boolean
  whatsapp: boolean
  situacao: SituacaoFinanceira
  cobrancas: Cobranca[]
  proxima: Cobranca | null
  atrasado: number
  diasAtraso: number
  implantacao: { pagas: number; total: number; valorPago: number; valorTotal: number } | null
  clientes: number
  contratosAtivos: number
  ultimoAcesso: string | null
}

export type Alerta = { financeira: Financeira; texto: string; cor: 'vencido' | 'amanha' | 'hoje' | 'critico' | 'suave' }

export type Mes = { rotulo: string; mensalidade: number; implantacao: number; atual: boolean }

export type PainelDono = {
  financeiras: Financeira[]
  recebidoMes: number
  aReceberMes: number
  atrasado: number
  mensalFixo: number
  meses: Mes[]
  alertas: Alerta[]
  contagem: Record<SituacaoFinanceira, number>
}

// data local -> 2026-10-01
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dias = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)

export const nomeSituacao: Record<SituacaoFinanceira, { texto: string; classe: string; bolinha: string }> = {
  em_dia: { texto: 'Em dia', classe: 'bg-sucesso/15 text-sucesso', bolinha: 'bg-sucesso' },
  teste: { texto: 'Em teste', classe: 'bg-marca/15 text-marca-brilho', bolinha: 'bg-marca-brilho' },
  vence_hoje: { texto: 'Vence hoje', classe: 'bg-hoje/15 text-hoje', bolinha: 'bg-hoje anima-pulso' },
  atrasada: { texto: 'Atrasada', classe: 'bg-amanha/15 text-amanha', bolinha: 'bg-amanha' },
  parcial: { texto: 'Bloqueio parcial', classe: 'bg-vencido/15 text-vencido', bolinha: 'bg-vencido' },
  bloqueada: { texto: 'Bloqueada', classe: 'bg-vencido/15 text-vencido', bolinha: 'bg-vencido' },
  sem_cobranca: { texto: 'Sem cobrança', classe: 'bg-superficie-2 text-suave', bolinha: 'bg-suave' },
}

function situacao(f: { statusAcesso: string; testeGratisAte: string | null; cobrancas: Cobranca[]; diasAtraso: number; proxima: Cobranca | null }, hoje: string): SituacaoFinanceira {
  if (f.statusAcesso === 'bloqueio_total') return 'bloqueada'
  if (f.statusAcesso === 'bloqueio_parcial') return 'parcial'
  if (f.testeGratisAte) return 'teste'
  if (f.diasAtraso > 0) return 'atrasada'
  if (f.proxima?.vencimento === hoje) return 'vence_hoje'
  return f.cobrancas.length ? 'em_dia' : 'sem_cobranca'
}

export async function carregarPainelDono(): Promise<PainelDono> {
  const [fom, ass, rec, uso] = await Promise.all([
    supabase
      .from('fomentados')
      .select('id, nome_empresa, subdominio, logo_arquivo, criado_em, status_acesso, bloqueio_manual, teste_gratis_ate, liberado_manual_ate, mensalidade_valor, responsavel_nome, telefone, observacao_dono')
      .order('nome_empresa'),
    supabase.from('assinaturas').select('id, tenant_id, tipo, vencimento, valor, pago_em, parcela, parcelas_total').order('vencimento'),
    supabase.from('recursos_extras').select('tenant_id, recurso, liberado'),
    supabase.rpc('dono_uso'),
  ])
  const erro = fom.error ?? ass.error ?? rec.error ?? uso.error
  if (erro) throw erro

  const hoje = iso(new Date())
  const mesAtual = hoje.slice(0, 7)
  const cobrancas: Cobranca[] = (ass.data ?? []).map((a) => ({
    id: a.id,
    tenantId: a.tenant_id,
    tipo: a.tipo,
    vencimento: a.vencimento,
    valor: Number(a.valor),
    pagoEm: a.pago_em,
    parcela: a.parcela,
    parcelasTotal: a.parcelas_total,
  }))
  const ligado = (recurso: string) => new Map((rec.data ?? []).filter((r) => r.recurso === recurso).map((r) => [r.tenant_id, r.liberado as boolean]))
  const robo = ligado('agente_telegram')
  const whatsapp = ligado('whatsapp_automatico')
  const usoPor = new Map(
    ((uso.data ?? []) as { tenant_id: string; clientes: number; contratos_ativos: number; ultimo_acesso: string | null }[]).map((u) => [u.tenant_id, u]),
  )

  const financeiras: Financeira[] = (fom.data ?? []).map((f) => {
    const minhas = cobrancas.filter((c) => c.tenantId === f.id)
    const abertas = minhas.filter((c) => !c.pagoEm)
    const vencidas = abertas.filter((c) => c.vencimento < hoje)
    const impl = minhas.filter((c) => c.tipo === 'implantacao')
    const u = usoPor.get(f.id)
    const base = {
      statusAcesso: f.status_acesso,
      testeGratisAte: f.teste_gratis_ate,
      cobrancas: minhas,
      diasAtraso: vencidas.length ? dias(vencidas[0].vencimento, hoje) : 0,
      proxima: abertas[0] ?? null,
    }
    return {
      ...base,
      id: f.id,
      nome: f.nome_empresa,
      subdominio: f.subdominio,
      logo: urlLogo(f.logo_arquivo),
      criadoEm: f.criado_em,
      bloqueioManual: f.bloqueio_manual,
      testeFaltam: f.teste_gratis_ate ? Math.max(0, dias(hoje, f.teste_gratis_ate)) : 0,
      liberadoManualAte: f.liberado_manual_ate && f.liberado_manual_ate >= hoje ? f.liberado_manual_ate : null,
      mensalidade: Number(f.mensalidade_valor),
      responsavel: f.responsavel_nome ?? '',
      telefone: f.telefone ?? '',
      observacao: f.observacao_dono ?? '',
      robo: robo.get(f.id) ?? false,
      whatsapp: whatsapp.get(f.id) ?? false,
      situacao: situacao(base, hoje),
      atrasado: vencidas.reduce((s, c) => s + c.valor, 0),
      implantacao: impl.length
        ? {
            pagas: impl.filter((c) => c.pagoEm).length,
            total: impl.length,
            valorPago: impl.filter((c) => c.pagoEm).reduce((s, c) => s + c.valor, 0),
            valorTotal: impl.reduce((s, c) => s + c.valor, 0),
          }
        : null,
      clientes: Number(u?.clientes ?? 0),
      contratosAtivos: Number(u?.contratos_ativos ?? 0),
      ultimoAcesso: u?.ultimo_acesso ?? null,
    }
  })

  // Últimos 6 meses do que entrou (pela data em que foi pago)
  const meses: Mes[] = []
  const agora = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const chave = iso(d).slice(0, 7)
    const doMes = cobrancas.filter((c) => c.pagoEm?.startsWith(chave))
    meses.push({
      rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      mensalidade: doMes.filter((c) => c.tipo === 'mensalidade').reduce((s, c) => s + c.valor, 0),
      implantacao: doMes.filter((c) => c.tipo === 'implantacao').reduce((s, c) => s + c.valor, 0),
      atual: i === 0,
    })
  }

  // O que precisa da atenção do dono hoje, do mais urgente pro menos
  const alertas: Alerta[] = []
  for (const f of financeiras) {
    if (f.situacao === 'bloqueada') alertas.push({ financeira: f, cor: 'vencido', texto: f.cobrancas.length && !f.testeGratisAte ? `Bloqueada: ${f.diasAtraso} dias de atraso` : 'Teste acabou e não pagou: bloqueada' })
    else if (f.situacao === 'parcial') alertas.push({ financeira: f, cor: 'vencido', texto: `Bloqueio parcial: ${f.diasAtraso} dias de atraso` })
    else if (f.situacao === 'atrasada') alertas.push({ financeira: f, cor: 'amanha', texto: `Atrasada ${f.diasAtraso === 1 ? '1 dia' : `${f.diasAtraso} dias`}: bloqueia com 3 dias` })
    else if (f.situacao === 'vence_hoje') alertas.push({ financeira: f, cor: 'hoje', texto: `Vence hoje: ${f.proxima ? f.proxima.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}` })
    else if (f.situacao === 'teste' && f.testeFaltam <= 3)
      alertas.push({ financeira: f, cor: 'critico', texto: f.testeFaltam === 0 ? 'Teste termina hoje: hora de fechar a venda' : `Teste termina em ${f.testeFaltam} ${f.testeFaltam === 1 ? 'dia' : 'dias'}: hora de fechar a venda` })
    else if (f.situacao === 'sem_cobranca') alertas.push({ financeira: f, cor: 'suave', texto: 'Ainda sem cobrança: toque pra começar a cobrar' })
    if (f.situacao !== 'bloqueada' && f.ultimoAcesso && dias(f.ultimoAcesso.slice(0, 10), hoje) >= 7)
      alertas.push({ financeira: f, cor: 'suave', texto: `Não entra no sistema há ${dias(f.ultimoAcesso.slice(0, 10), hoje)} dias: risco de cancelar` })
  }

  const contagem = Object.fromEntries(Object.keys(nomeSituacao).map((k) => [k, 0])) as Record<SituacaoFinanceira, number>
  for (const f of financeiras) contagem[f.situacao]++

  return {
    financeiras,
    recebidoMes: cobrancas.filter((c) => c.pagoEm?.startsWith(mesAtual)).reduce((s, c) => s + c.valor, 0),
    aReceberMes: cobrancas.filter((c) => !c.pagoEm && c.vencimento >= hoje && c.vencimento.startsWith(mesAtual)).reduce((s, c) => s + c.valor, 0),
    atrasado: financeiras.reduce((s, f) => s + f.atrasado, 0),
    mensalFixo: financeiras
      .filter((f) => f.cobrancas.some((c) => c.tipo === 'mensalidade') && f.statusAcesso !== 'bloqueio_total')
      .reduce((s, f) => s + f.mensalidade, 0),
    meses,
    alertas,
    contagem,
  }
}

// Ações do dono (todas conferidas no banco: só o dono do GIRON consegue)
export const donoAcoes = {
  comecarCobranca: (p: { tenant: string; mensalidade: number; primeiroVencimento: string; implantacao: number; parcelas: number; implantacaoVencimento: string; comRobo: boolean }) =>
    supabase.rpc('dono_comecar_cobranca', {
      p_tenant: p.tenant,
      p_mensalidade: p.mensalidade,
      p_primeiro_vencimento: p.primeiroVencimento,
      p_implantacao: p.implantacao,
      p_parcelas: p.parcelas,
      p_implantacao_vencimento: p.implantacaoVencimento,
      p_com_robo: p.comRobo,
    }),
  receber: (id: string, pagoEm: string) => supabase.rpc('dono_receber', { p_assinatura: id, p_pago_em: pagoEm }),
  desfazer: (id: string) => supabase.rpc('dono_desfazer_recebimento', { p_assinatura: id }),
  estenderTeste: (tenant: string, diasMais: number) => supabase.rpc('dono_estender_teste', { p_tenant: tenant, p_dias: diasMais }),
  liberarAte: (tenant: string, ate: string | null) => supabase.rpc('dono_liberar_ate', { p_tenant: tenant, p_ate: ate }),
  robo: (tenant: string, ligado: boolean) => supabase.rpc('dono_robo', { p_tenant: tenant, p_ligado: ligado }),
  whatsapp: (tenant: string, ligado: boolean) => supabase.rpc('dono_whatsapp', { p_tenant: tenant, p_ligado: ligado }),
  travar: (tenant: string, travado: boolean) => supabase.from('fomentados').update({ bloqueio_manual: travado }).eq('id', tenant),
  contato: (tenant: string, c: { responsavel: string; telefone: string; observacao: string; mensalidade: number }) =>
    supabase
      .from('fomentados')
      .update({ responsavel_nome: c.responsavel || null, telefone: c.telefone || null, observacao_dono: c.observacao || null, mensalidade_valor: c.mensalidade })
      .eq('id', tenant),
}
