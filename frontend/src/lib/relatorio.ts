import { supabase } from './supabase'

// Relatório de um mês (regra 5.5 da especificação). Mesmas contas do painel inicial (lib/painel.ts),
// mas para qualquer mês escolhido. A segurança (cada Fomentado só vê o que é dele) é do banco (RLS).

export type LinhaPagamento = {
  id: string
  pago_em: string
  tipo: string
  valor_pago: number
  parte_juro: number
  parte_capital: number
  multa: number
  juro_atraso: number
  contrato: { id: string; numero: number; modalidade: string; cliente: { id: string; numero: number; nome_completo: string } | null } | null
}
export type LinhaContrato = {
  id: string
  numero: number
  modalidade: string
  capital: number
  data_contrato: string
  status: string
  cliente: { id: string; numero: number; nome_completo: string } | null
}

export type Relatorio = {
  mes: string // 2026-10
  capitalTransito: number // hoje, não muda com o mês
  contratosAtivos: number
  jurosRecebidos: number
  capitalRecebido: number
  encargosRecebidos: number // multa + juro de atraso (já dentro de jurosRecebidos)
  totalRecebido: number
  jurosPendentes: number // parcelas do mês ainda em aberto (só o que falta do juro)
  emprestado: number
  contratosNovos: number
  quitados: number
  clientesMes: number
  clientesPagaram: number
  pagamentos: LinhaPagamento[]
  novos: LinhaContrato[]
  quitadosLista: LinhaContrato[]
}

const soma = <T>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0)
export const mesAtual = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)
export const nomeMes = (mes: string) =>
  new Date(mes + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())
export const mesAnterior = (mes: string, n = 1) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 - n, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function carregarRelatorio(mes: string): Promise<Relatorio> {
  const [ano, m] = mes.split('-').map(Number)
  const ini = `${mes}-01`
  const fim = new Date(ano, m, 0).toLocaleDateString('sv-SE')
  const fimTs = `${fim}T23:59:59.999-03:00`

  const [contratos, pagamentos, parcelasMes, quitados] = await Promise.all([
    supabase
      .from('contratos')
      .select('id, numero, modalidade, capital, capital_em_aberto, data_contrato, status, convertido_de, cliente:clientes(id, numero, nome_completo)'),
    supabase
      .from('pagamentos')
      .select('id, pago_em, tipo, valor_pago, parte_juro, parte_capital, multa, juro_atraso, contrato:contratos(id, numero, modalidade, cliente:clientes(id, numero, nome_completo))')
      .is('estornado_em', null)
      .gte('pago_em', ini)
      .lte('pago_em', fim)
      .order('pago_em', { ascending: false }),
    supabase
      .from('parcelas')
      .select('status, parte_juro, contratos!inner(cliente_id, status)')
      .gte('vencimento', ini)
      .lte('vencimento', fim)
      .not('contratos.status', 'in', '(cancelado,convertido)'),
    supabase
      .from('contratos')
      .select('id, numero, modalidade, capital, data_contrato, status, atualizado_em, cliente:clientes(id, numero, nome_completo)')
      .eq('status', 'quitado')
      .gte('atualizado_em', `${ini}T00:00:00-03:00`)
      .lte('atualizado_em', fimTs),
  ])
  const erro = [contratos, pagamentos, parcelasMes, quitados].find((r) => r.error)?.error
  if (erro) throw new Error('Não foi possível carregar o relatório. Confira sua internet e tente de novo.')

  type C = LinhaContrato & { capital_em_aberto: number; convertido_de: string | null }
  const lista = (contratos.data ?? []) as unknown as C[]
  const ativos = lista.filter((c) => c.status === 'ativo')
  // conversão de Recorrente em parcelado não é dinheiro novo
  const novos = lista.filter((c) => c.data_contrato >= ini && c.data_contrato <= fim && c.status !== 'cancelado' && !c.convertido_de)
  const pagos = (pagamentos.data ?? []) as unknown as LinhaPagamento[]

  // Juros que ainda faltam nas parcelas do mês (parcial: o que já entrou está em pagamentos, aqui é aproximado pela parcela em aberto)
  let jurosPendentes = 0
  const porCliente = new Map<string, boolean>()
  for (const p of (parcelasMes.data ?? []) as unknown as { status: string; parte_juro: number; contratos: { cliente_id: string } }[]) {
    if (p.status !== 'paga') jurosPendentes += Number(p.parte_juro)
    const id = p.contratos.cliente_id
    porCliente.set(id, (porCliente.get(id) ?? true) && p.status === 'paga')
  }

  const encargos = soma(pagos, (p) => Number(p.multa) + Number(p.juro_atraso))
  const jurosRecebidos = soma(pagos, (p) => Number(p.parte_juro)) + encargos
  const capitalRecebido = soma(pagos, (p) => Number(p.parte_capital))
  return {
    mes,
    capitalTransito: soma(ativos, (c) => Number(c.capital_em_aberto)),
    contratosAtivos: ativos.length,
    jurosRecebidos,
    capitalRecebido,
    encargosRecebidos: encargos,
    totalRecebido: jurosRecebidos + capitalRecebido,
    jurosPendentes,
    emprestado: soma(novos, (c) => Number(c.capital)),
    contratosNovos: novos.length,
    quitados: (quitados.data ?? []).length,
    clientesMes: porCliente.size,
    clientesPagaram: [...porCliente.values()].filter(Boolean).length,
    pagamentos: pagos,
    novos: [...novos].sort((a, b) => b.data_contrato.localeCompare(a.data_contrato)),
    quitadosLista: (quitados.data ?? []) as unknown as LinhaContrato[],
  }
}
