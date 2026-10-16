import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encargosAtraso, regraDaConfig } from '../src/lib/atraso.ts'

const desdeVenc = { multa: 20, juroDia: 3, diasCritico: 5, desde: 'vencimento' as const }
const desdeCrit = { ...desdeVenc, desde: 'critico' as const }

test('antes do Crítico não cobra nada (vencido de 1 a 4 dias)', () => {
  for (const d of [0, 1, 4]) assert.deepEqual(encargosAtraso(d, desdeVenc), { multa: 0, juro: 0, dias: 0, total: 0 })
})

test('exemplo do dono, desde o vencimento: 10 dias = 30 de juro + 20 de multa', () => {
  assert.deepEqual(encargosAtraso(10, desdeVenc), { multa: 20, juro: 30, dias: 10, total: 50 })
})

test('exemplo do dono, só a partir do Crítico: do 5º ao 10º = 6 dias = 18 + 20', () => {
  assert.deepEqual(encargosAtraso(10, desdeCrit), { multa: 20, juro: 18, dias: 6, total: 38 })
})

test('no dia que vira Crítico já cobra a multa', () => {
  assert.equal(encargosAtraso(5, desdeCrit).total, 23)
  assert.equal(encargosAtraso(5, desdeVenc).total, 35)
})

test('desconta o que já foi pago de multa e juro nesta parcela', () => {
  assert.deepEqual(encargosAtraso(10, desdeVenc, 20, 15), { multa: 0, juro: 15, dias: 10, total: 15 })
  assert.deepEqual(encargosAtraso(10, desdeVenc, 50, 99), { multa: 0, juro: 0, dias: 10, total: 0 })
})

test('valores com centavos não deixam sobra de arredondamento', () => {
  assert.equal(encargosAtraso(7, { multa: 10.1, juroDia: 0.1, diasCritico: 2, desde: 'vencimento' }).total, 10.8)
})

test('sem configuração: não cobra e Crítico com 2 dias', () => {
  const r = regraDaConfig(null)
  assert.deepEqual(r, { multa: 0, juroDia: 0, diasCritico: 2, desde: 'vencimento' })
  assert.equal(encargosAtraso(30, r).total, 0)
})
