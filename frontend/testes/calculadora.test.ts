// Testes dos textos da Calculadora GIRON. Rodar: npm test (dentro de frontend/)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dataCurta, forma, textoExtrato, textoSimulacao, textoTarjeta, valorTexto, type ParcelaCalc } from '../src/lib/calculadora.ts'

// Parcelas do jeito que o banco devolve (mensal, Forma da Empresa, última acerta os centavos)
function parcelas(n: number, valor: number, ultima: number, primeiro: string): ParcelaCalc[] {
  const [a, m, d] = primeiro.split('-').map(Number)
  return Array.from({ length: n }, (_, k) => {
    const data = new Date(Date.UTC(a, m - 1 + k, d))
    return { numero: k + 1, vencimento: data.toISOString().slice(0, 10), valor: k === n - 1 ? ultima : valor }
  })
}

test('valor e data no formato de banco', () => {
  assert.equal(valorTexto(1000), '1.000,00')
  assert.equal(valorTexto(266.67), '266,67')
  assert.equal(valorTexto(148300.5), '148.300,50')
  assert.equal(dataCurta('2026-11-01'), '01/11/26')
  assert.equal(dataCurta('2027-02-01'), '01/02/27')
})

test('extrato completo igual ao modelo do Welves', () => {
  const texto = textoExtrato('Welves Gomes', 1000, '2026-10-13', parcelas(4, 400, 400, '2026-11-01'))
  assert.equal(
    texto,
    [
      '🟦 WELVES GOMES',
      '',
      'EMPRÉSTIMO: 1.000,00',
      'DATA: 13/10/26',
      'FORMA: 4x de 400,00',
      'INÍCIO: 01/11/26',
      '',
      'PARCELAS',
      '━━━━━━━━━━━━━━━━━━━━',
      '1º — 400,00 — 01/11/26',
      '2º — 400,00 — 01/12/26',
      '3º — 400,00 — 01/01/27',
      '4º — 400,00 — 01/02/27',
    ].join('\n'),
  )
})

test('última parcela com centavos diferentes aparece na forma e na lista', () => {
  const p = parcelas(6, 266.67, 266.65, '2026-11-05')
  assert.equal(forma(p), '6x de 266,67 (última 266,65)')
  const texto = textoExtrato('João', 1000, '2026-10-05', p)
  assert.match(texto, /5º — 266,67 — 05\/03\/27/)
  assert.match(texto, /6º — 266,65 — 05\/04\/27/)
})

test('simulação lista as opções em ordem, ímpar também', () => {
  const texto = textoSimulacao(1000, [parcelas(10, 200, 200, '2026-11-05'), parcelas(6, 266.67, 266.65, '2026-11-05'), parcelas(15, 166.67, 166.62, '2026-11-05')])
  assert.equal(texto, ['💰 SIMULAÇÃO — R$ 1.000,00', '', '6x de 266,67 (última 266,65)', '10x de 200,00', '15x de 166,67 (última 166,62)'].join('\n'))
})

test('tarjeta com e sem nome', () => {
  const p = parcelas(10, 200, 200, '2026-11-05')
  assert.equal(textoTarjeta('joão  da silva', 1000, p), '🟦 JOÃO DA SILVA\nR$ 1.000,00 em 10x de 200,00\n1º vencimento: 05/11/26')
  assert.equal(textoTarjeta('  ', 1000, p), 'R$ 1.000,00 em 10x de 200,00\n1º vencimento: 05/11/26')
})
