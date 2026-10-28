import { useState } from 'react'
import type { Situacao } from '../lib/painel'
import { codigoPix, mensagemCliente, type Cobranca, type Pix } from '../lib/painel'
import { linkWhatsApp, reais } from '../lib/formatos'
import { rastrear } from '../lib/analytics'
import Icone from './Icone'
import { botaoClaro } from './estilo'

// Botão WhatsApp da ficha do cliente e do contrato (pedido do dono, 28/10/2026).
// Só a LOGO ORIGINAL do WhatsApp muda de cor, pela situação mais grave do cliente:
// em dia = verde, Crítico = cor do Crítico, vencido = vermelho, vence hoje = azul, vence amanhã = amarelo.
// Com parcela em aberto, já abre o WhatsApp com a mensagem pronta (mesma do "Cobrar agora").

const gravidade: Situacao[] = ['critico', 'vencido', 'hoje', 'amanha']
const corLogo: Record<Situacao | 'em_dia', string> = {
  critico: 'text-critico',
  vencido: 'text-vencido',
  hoje: 'text-hoje',
  amanha: 'text-amanha',
  em_dia: 'text-sucesso',
}
const texto: Record<Situacao | 'em_dia', string> = {
  critico: 'Cobrar atraso',
  vencido: 'Cobrar atraso',
  hoje: 'Cobrar hoje',
  amanha: 'Lembrar amanhã',
  em_dia: 'WhatsApp',
}
const evento: Record<Situacao, string> = { critico: 'atrasado', vencido: 'atrasado', hoje: 'vence_hoje', amanha: 'vence_amanha' }

export function LogoWhatsApp({ tamanho = 20, className = '' }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

// Situação mais grave das cobranças em aberto (sem nenhuma = em dia)
export const situacaoDe = (cs: Cobranca[]) => gravidade.find((g) => cs.some((c) => c.situacao === g))

// Só a logo, pra listas (Clientes): mesma cor e mesma mensagem do botão
export function IconeCobrar({ telefone, cobrancas, pix }: { telefone: string; cobrancas: Cobranca[]; pix: Pix[] }) {
  const pior = situacaoDe(cobrancas)
  const situacao = pior ?? 'em_dia'
  return (
    <a
      href={pior ? linkWhatsApp(telefone, mensagemCliente(cobrancas, pix)) : linkWhatsApp(telefone)}
      target="_blank"
      rel="noreferrer"
      onClick={() => pior && rastrear('cobranca_enviada', { canal: 'whatsapp_clientes', situacao: evento[pior] })}
      aria-label={`${texto[situacao]} no WhatsApp`}
      title={texto[situacao]}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/5"
    >
      <LogoWhatsApp tamanho={22} className={corLogo[situacao]} />
    </a>
  )
}

export default function BotaoCobrar({ telefone, cobrancas, pix, origem, className = '', classePix = '' }: { telefone: string; cobrancas: Cobranca[]; pix: Pix[]; origem: 'ficha' | 'contrato'; className?: string; classePix?: string }) {
  const pior = situacaoDe(cobrancas)
  const situacao = pior ?? 'em_dia'
  const href = pior ? linkWhatsApp(telefone, mensagemCliente(cobrancas, pix)) : linkWhatsApp(telefone)
  return (
    <>
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => pior && rastrear('cobranca_enviada', { canal: `whatsapp_${origem}`, situacao: evento[pior] })}
      className={`${botaoClaro} ${className}`}
    >
      <LogoWhatsApp className={corLogo[situacao]} />
      {texto[situacao]}
    </a>
    {pior && pix.length > 0 && <BotaoPix telefone={telefone} chaves={pix} valor={cobrancas.reduce((t, c) => t + c.valor, 0)} className={`${botaoClaro} ${classePix}`} />}
    </>
  )
}

const nomeTipo: Record<string, string> = { cpf: 'CPF', cnpj: 'CNPJ', telefone: 'Telefone', email: 'E-mail', aleatoria: 'Aleatória' }

// 2ª mensagem: só o "Pix Copia e Cola" com o valor, pro cliente segurar o dedo, copiar e colar no banco.
// Uma chave só: vai direto. Várias: abre a janela pra escolher (a Padrão em primeiro) — pedido do dono, 28/10/2026.
export function BotaoPix({ telefone, chaves, valor, className, rotulo = true }: { telefone: string; chaves: Pix[]; valor: number; className: string; rotulo?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const conteudo = (
    <>
      <Icone nome="pix" tamanho={18} className="text-marca" />
      {rotulo && 'Mandar Pix'}
    </>
  )
  if (chaves.length === 1) {
    return (
      <a href={linkWhatsApp(telefone, codigoPix(chaves[0], valor))} target="_blank" rel="noreferrer" aria-label="Mandar o Pix Copia e Cola" className={className}>
        {conteudo}
      </a>
    )
  }
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label="Escolher a chave Pix" className={className}>
        {conteudo}
      </button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setAberto(false)}>
          <div role="dialog" aria-modal="true" aria-label="Escolher a chave Pix" onClick={(e) => e.stopPropagation()} className="cartao flex w-full max-w-sm flex-col gap-3 rounded-[18px] p-5 text-left shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-bold">Qual chave Pix mandar?</span>
                <span className="text-xs text-suave">Vai o Pix Copia e Cola de {reais(valor)}</span>
              </span>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-xl text-suave hover:bg-white/5">
                <Icone nome="xis" tamanho={18} />
              </button>
            </div>
            {chaves.map((k, i) => (
              <a
                key={k.tipo + k.chave}
                href={linkWhatsApp(telefone, codigoPix(k, valor))}
                target="_blank"
                rel="noreferrer"
                onClick={() => setAberto(false)}
                className="flex items-center gap-3 rounded-2xl bg-superficie-2 p-3 hover:bg-borda"
              >
                <Icone nome="pix" tamanho={20} className="shrink-0 text-marca" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs text-suave">
                    {nomeTipo[k.tipo] ?? k.tipo}
                    {i === 0 && <span className="ml-2 rounded-md bg-marca/15 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-marca uppercase">Padrão</span>}
                  </span>
                  <span className="truncate text-sm font-bold">{k.chave}</span>
                </span>
                <Icone nome="seta" tamanho={16} className="shrink-0 text-suave" />
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
