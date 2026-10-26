import type { CSSProperties } from 'react'

// Fundo vivo do menu lateral (pedido do dono, 26/10/2026): fogo azul subindo + faíscas,
// por trás de uma camada de vidro. Só CSS (animações em index.css: .fogo-azul). Para quem pede menos movimento, fica parado.

const chamas = [
  { x: 2, l: 90, a: 190, d: 6.5, t: 0, c: '#2F80FF' },
  { x: 22, l: 110, a: 240, d: 7.8, t: -2.1, c: '#4CC2FF' },
  { x: 45, l: 95, a: 210, d: 6.1, t: -4.0, c: '#1F5FE0' },
  { x: 62, l: 120, a: 260, d: 8.4, t: -1.2, c: '#3FA9FF' },
  { x: 78, l: 85, a: 180, d: 5.6, t: -3.3, c: '#2F80FF' },
  { x: 10, l: 70, a: 150, d: 5.2, t: -0.6, c: '#5FB8FF' },
  { x: 52, l: 65, a: 140, d: 4.8, t: -2.7, c: '#4CC2FF' },
  { x: 86, l: 70, a: 160, d: 6.9, t: -5.0, c: '#4CC2FF' },
  // núcleo quente (quase branco) perto da base
  { x: 30, l: 60, a: 110, d: 3.6, t: -1.4, c: '#7FD8FF' },
  { x: 68, l: 55, a: 100, d: 3.2, t: -0.3, c: '#5CC8FF' },
  { x: 48, l: 80, a: 130, d: 4.1, t: -2.2, c: '#9DDCFF' },
]
const faiscas = [8, 19, 31, 44, 53, 66, 74, 88, 14, 59, 37, 81].map((x, i) => ({ x, d: 7 + (i % 5) * 1.3, t: -i * 1.1, s: 2 + (i % 3) }))

export default function FogoAzul() {
  return (
    <div aria-hidden className="fogo-azul">
      <span className="fogo-brasa" />
      {chamas.map((f, i) => (
        <span key={i} className="fogo-chama" style={{ left: `${f.x}%`, width: f.l, height: f.a, background: f.c, animationDuration: `${f.d}s`, animationDelay: `${f.t}s` } as CSSProperties} />
      ))}
      {faiscas.map((f, i) => (
        <span key={`f${i}`} className="fogo-faisca" style={{ left: `${f.x}%`, width: f.s, height: f.s, animationDuration: `${f.d}s`, animationDelay: `${f.t}s` } as CSSProperties} />
      ))}
      <span className="fogo-vidro" />
    </div>
  )
}
