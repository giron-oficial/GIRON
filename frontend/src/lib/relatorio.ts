import { supabase } from './supabase'

// Relatório por período (regra 5.5 da especificação): dia, semana, mês, ano ou datas escolhidas.
// Busca tudo de uma vez (período, período anterior, semana e ano da data escolhida) e faz as contas aqui,
// assim o resumo Dia/Semana/Mês/Ano, o gráfico e a comparação saem da mesma busca.
// A segurança (cada Fomentado só vê o que é dele) é do banco (RLS).

export type Modo = 'dia' | 'semana' | 'mes' | 'ano' | 'periodo'
export type Intervalo = { ini: string; fim: string } // datas 2026-10-26, as duas inclusas

type Cliente = { id: string; numero: number; nome_completo: string } | null
export type LinhaPagamento = {
  id: string
  pago_em: string
  tipo: string
  valor_pago: number
  parte_juro: number
  parte_capital: number
  multa: number
  juro_atraso: number
  estornado_em: string | null
  motivo_estorno: string | null
  contrato: { id: string; numero: number; modalidade: string; cliente: Cliente } | null
}
export type LinhaContrato = {
  id: string
  numero: number
  modalidade: string
  capital: number
  capital_em_aberto: number
  data_contrato: string
  status: string
  convertido_de: string | null
  atualizado_em: string
  cliente: Cliente
}

export type Base = {
  pagamentos: LinhaPagamento[] // inclui estornados (aparecem na lista, não entram nas contas)
  contratos: LinhaContrato[]
  parcelas: { status: string; parte_juro: number; cliente_id: string }[] // vencem no período escolhido
}

export type Totais = {
  juros: number // inclui multa e juro de atraso
  encargos: number
  capital: number
  entrou: number
  emprestado: number
  pagamentos: number
  novos: number
  quitados: number
}

// ---------- datas (texto 2026-10-26; meio-dia evita erro de fuso) ----------
const dt = (s: string) => new Date(s + 'T12:00:00')
const iso = (d: Date) => d.toLocaleDateString('sv-SE')
export const hoje = () => iso(new Date())
export const somaDias = (s: string, n: number) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d) }
const inicioSemana = (s: string) => somaDias(s, -((dt(s).getDay() + 6) % 7)) // segunda-feira
const fimMes = (s: string) => { const d = dt(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) }
const diasEntre = (a: string, b: string) => Math.round((dt(b).getTime() - dt(a).getTime()) / 86400000)
const diaBrasilia = (ts: string) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const dentro = (s: string, i: Intervalo) => s >= i.ini && s <= i.fim

export function intervaloDe(modo: Modo, ref: string, de?: string): Intervalo {
  if (modo === 'dia') return { ini: ref, fim: ref }
  if (modo === 'semana') { const ini = inicioSemana(ref); return { ini, fim: somaDias(ini, 6) } }
  if (modo === 'mes') return { ini: ref.slice(0, 8) + '01', fim: fimMes(ref) }
  if (modo === 'ano') return { ini: ref.slice(0, 4) + '-01-01', fim: ref.slice(0, 4) + '-12-31' }
  return de && de <= ref ? { ini: de, fim: ref } : { ini: ref, fim: ref }
}

// Período de mesmo tamanho logo antes (pra comparar: "↑ 12% que a semana passada")
export function anteriorDe(modo: Modo, i: Intervalo): Intervalo {
  if (modo === 'mes') return intervaloDe('mes', somaDias(i.ini, -1))
  if (modo === 'ano') return intervaloDe('ano', somaDias(i.ini, -1))
  const n = diasEntre(i.ini, i.fim) + 1
  return { ini: somaDias(i.ini, -n), fim: somaDias(i.ini, -1) }
}

// Anda pra trás (n = -1) ou pra frente (n = 1) mantendo o dia; nunca passa de hoje
export function andar(modo: Modo, ref: string, n: number): string {
  let novo = ref
  if (modo === 'dia') novo = somaDias(ref, n)
  else if (modo === 'semana') novo = somaDias(ref, 7 * n)
  else if (modo === 'mes' || modo === 'ano') {
    const d = dt(ref)
    const alvo = new Date(d.getFullYear() + (modo === 'ano' ? n : 0), d.getMonth() + (modo === 'mes' ? n : 0), 1, 12)
    const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()
    alvo.setDate(Math.min(d.getDate(), ultimo))
    novo = iso(alvo)
  }
  return novo > hoje() ? hoje() : novo
}

