// Símbolo oficial do GIRON (gráfico subindo com seta dentro do G), escolhido pelo dono em 18/10/2026.
// Arquivo original: HD externo "logo giron/GIRON.png" (só o símbolo, sem o nome); cópia em public/logo-giron.png.
export function Logo({ tamanho = 32, className = '' }: { tamanho?: number; className?: string }) {
  return <img src="/logo-giron.png" alt="" width={tamanho} height={tamanho} draggable={false} className={`shrink-0 select-none ${className}`} />
}
