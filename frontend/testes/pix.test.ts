import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chaveOficial, crc16, pixCopiaCola } from '../src/lib/pix.ts'

test('exemplo oficial do Banco Central (manual do BR Code) bate letra por letra', () => {
  const esperado = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913FULANO DE TAL6008BRASILIA62070503***63041D3D'
  // O manual usa "Fulano de Tal"; aqui o nome vai em maiúsculas, então a conferência final muda
  const comNomeDoManual = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
  assert.equal(crc16(comNomeDoManual), '1D3D')
  const gerado = pixCopiaCola({ chave: '123e4567-e12b-12d1-a456-426655440000', tipo: 'aleatoria', nome: 'Fulano de Tal', cidade: 'Brasília' })
  assert.equal(gerado.slice(0, -4), esperado.slice(0, -4))
  assert.equal(gerado.slice(-4), crc16(gerado.slice(0, -4)))
})

test('valor vai com ponto e 2 casas', () => {
  const c = pixCopiaCola({ chave: '63992639099', tipo: 'telefone', nome: 'Financeira Exemplo', valor: 693.94 })
  assert.ok(c.includes('5406693.94'))
})

test('chave no formato oficial', () => {
  assert.equal(chaveOficial('(63) 99263-9099', 'telefone'), '+5563992639099')
  assert.equal(chaveOficial('5563992639099', 'telefone'), '+5563992639099')
  assert.equal(chaveOficial('123.456.789-09', 'cpf'), '12345678909')
  assert.equal(chaveOficial(' Fulano@Email.com ', 'email'), 'fulano@email.com')
})

test('nome sem acento e no máximo 25 letras', () => {
  const c = pixCopiaCola({ chave: 'a@b.com', tipo: 'email', nome: 'Financeira São João do Araguaia Ltda' })
  assert.ok(c.includes('5925FINANCEIRA SAO JOAO DO A'))
})
