import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Moldura from './Moldura'

// Moldura padrao das telas internas: menu do tema Pulso + voltar + titulo
// largo = ocupa mais espaço no computador (listas e fichas)
export default function Tela({
  titulo,
  subtitulo,
  voltar,
  acoes,
  largo,
  foto,
  children,
}: {
  titulo?: string
  subtitulo?: string
  voltar?: string
  acoes?: ReactNode
  largo?: boolean
  foto?: string | null
  children: ReactNode
}) {
  return (
    <Moldura>
      <main className={`mx-auto max-w-md px-4 pt-5 lg:px-0 lg:pt-1 ${largo ? 'lg:max-w-none' : 'lg:max-w-2xl'}`}>
        {voltar && (
          <Link to={voltar} className="-ml-2 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-sm font-semibold text-suave hover:text-texto">
            ← Voltar
          </Link>
        )}
        {(titulo || acoes) && (
          <header className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {foto && <img src={foto} alt="Foto do cliente" className="size-14 shrink-0 rounded-2xl object-cover" />}
              <div className="min-w-0">
              {titulo && <h1 className="text-2xl font-bold tracking-tight lg:text-[28px]">{titulo}</h1>}
              {subtitulo && <p className="mt-0.5 text-[13px] text-suave">{subtitulo}</p>}
              </div>
            </div>
            {acoes && <div className="flex gap-2">{acoes}</div>}
          </header>
        )}
        {children}
      </main>
    </Moldura>
  )
}
