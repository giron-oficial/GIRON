import { useId } from 'react'

// Logo do Telegram em VIDRO (pedido do dono em 27/10/2026, com imagem de exemplo):
// ligado = bolha azul Telegram brilhante com aro prateado e aviãozinho branco; desligado = a mesma logo em cinza, apagada.
export default function LogoTelegram({ ligado, tamanho = 18 }: { ligado: boolean; tamanho?: number }) {
  const id = useId().replace(/:/g, '')
  const [claro, escuro] = ligado ? ['#7FD8FF', '#1A8FD6'] : ['#B4C2D8', '#6C7E9C']
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" className={ligado ? 'drop-shadow-[0_0_6px_rgba(42,171,238,0.8)]' : 'opacity-70'}>
      <defs>
        <linearGradient id={`aro${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#9FB3C8" />
          <stop offset="1" stopColor="#E6EEF7" />
        </linearGradient>
        <radialGradient id={`bolha${id}`} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor={claro} />
          <stop offset="1" stopColor={escuro} />
        </radialGradient>
        <linearGradient id={`brilho${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11.5" fill={`url(#aro${id})`} />
      <circle cx="12" cy="12" r="10" fill={`url(#bolha${id})`} />
      <path
        fill="#FFFFFF"
        fillOpacity="0.95"
        d="M5.5 11.6l11.3-4.4c.5-.2 1 .1.8.9l-1.9 9.1c-.1.6-.5.8-1.1.5l-2.9-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.9-.9c-.6-.2-.6-.6.1-.9z"
      />
      <ellipse cx="12" cy="7" rx="7" ry="4" fill={`url(#brilho${id})`} />
    </svg>
  )
}