const cap = (t: string) => t.replace(/^./, (c) => c.toUpperCase())
export const dataCurta = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
export const dataLonga = (s: string) => `${dataCurta(s)}/${s.slice(0, 4)}`
export const nomeDia = (s: string) => cap(dt(s).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))
export const nomeMes = (s: string) => cap(dt(s.slice(0, 7) + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

export function tituloDe(modo: Modo, i: Intervalo): string {
  if (modo === 'dia') return cap(dt(i.ini).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  if (modo === 'mes') return nomeMes(i.ini)
  if (modo === 'ano') return i.ini.slice(0, 4)
  return `${dataCurta(i.ini)} a ${dataLonga(i.fim)}`
}

export const nomeAnterior: Record<Modo, string> = {
  dia: 'que ontem', semana: 'que a semana passada', mes: 'que o mês passado', ano: 'que o ano passado', periodo: 'que o período anterior',
}

// ---------- busca ----------
// O banco entrega no máximo 1000 linhas por vez: busca de 1000 em 1000 até acabar
async function todas<T>(busca: (de: number, ate: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const linhas: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await busca(de, de + 999)
    if (error) throw error
    const pagina = (data ?? []) as T[]
    linhas.push(...pagina)
    if (pagina.length < 1000) return linhas
  }
}

// busca = datas que precisam de pagamentos; periodo = parcelas que vencem nele
export async function carregarBase(busca: Intervalo, periodo: Intervalo): Promise<Base> {
  try {
    const [contratos, pagamentos, parcelas] = await Promise.all([
      todas<LinhaContrato>((de, ate) =>
        supabase
          .from('contratos')
          .select('id, numero, modalidade, capital, capital_em_aberto, data_contrato, status, convertido_de, atualizado_em, cliente:clientes(id, numero, nome_completo)')
          .order('id')
          .range(de, ate),
      ),
      todas<LinhaPagamento>((de, ate) =>
        supabase
          .from('pagamentos')
          .select('id, pago_em, tipo, valor_pago, parte_juro, parte_capital, multa, juro_atraso, estornado_em, motivo_estorno, contrato:contratos(id, numero, modalidade, cliente:clientes(id, numero, nome_completo))')
          .gte('pago_em', busca.ini)
          .lte('pago_em', busca.fim)
          .order('pago_em', { ascending: false })
          .order('criado_em', { ascending: false })
          .range(de, ate),
      ),
      todas<{ status: string; parte_juro: number; contratos: { cliente_id: string } }>((de, ate) =>
        supabase
          .from('parcelas')
          .select('status, parte_juro, contratos!inner(cliente_id, status)')
          .gte('vencimento', periodo.ini)
          .lte('vencimento', periodo.fim)
          .not('contratos.status', 'in', '(cancelado,convertido)')
          .order('id')
          .range(de, ate),
      ),
    ])
    return {
      contratos,
      pagamentos,
      parcelas: parcelas.map((p) => ({ status: p.status, parte_juro: Number(p.parte_juro), cliente_id: p.contratos.cliente_id })),
    }
  } catch {
    throw new Error('Não foi possível carregar o relatório. Confira sua internet e tente de novo.')
  }
}

// ---------- contas ----------
const soma = <T>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0)
// conversão de Recorrente em parcelado não é dinheiro novo; cancelado não conta
const ehNovo = (c: LinhaContrato) => c.status !== 'cancelado' && !c.convertido_de
export const diaQuitado = (c: LinhaContrato) => diaBrasilia(c.atualizado_em)

export function totais(b: Base, i: Intervalo): Totais {
  const pagos = b.pagamentos.filter((p) => !p.estornado_em && dentro(p.pago_em, i))
  const novos = b.contratos.filter((c) => ehNovo(c) && dentro(c.data_contrato, i))
  const encargos = soma(pagos, (p) => Number(p.multa) + Number(p.juro_atraso))
  const juros = soma(pagos, (p) => Number(p.parte_juro)) + encargos
  const capital = soma(pagos, (p) => Number(p.parte_capital))
  return {
    juros,
    encargos,
    capital,
    entrou: juros + capital,
    emprestado: soma(novos, (c) => Number(c.capital)),
    pagamentos: pagos.length,
    novos: novos.length,
    quitados: b.contratos.filter((c) => c.status === 'quitado' && dentro(diaQuitado(c), i)).length,
  }
}

export function naRua(b: Base) {
  const ativos = b.contratos.filter((c) => c.status === 'ativo')
  return { capital: soma(ativos, (c) => Number(c.capital_em_aberto)), contratos: ativos.length }
}

// Parcelas que vencem no período: juros que ainda faltam e quantos clientes já pagaram tudo
export function parcelasDoPeriodo(b: Base) {
  let jurosPendentes = 0
  const porCliente = new Map<string, boolean>()
  for (const p of b.parcelas) {
    if (p.status !== 'paga') jurosPendentes += p.parte_juro
    porCliente.set(p.cliente_id, (porCliente.get(p.cliente_id) ?? true) && p.status === 'paga')
  }
  return { jurosPendentes, clientes: porCliente.size, pagaram: [...porCliente.values()].filter(Boolean).length }
}

// ---------- gráfico de progressão ----------
export type Barra = Intervalo & { rotulo: string; dica: string; destaque: boolean; juros: number; capital: number; emprestado: number }

export function serie(b: Base, modo: Modo, i: Intervalo): Barra[] {
  const porDia = (ini: string, fim: string, destaque?: string) => {
    const xs: Barra[] = []
    for (let d = ini; d <= fim; d = somaDias(d, 1)) {
      const t = totais(b, { ini: d, fim: d })
      const rotulo = modo === 'mes' || diasEntre(ini, fim) > 13 ? String(Number(d.slice(8))) : `${nomeDia(d)} ${d.slice(8)}`
      xs.push({ ini: d, fim: d, rotulo, dica: `${nomeDia(d)}, ${dataLonga(d)}`, destaque: d === destaque, juros: t.juros, capital: t.capital, emprestado: t.emprestado })
    }
    return xs
  }
  if (modo === 'dia') return porDia(somaDias(i.ini, -6), i.ini, i.ini)
  if (modo === 'semana' || modo === 'mes') return porDia(i.ini, i.fim)
  if (modo === 'periodo' && diasEntre(i.ini, i.fim) <= 62) return porDia(i.ini, i.fim)
  // ano (ou período longo): um ponto por mês
  const xs: Barra[] = []
  for (let m = i.ini.slice(0, 8) + '01'; m <= i.fim; m = somaDias(fimMes(m), 1)) {
    const faixa = { ini: m < i.ini ? i.ini : m, fim: fimMes(m) > i.fim ? i.fim : fimMes(m) }
    const t = totais(b, faixa)
    const curto = dt(m).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    xs.push({ ...faixa, rotulo: modo === 'ano' ? curto : `${curto}/${m.slice(2, 4)}`, dica: nomeMes(m), destaque: false, juros: t.juros, capital: t.capital, emprestado: t.emprestado })
  }
  return xs
}

// ---------- lista de movimentações ----------
export type Movimento =
  | { tipo: 'entrada' | 'estorno'; dia: string; id: string; p: LinhaPagamento }
  | { tipo: 'emprestimo' | 'quitado'; dia: string; id: string; c: LinhaContrato }

export function movimentos(b: Base, i: Intervalo): Movimento[] {
  const xs: Movimento[] = []
  for (const p of b.pagamentos) if (dentro(p.pago_em, i)) xs.push({ tipo: p.estornado_em ? 'estorno' : 'entrada', dia: p.pago_em, id: 'p' + p.id, p })
  for (const c of b.contratos) {
    if (ehNovo(c) && dentro(c.data_contrato, i)) xs.push({ tipo: 'emprestimo', dia: c.data_contrato, id: 'e' + c.id, c })
    if (c.status === 'quitado' && dentro(diaQuitado(c), i)) xs.push({ tipo: 'quitado', dia: diaQuitado(c), id: 'q' + c.id, c })
  }
  return xs.sort((a, z) => z.dia.localeCompare(a.dia))
}
