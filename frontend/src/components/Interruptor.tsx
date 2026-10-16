// Liga/desliga padrão do GIRON (pedido do dono em 16/10/2026): estilo VIDRO (glass) em todo lugar que é "sim ou não".
// Trilho translúcido com desfoque e brilho de borda; ligado = verde da marca com luz. `claro` = versão pras páginas claras do cliente.
export default function Interruptor({ ligado, onChange, rotulo, claro, desabilitado }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; claro?: boolean; desabilitado?: boolean }) {
  const trilho = ligado
    ? 'border-marca/60 bg-marca/25 shadow-[0_0_18px_-2px_rgba(124,255,178,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]'
    : claro
      ? 'border-slate-900/15 bg-slate-900/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
      : 'border-white/15 bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_2px_rgba(0,0,0,0.35)]'
  const bolinha = ligado
    ? 'left-[23px] bg-marca shadow-[0_0_10px_rgba(124,255,178,0.9),0_2px_4px_rgba(0,0,0,0.4)]'
    : claro
      ? 'left-[3px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
      : 'left-[3px] bg-white/75 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
  return (
    <button
      type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} onClick={() => onChange(!ligado)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full border backdrop-blur-md transition-all duration-200 active:scale-95 disabled:opacity-50 ${trilho}`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
      <span className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full transition-all duration-200 ${bolinha}`}>
        <span className="absolute inset-[3px] rounded-full bg-gradient-to-b from-white/50 to-transparent" />
      </span>
    </button>
  )
}
