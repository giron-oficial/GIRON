export const soDigitos = (t: string) => t.replace(/\D/g, '')

export function cpfValido(cpf: string): boolean {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

// 12345678909 -> 123.456.789-09 (enquanto digita)
export function mascaraCpf(t: string): string {
  const d = soDigitos(t).slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// so os 4 ultimos digitos: 8909 -> ***.***.*89-09 (cliente sem CPF -> 'SEM CPF')
export const cpfEscondido = (final4: string | null) =>
  final4 ? `***.***.*${final4.slice(0, 2)}-${final4.slice(2)}` : 'SEM CPF'

// 63999990000 -> (63) 99999-0000
export function mascaraTelefone(t: string): string {
  const d = soDigitos(t).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Link do WhatsApp (Brasil): acrescenta 55 se nao tiver
export function linkWhatsApp(telefone: string, texto?: string): string {
  let d = soDigitos(telefone)
  if (!d.startsWith('55')) d = '55' + d
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

// 1234.5 -> R$ 1.234,50
export const reais = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// "1.234,56" ou "1234.56" -> 1234.56
export function numeroBr(t: string): number {
  const limpo = t.replace(/[^\d,.-]/g, '')
  if (limpo.includes(',')) return Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number(limpo)
}

// 1500 -> "1.500,00" (sem o R$, pra campos de digitar)
export const reaisCampo = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Campo de dinheiro enquanto digita: "150000" -> "1.500,00" (os números entram pela direita, como na maquininha)
export function mascaraReais(t: string): string {
  const d = soDigitos(t).replace(/^0+/, '').slice(0, 13)
  return d ? reaisCampo(Number(d) / 100) : ''
}

// Campo de porcentagem enquanto digita: só números e uma vírgula ("5.5" vira "5,5")
export function mascaraPercentual(t: string): string {
  const s = t.replace(/\./g, ',').replace(/[^\d,]/g, '')
  const i = s.indexOf(',')
  return i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '')
}

// 5.676594878984537 -> "5,676594878984537" (porcentagem completa, sem arredondar)
export const percentualCompleto = (v: number) => (Number.isFinite(v) ? String(v).replace('.', ',') : '')

// data ISO (2026-10-01) -> 01/10/2026
export const dataBr = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')

export const nomeModalidade: Record<string, string> = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal', recorrente: 'Recorrente' }
export const nomeSistema: Record<string, string> = { empresa: 'Forma da Empresa', price: 'Tabela Price', sac: 'SAC' }
