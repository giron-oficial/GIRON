// Calculadora GIRON: monta os textos pro WhatsApp (cofre: 06-ESPECIFICACAO/CALCULADORA.md).
// As contas vêm do banco (emprestimo_simular); aqui só se escreve o texto.
// Sem import de outros arquivos de propósito: os testes (frontend/testes) rodam este arquivo direto no Node.

export type ParcelaCalc = { numero: number; vencimento: string; valor: number }

// 1000 -> "1.000,00" (sem o R$, igual texto de banco)
export const valorTexto = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 2026-11-01 -> 01/11/26
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`

const maiusculo = (nome: string) => nome.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')

// "6x de 266,67" ou, quando a última acerta os centavos, "6x de 266,67 (última 266,65)"
export function forma(parcelas: ParcelaCalc[]): string {
  const primeira = parcelas[0].valor
  const ultima = parcelas[parcelas.length - 1].valor
  const base = `${parcelas.length}x de ${valorTexto(primeira)}`
  return ultima === primeira ? base : `${base} (última ${valorTexto(ultima)})`
}

// 1) Simulação: várias quantidades pro cliente escolher
export function textoSimulacao(capital: number, opcoes: ParcelaCalc[][]): string {
  const linhas = [...opcoes].sort((a, b) => a.length - b.length).map(forma)
  return [`💰 SIMULAÇÃO — R$ ${valorTexto(capital)}`, '', ...linhas].join('\n')
}

// 2) Tarjeta: só a quantidade que o cliente escolheu
export function textoTarjeta(nome: string, capital: number, parcelas: ParcelaCalc[]): string {
  const linhas = [`R$ ${valorTexto(capital)} em ${forma(parcelas)}`, `1º vencimento: ${dataCurta(parcelas[0].vencimento)}`]
  return nome.trim() ? [`🟦 ${maiusculo(nome)}`, ...linhas].join('\n') : linhas.join('\n')
}

// 3) Extrato completo: depois de aprovado (modelo do dono)
export function textoExtrato(nome: string, capital: number, dataContrato: string, parcelas: ParcelaCalc[]): string {
  return [
    ...(nome.trim() ? [`🟦 ${maiusculo(nome)}`, ''] : []),
    `EMPRÉSTIMO: ${valorTexto(capital)}`,
    `DATA: ${dataCurta(dataContrato)}`,
    `FORMA: ${forma(parcelas)}`,
    `INÍCIO: ${dataCurta(parcelas[0].vencimento)}`,
    '',
    'PARCELAS',
    '━━━━━━━━━━━━━━━━━━━━',
    ...parcelas.map((p) => `${p.numero}º — ${valorTexto(p.valor)} — ${dataCurta(p.vencimento)}`),
  ].join('\n')
}
