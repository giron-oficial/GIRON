import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barreiraFinal, limparEndereco, limparPropriedades } from '../src/lib/privacidade.ts'

// simula o navegador só pro new URL() ter uma origem
;(globalThis as { window?: unknown }).window = { location: { origin: 'https://teste.gironga.com.br' } }

test('endereço de página sai sem id, sem código de link e sem parâmetros', () => {
  assert.equal(limparEndereco('https://teste.gironga.com.br/clientes/3f2a9c1e-1b2c-4d5e-8f90-123456789abc?x=1#y'), 'https://teste.gironga.com.br/clientes/:id')
  assert.equal(limparEndereco('/c/AB12cd'), '/c/:codigo')
  assert.equal(limparEndereco('/contratos/42?x=1'), '/contratos/:n')
  assert.equal(limparEndereco('teste.gironga.com.br'), 'teste.gironga.com.br')
})

test('propriedades proibidas são removidas, mesmo aninhadas', () => {
  const r = limparPropriedades({
    modalidade: 'mensal', nome_completo: 'Maria', cpf: '12345678901', telefone: '63999990000', valor: 500, email: 'a@b.c',
    $set: { nome: 'x', plano: 'teste' }, $current_url: 'https://teste.gironga.com.br/clientes/3f2a9c1e-1b2c-4d5e-8f90-123456789abc',
  })
  assert.deepEqual(r, { modalidade: 'mensal', $set: { plano: 'teste' }, $current_url: 'https://teste.gironga.com.br/clientes/:id' })
})

test('texto com cara de CPF ou telefone é descartado', () => {
  const r = limparPropriedades({ obs: 'cliente 123.456.789-01', outro: '(63) 99999-0000', ok: 'mensal' })
  assert.deepEqual(r, { ok: 'mensal' })
})

test('barreira final derruba o evento inteiro se sobrou dado pessoal', () => {
  assert.equal(barreiraFinal({ properties: { a: 'tel 63 99999-0000' } }), null)
  assert.deepEqual(barreiraFinal({ properties: { a: 'mensal' } }), { properties: { a: 'mensal' } })
  assert.equal(barreiraFinal(null), null)
})

// Regressão: o PostHog não enviava NENHUM evento porque o filtro derrubava propriedades técnicas dele
test('propriedades técnicas do PostHog ($time, token, $pathname) sobrevivem ao filtro', () => {
  const r = limparPropriedades({
    $time: 1792238631.414, token: 'phc_chave_publica', $pathname: '/clientes/3f2a9c1e-1b2c-4d5e-8f90-123456789abc',
    $lib: 'web', distinct_id: '0199e8f0-1a2b-7c3d-8e4f-0123456789ab',
  })
  assert.equal(r.$time, 1792238631.414)
  assert.equal(r.token, 'phc_chave_publica')
  assert.equal(r.$pathname, '/clientes/:id')
  assert.equal(r.$lib, 'web')
  assert.equal(r.distinct_id, '0199e8f0-1a2b-7c3d-8e4f-0123456789ab')
})

test('barreira final não confunde número de relógio ($time) com telefone', () => {
  const ev = { event: '$pageview', properties: { $time: 1792238631.414, $screen_height: 1080, $browser_version: 141, ok: 'mensal' } }
  assert.deepEqual(barreiraFinal(ev), ev)
  // mas texto com telefone aninhado continua derrubando
  assert.equal(barreiraFinal({ properties: { $set: { obs: '(63) 99999-0000' } } }), null)
})
