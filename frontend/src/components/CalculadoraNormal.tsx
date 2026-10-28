import { useCallback, useEffect, useState } from 'react'

// Calculadora comum (aba "Normal" da Calculadora): conta de padaria, com vírgula do Brasil.
// Funciona com o dedo e com o teclado do computador (números, + - * /, Enter, Backspace, Esc).

type Op = '+' | '−' | '×' | '÷'

const MAX_DIGITOS = 15

function fazer(a: number, b: number, op: Op) {
  if (op === '+') return a + b
  if (op === '−') return a - b
  if (op === '×') return a * b
  return b === 0 ? NaN : a / b
}

// Número pro visor: separador de milhar e vírgula (1.234,5); tira o "lixo" de conta com vírgula (0,1 + 0,2)
function noVisor(n: number) {
  if (!isFinite(n)) return 'Erro'
  return Number(n.toPrecision(12)).toLocaleString('pt-BR', { maximumFractionDigits: 10 })
}

// O que está sendo digitado: mantém a vírgula e os zeros do fim ("12," ou "0,50")
function digitandoNoVisor(t: string) {
  const [int, dec] = t.split(',')
  const inteiro = Number(int.replace('-', '')).toLocaleString('pt-BR')
  return `${int.startsWith('-') ? '-' : ''}${inteiro}${dec !== undefined ? ',' + dec : ''}`
}

const paraNumero = (t: string) => Number(t.replace(',', '.'))

export default function CalculadoraNormal() {
  const [visor, setVisor] = useState('0') // texto cru, com vírgula
  const [guardado, setGuardado] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [novo, setNovo] = useState(true) // próximo dígito começa um número novo
  const [conta, setConta] = useState('') // linha de cima: "1.000 + 10%"

  const erro = visor === 'Erro'

  const limpar = useCallback(() => {
    setVisor('0'); setGuardado(null); setOp(null); setNovo(true); setConta('')
  }, [])

  const digito = useCallback((d: string) => {
    if (erro || novo) {
      setVisor(d === ',' ? '0,' : d)
      setNovo(false)
      if (!op) setConta('')
      return
    }
    setVisor((v) => {
      if (d === ',') return v.includes(',') ? v : v + ','
      if (v.replace(/\D/g, '').length >= MAX_DIGITOS) return v
      return v === '0' ? d : v === '-0' ? '-' + d : v + d
    })
  }, [erro, novo, op])

  const operar = useCallback((proxima: Op) => {
    if (erro) return
    const atual = paraNumero(visor)
    let base = atual
    if (op && guardado !== null && !novo) {
      base = fazer(guardado, atual, op)
      setVisor(isFinite(base) ? String(base).replace('.', ',') : 'Erro')
      if (!isFinite(base)) { setGuardado(null); setOp(null); setNovo(true); setConta(''); return }
    } else if (op && novo && guardado !== null) {
      base = guardado // trocou de sinal sem digitar: só troca o sinal
    }
    setGuardado(base)
    setOp(proxima)
    setNovo(true)
    setConta(`${noVisor(base)} ${proxima}`)
  }, [erro, visor, op, guardado, novo])

  const igual = useCallback(() => {
    if (erro || !op || guardado === null) return
    const atual = paraNumero(visor)
    const r = fazer(guardado, atual, op)
    setConta(`${noVisor(guardado)} ${op} ${noVisor(atual)} =`)
    setVisor(isFinite(r) ? String(r).replace('.', ',') : 'Erro')
    setGuardado(null); setOp(null); setNovo(true)
  }, [erro, op, guardado, visor])

  // %: com + ou − vira "porcentagem do número de antes" (1.000 + 10% = 1.100); sozinho divide por 100
  const porcento = useCallback(() => {
    if (erro) return
    const atual = paraNumero(visor)
    const r = guardado !== null && (op === '+' || op === '−') ? (guardado * atual) / 100 : atual / 100
    setVisor(String(r).replace('.', ','))
    setNovo(false)
  }, [erro, visor, guardado, op])

  const apagar = useCallback(() => {
    if (erro || novo) return
    setVisor((v) => (v.length <= 1 || (v.length === 2 && v.startsWith('-')) ? '0' : v.slice(0, -1)))
  }, [erro, novo])

  const trocarSinal = useCallback(() => {
    if (erro) return
    setVisor((v) => (v === '0' ? v : v.startsWith('-') ? v.slice(1) : '-' + v))
    setNovo(false)
  }, [erro])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement
      if (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA') return
      const k = e.key
      if (/^\d$/.test(k)) digito(k)
      else if (k === ',' || k === '.') digito(',')
      else if (k === '+') operar('+')
      else if (k === '-') operar('−')
      else if (k === '*' || k === 'x') operar('×')
      else if (k === '/') operar('÷')
      else if (k === '%') porcento()
      else if (k === 'Enter' || k === '=') igual()
      else if (k === 'Backspace') apagar()
      else if (k === 'Escape' || k === 'Delete') limpar()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [digito, operar, porcento, igual, apagar, limpar])

  const texto = erro ? 'Erro' : novo ? noVisor(paraNumero(visor)) : digitandoNoVisor(visor)

  const tecla = 'flex h-16 items-center justify-center rounded-2xl text-2xl font-bold tabular-nums transition active:scale-[0.96] disabled:opacity-40'
  const numero = `${tecla} bg-superficie-2 hover:bg-borda`
  const funcao = `${tecla} cartao text-suave hover:text-texto text-xl`
  const sinal = (s: Op) => `${tecla} ${op === s && novo ? 'verde' : 'cartao text-marca hover:text-texto'}`

  return (
    <section className="cartao mx-auto mt-4 w-full max-w-md rounded-[26px] p-5 lg:p-6">
      <div className="mb-4 flex min-h-28 flex-col items-end justify-end rounded-2xl border border-borda bg-fundo px-4 py-3" aria-live="polite">
        <p className="h-5 truncate text-sm text-suave tabular-nums">{conta}</p>
        <p className={`w-full truncate text-right font-display font-extrabold tabular-nums ${texto.length > 12 ? 'text-3xl' : 'text-5xl'} ${erro ? 'text-vencido' : ''}`}>
          {texto}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={limpar} className={`${funcao} text-vencido`}>C</button>
        <button type="button" onClick={apagar} aria-label="Apagar" className={funcao}>⌫</button>
        <button type="button" onClick={porcento} className={funcao}>%</button>
        <button type="button" onClick={() => operar('÷')} aria-label="Dividir" className={sinal('÷')}>÷</button>

        {['7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => digito(d)} className={numero}>{d}</button>)}
        <button type="button" onClick={() => operar('×')} aria-label="Vezes" className={sinal('×')}>×</button>

        {['4', '5', '6'].map((d) => <button key={d} type="button" onClick={() => digito(d)} className={numero}>{d}</button>)}
        <button type="button" onClick={() => operar('−')} aria-label="Menos" className={sinal('−')}>−</button>

        {['1', '2', '3'].map((d) => <button key={d} type="button" onClick={() => digito(d)} className={numero}>{d}</button>)}
        <button type="button" onClick={() => operar('+')} aria-label="Mais" className={sinal('+')}>+</button>

        <button type="button" onClick={trocarSinal} aria-label="Trocar sinal" className={funcao}>±</button>
        <button type="button" onClick={() => digito('0')} className={numero}>0</button>
        <button type="button" onClick={() => digito(',')} aria-label="Vírgula" className={numero}>,</button>
        <button type="button" onClick={igual} aria-label="Igual" className={`${tecla} verde`}>=</button>
      </div>
    </section>
  )
}
