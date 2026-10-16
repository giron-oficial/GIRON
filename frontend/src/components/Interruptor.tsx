// Liga/desliga (estilo celular) no lugar de caixinha de marcar. Verde quando ligado.
export default function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={() => onChange(!ligado)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full border transition-colors ${ligado ? 'border-marca bg-marca' : 'border-borda bg-superficie-2'}`}
    >
      <span className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full shadow transition-all ${ligado ? 'left-[23px] bg-sobre-verde' : 'left-[3px] bg-suave'}`} />
    </button>
  )
}
