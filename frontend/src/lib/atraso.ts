// Multa e juro de atraso (passo 5.5; cofre: 01-PROJETO/REGRAS-DE-EMPRESTIMO.md "Atraso e cobrança").
// Cada Fomentado escolhe os valores nas Configurações. Só começam quando o atraso vira Crítico.
// Aqui só a conta (sem import de outros arquivos de propósito: os testes rodam este arquivo direto no Node).

export type RegraAtraso = {
  multa: number // R$, uma vez por parcela
  juroDia: number // R$ por dia de atraso
  diasCritico: number // a partir de quantos dias de atraso é Crítico
  desde: 'vencimento' | 'critico' // juro diário conta desde o vencimento ou só a partir do Crítico
}

export type Encargos = { multa: number; juro: number; dias: number; total: number }

const centavos = (v: number) => Math.round(v * 100) / 100

// diasAtraso: dias desde o vencimento (0 = vence hoje). jaPago*: o que já entrou de multa/juro de atraso nesta parcela.
export function encargosAtraso(diasAtraso: number, regra: RegraAtraso, jaPagoMulta = 0, jaPagoJuro = 0): Encargos {
  if (diasAtraso < regra.diasCritico) return { multa: 0, juro: 0, dias: 0, total: 0 }
  const dias = regra.desde === 'vencimento' ? diasAtraso : diasAtraso - regra.diasCritico + 1
  const multa = centavos(Math.max(0, regra.multa - jaPagoMulta))
  const juro = centavos(Math.max(0, dias * regra.juroDia - jaPagoJuro))
  return { multa, juro, dias, total: centavos(multa + juro) }
}

// Lê a regra da linha de fomentado_configuracoes (sem linha = não cobra nada, crítico com 2 dias)
export function regraDaConfig(c: { multa_atraso_valor?: number | null; juro_diario_atraso_valor?: number | null; dias_para_critico?: number | null; juro_atraso_desde?: string | null } | null): RegraAtraso {
  return {
    multa: Number(c?.multa_atraso_valor ?? 0),
    juroDia: Number(c?.juro_diario_atraso_valor ?? 0),
    diasCritico: Number(c?.dias_para_critico ?? 2),
    desde: c?.juro_atraso_desde === 'critico' ? 'critico' : 'vencimento',
  }
}
