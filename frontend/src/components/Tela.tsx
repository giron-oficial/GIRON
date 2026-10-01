import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Moldura from './Moldura'

// Moldura padrao das telas internas: menu do tema Pulso + voltar + titulo
export default function Tela({ titulo, voltar, children }: { titulo?: string; voltar?: string; children: ReactNode }) {
  return (
    <Moldura>
      <main className="mx-auto max-w-md px-4 pt-6 lg:max-w-2xl lg:pt-2">
        {voltar && (
          <Link to={voltar} className="-ml-2 inline-flex rounded-xl px-2 py-2 text-suave hover:bg-superficie-2">
            ← Voltar
          </Link>
        )}
        {titulo && <h1 className="mt-2 text-2xl font-bold">{titulo}</h1>}
        {children}
      </main>
    </Moldura>
  )
}
