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
