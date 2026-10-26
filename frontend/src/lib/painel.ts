import { encargosAtraso, regraDaConfig } from './atraso'
import { supabase } from './supabase'

// Situação de uma parcela pendente (cores das bolinhas de vencimento)
export type Situacao = 'critico' | 'vencido' | 'hoje' | 'amanha'

export type Cobranca = {
  parcelaId: string
  contratoId: string
  clienteId: string
  cliente: string
  telefone: string
  modalidade: string
  vencimento: string
  valor: number // valor cheio: o que falta da parcela + multa e juro de atraso
  encargos: number // só a multa + juro de atraso (0 antes do Crítico)
  atraso: number
  situacao: Situacao
}

export type Empresa = { nome_empresa: string; status_acesso: string; teste_gratis_ate: string | null }

export type Painel = {
  empresa: Empresa | null
  capitalTransito: number
  contratosAtivos: number
  jurosRecebidos: number
  jurosPendentes: number
  capitalRecebido: number
  emprestado: number
  contratosNovos: number
  clientesMes: number
  clientesPagaram: number
  cobrancas: Cobranca[]
  chavePix: string | null
  historicoCapital: PontoCapital[] // capital na rua no fim de cada um dos últimos 5 meses + hoje
}

export type PontoCapital = { data: string; rotulo: string; valor: number }

type LinhaPendente = {
  id: string
  vencimento: string
  valor: number
  parte_juro: number
  status: string
  contratos: { id: string; cliente_id: string; modalidade: string; clientes: { nome_completo: string; telefone: string } | null }
}

const ordem: Record<Situacao, number> = { critico: 0, vencido: 1, hoje: 2, amanha: 3 }

// data local -> 2026-10-01
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate + 'T12:00:00') - Date.parse(de + 'T12:00:00')) / 86400000)
const soma = <T>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0)

