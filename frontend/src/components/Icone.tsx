// Ícones de traço (24x24) usados no tema Pulso. Sem emoji na interface.
const caminhos = {
  inicio: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
  contratos: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />,
  lupa: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  copiar: <path d="M8 8h11v12H8zM5 16V4h11" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  certo: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  xis: <path d="M6 6l12 12M18 6 6 18" />,
  usuario: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6" />
    </>
  ),
  maleta: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  imagem: (
    <>
      <path d="M4 5h16v14H4z" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m4 17 5-4 4 3 3-2 4 3" />
    </>
  ),
  seta: <path d="M9 6l6 6-6 6" />,
  relatorios: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 6l2.1 2.1M17.7 15.9l2.1 2.1M2.5 12h3M18.5 12h3M4.2 18l2.1-2.1M17.7 8.1l2.1-2.1" />
    </>
  ),
  globo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z" />
    </>
  ),
  sair: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
  subindo: <path d="M4 17l5-5 4 4 7-8M15 8h5v5" />,
  moeda: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.5 9.5c-.5-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.2 0-2.1-.5-2.6-1.5" />
    </>
  ),
  entrando: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  saindo: <path d="M12 20V8M7 13l5-5 5 5M5 4h14" />,
  whatsapp: (
    <>
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
      <path d="M9.5 9.5c0 2.5 2.5 5 5 5l1-1.5-2-1-1 1c-1-.5-1.5-1-2-2l1-1-1-2z" />
    </>
  ),
}

export type NomeIcone = keyof typeof caminhos

export default function Icone({ nome, tamanho = 20, className }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {caminhos[nome]}
    </svg>
  )
}
