import type { Situacao } from '../lib/painel'
import { codigoPix, mensagemCliente, type Cobranca, type Pix } from '../lib/painel'
import { linkWhatsApp } from '../lib/formatos'
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

export default function BotaoCobrar({ telefone, cobrancas, pix, origem, className = '', classePix = '' }: { telefone: string; cobrancas: Cobranca[]; pix: Pix | null; origem: 'ficha' | 'contrato'; className?: string; classePix?: string }) {
  const pior = gravidade.find((g) => cobrancas.some((c) => c.situacao === g))
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
    {pior && pix && <BotaoPix telefone={telefone} codigo={codigoPix(pix, cobrancas.reduce((t, c) => t + c.valor, 0))} className={`${botaoClaro} ${classePix}`} />}
    </>
  )
}

// 2ª mensagem: só o "Pix Copia e Cola" com o valor, pro cliente segurar o dedo, copiar e colar no banco
export function BotaoPix({ telefone, codigo, className, rotulo = true }: { telefone: string; codigo: string; className: string; rotulo?: boolean }) {
  return (
    <a href={linkWhatsApp(telefone, codigo)} target="_blank" rel="noreferrer" aria-label="Mandar o Pix Copia e Cola" className={className}>
      <Icone nome="pix" tamanho={18} className="text-marca" />
      {rotulo && 'Mandar Pix'}
    </a>
  )
}