// Junta tudo que o painel inicial mostra. A segurança (cada Fomentado só vê o que é dele) é feita pelo banco (RLS).
export async function carregarPainel(): Promise<Painel> {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = agora.getMonth()
  const hoje = iso(agora)
  const amanha = iso(new Date(ano, mes, agora.getDate() + 1))
  const inicioMes = iso(new Date(ano, mes, 1))
  const fimMes = iso(new Date(ano, mes + 1, 0))
  const limite = amanha > fimMes ? amanha : fimMes

  const inicioHistorico = iso(new Date(ano, mes - 5, 1))

  const [empresa, config, contratos, pagamentos, pendentes, parcelasMes, pix, capitalVolta] = await Promise.all([
    supabase.from('fomentados').select('nome_empresa, status_acesso, teste_gratis_ate').maybeSingle(),
    supabase.from('fomentado_configuracoes').select('dias_para_critico, multa_atraso_valor, juro_diario_atraso_valor, juro_atraso_desde').maybeSingle(),
    supabase.from('contratos').select('capital, capital_em_aberto, data_contrato, status, convertido_de'),
    supabase.from('pagamentos').select('parte_juro, parte_capital, multa, juro_atraso').is('estornado_em', null).gte('pago_em', inicioMes).lte('pago_em', fimMes),
    supabase
      .from('parcelas')
      .select('id, vencimento, valor, parte_juro, status, contratos!inner(id, cliente_id, modalidade, status, clientes(nome_completo, telefone))')
      .neq('status', 'paga')
      .lte('vencimento', limite)
      .eq('contratos.status', 'ativo'),
    supabase
      .from('parcelas')
      .select('status, contratos!inner(cliente_id, status)')
      .gte('vencimento', inicioMes)
      .lte('vencimento', fimMes)
      .not('contratos.status', 'in', '(cancelado,convertido)'),
    supabase.from('chaves_pix').select('chave').eq('padrao', true).maybeSingle(),
    supabase.from('pagamentos').select('pago_em, parte_capital').is('estornado_em', null).gt('parte_capital', 0).gte('pago_em', inicioHistorico).range(0, 9999),
  ])
  const erro = [empresa, config, contratos, pagamentos, pendentes, parcelasMes, capitalVolta].find((r) => r.error)?.error
  if (erro) throw new Error('Não foi possível carregar o painel. Confira sua internet e tente de novo.')

  const listaContratos = (contratos.data ?? []) as { capital: number; capital_em_aberto: number; data_contrato: string; status: string; convertido_de: string | null }[]
  const ativos = listaContratos.filter((c) => c.status === 'ativo')
  const novos = listaContratos.filter((c) => c.data_contrato >= inicioMes && c.data_contrato <= fimMes && c.status !== 'cancelado' && !c.convertido_de) // conversão não é dinheiro novo
  const pagos = (pagamentos.data ?? []) as { parte_juro: number; parte_capital: number; multa: number; juro_atraso: number }[]
  const linhas = (pendentes.data ?? []) as unknown as LinhaPendente[]

  // Parcelas com pagamento parcial: desconta o que já entrou
  const parciais = linhas.filter((l) => l.status === 'parcial').map((l) => l.id)
  const jaPago = new Map<string, { juro: number; total: number; multa: number; juroAtraso: number }>()
  if (parciais.length) {
    const { data } = await supabase.from('pagamentos').select('parcela_id, parte_juro, parte_capital, multa, juro_atraso').in('parcela_id', parciais).is('estornado_em', null)
    for (const p of (data ?? []) as { parcela_id: string; parte_juro: number; parte_capital: number; multa: number; juro_atraso: number }[]) {
      const atual = jaPago.get(p.parcela_id) ?? { juro: 0, total: 0, multa: 0, juroAtraso: 0 }
      atual.juro += Number(p.parte_juro)
      atual.total += Number(p.parte_juro) + Number(p.parte_capital)
      atual.multa += Number(p.multa)
      atual.juroAtraso += Number(p.juro_atraso)
      jaPago.set(p.parcela_id, atual)
    }
  }

  const regra = regraDaConfig(config.data)
  const dias = regra.diasCritico
  const cobrancas: Cobranca[] = []
  let jurosPendentes = 0
  for (const l of linhas) {
    const pago = jaPago.get(l.id) ?? { juro: 0, total: 0, multa: 0, juroAtraso: 0 }
    if (l.vencimento >= inicioMes && l.vencimento <= fimMes) jurosPendentes += Math.max(0, Number(l.parte_juro) - pago.juro)
    const atraso = diasEntre(l.vencimento, hoje)
    if (atraso < -1) continue
    const situacao: Situacao = atraso >= dias ? 'critico' : atraso >= 1 ? 'vencido' : atraso === 0 ? 'hoje' : 'amanha'
    const encargos = encargosAtraso(atraso, regra, pago.multa, pago.juroAtraso).total
    cobrancas.push({
      parcelaId: l.id,
      contratoId: l.contratos.id,
      clienteId: l.contratos.cliente_id,
      cliente: l.contratos.clientes?.nome_completo ?? 'Cliente',
      telefone: l.contratos.clientes?.telefone ?? '',
      modalidade: l.contratos.modalidade,
      vencimento: l.vencimento,
      valor: Math.max(0, Number(l.valor) - pago.total) + encargos,
      encargos,
      atraso,
      situacao,
    })
  }
  cobrancas.sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || b.atraso - a.atraso)

  // Clientes com parcela no mês: quem já quitou tudo do mês conta como "pagou"
  const porCliente = new Map<string, boolean>()
  for (const p of (parcelasMes.data ?? []) as unknown as { status: string; contratos: { cliente_id: string } }[]) {
    const id = p.contratos.cliente_id
    porCliente.set(id, (porCliente.get(id) ?? true) && p.status === 'paga')
  }

  // Capital na rua no passado: parte do valor de hoje e volta no tempo
  // (tira o que foi emprestado depois da data e devolve o capital que os clientes pagaram depois dela)
  const capitalHoje = soma(ativos, (c) => Number(c.capital_em_aberto))
  const emprestimos = listaContratos.filter((c) => c.status !== 'cancelado' && !c.convertido_de)
  const devolvido = (capitalVolta.data ?? []) as { pago_em: string; parte_capital: number }[]
  const historicoCapital: PontoCapital[] = [4, 3, 2, 1, 0].map((n) => {
    const data = iso(new Date(ano, mes - n, 0)) // último dia do mês
    const depois = soma(emprestimos.filter((c) => c.data_contrato > data), (c) => Number(c.capital))
    const voltou = soma(devolvido.filter((p) => p.pago_em > data), (p) => Number(p.parte_capital))
    const rotulo = new Date(ano, mes - n - 1, 15).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    return { data, rotulo, valor: Math.max(0, capitalHoje - depois + voltou) }
  })
  historicoCapital.push({ data: hoje, rotulo: 'hoje', valor: capitalHoje })

  return {
    empresa: empresa.data as Empresa | null,
    capitalTransito: capitalHoje,
    contratosAtivos: ativos.length,
    // multa e juro de atraso também são ganho de juro
    jurosRecebidos: soma(pagos, (p) => Number(p.parte_juro) + Number(p.multa) + Number(p.juro_atraso)),
    jurosPendentes,
    capitalRecebido: soma(pagos, (p) => Number(p.parte_capital)),
    emprestado: soma(novos, (c) => Number(c.capital)),
    contratosNovos: novos.length,
    clientesMes: porCliente.size,
    clientesPagaram: [...porCliente.values()].filter(Boolean).length,
    cobrancas,
    chavePix: (pix.data as { chave: string } | null)?.chave ?? null,
    historicoCapital,
  }
}
