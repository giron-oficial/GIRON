// "Pix Copia e Cola" (BR Code estático do Banco Central) com o valor já preenchido.
// Pedido do dono, 28/10/2026: o cliente cola no app do banco e o valor aparece sozinho.
// Sem import de outros arquivos de propósito: os testes rodam este arquivo direto no Node.

export type TipoChave = 'cpf' | 'cnpj' | 'telefone' | 'email' | 'aleatoria'

// Cada campo do BR Code: código (2) + tamanho (2) + valor
const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, '0') + valor

// Nome e cidade só aceitam letras simples (sem acento) e têm tamanho máximo
const simples = (t: string, max: number) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max)

// A chave vai no formato oficial: telefone com +55, CPF/CNPJ só números, e-mail e aleatória em minúsculas
export function chaveOficial(chave: string, tipo: string): string {
  const t = chave.trim()
  const d = t.replace(/\D/g, '')
  if (tipo === 'telefone') return '+' + (d.startsWith('55') && d.length >= 12 ? d : '55' + d)
  if (tipo === 'cpf' || tipo === 'cnpj') return d
  return t.toLowerCase()
}

// Conferência CRC16 (CCITT-FALSE) exigida no fim do código
export function crc16(texto: string): string {
  let crc = 0xffff
  for (const ch of new TextEncoder().encode(texto)) {
    crc ^= ch << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function pixCopiaCola(p: { chave: string; tipo: string; nome: string; cidade?: string; valor?: number }): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chaveOficial(p.chave, p.tipo))
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (p.valor && p.valor > 0 ? campo('54', p.valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', simples(p.nome, 25) || 'RECEBEDOR') +
    campo('60', simples(p.cidade ?? '', 15) || 'BRASIL') +
    campo('62', campo('05', '***')) +
    '6304'
  return corpo + crc16(corpo)
}
