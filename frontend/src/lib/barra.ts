import { supabase } from './supabase'
import { urlLogo } from './marca'

export type ResumoBarra = {
  nome: string
  subdominio: string
  logo: string | null
  statusAcesso: string
  travado: boolean
  robo: boolean
  whatsapp: boolean
  mensalidade: number
  proximaMensalidade: { vencimento: string; valor: number } | null
  testeGratisAte: string | null
  testeFaltam: number
  clientes: number
  cadastrosPendentes: number
  cobrarAteHoje: number
}

// data local -> 2026-10-01
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Guardado entre as telas pra barra não piscar a cada troca de página
let ultimo: ResumoBarra | null = null
export const resumoGuardado = () => ultimo

// Dados da barra lateral: empresa, plano e contadores do menu
export async function carregarBarra(): Promise<ResumoBarra | null> {
  const [empresa, clientes, pendentes, cobrar, recursos, mensal] = await Promise.all([
    supabase.from('fomentados').select('nome_empresa, subdominio, logo_arquivo, status_acesso, bloqueio_manual, teste_gratis_ate, mensalidade_valor').maybeSingle(),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).neq('status_cadastro', 'reprovado'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status_cadastro', 'pendente'),
    supabase
      .from('parcelas')
      .select('id, contratos!inner(status)', { count: 'exact', head: true })
      .neq('status', 'paga')
      .lte('vencimento', iso(new Date()))
      .eq('contratos.status', 'ativo'),
    supabase.from('recursos_extras').select('recurso, liberado'),
    supabase.from('assinaturas').select('vencimento, valor').eq('tipo', 'mensalidade').is('pago_em', null).order('vencimento').limit(1).maybeSingle(),
  ])
  if (!empresa.data) return null
  ultimo = {
    nome: empresa.data.nome_empresa,
    subdominio: empresa.data.subdominio,
    logo: urlLogo(empresa.data.logo_arquivo),
    statusAcesso: empresa.data.status_acesso,
    travado: empresa.data.bloqueio_manual,
    robo: !!recursos.data?.some((x) => x.recurso === 'agente_telegram' && x.liberado),
    whatsapp: !!recursos.data?.some((x) => x.recurso === 'whatsapp_automatico' && x.liberado),
    mensalidade: Number(empresa.data.mensalidade_valor ?? 0),
    proximaMensalidade: mensal.data ? { vencimento: mensal.data.vencimento, valor: Number(mensal.data.valor) } : null,
    testeGratisAte: empresa.data.teste_gratis_ate,
    testeFaltam: empresa.data.teste_gratis_ate
      ? Math.max(0, Math.round((Date.parse(empresa.data.teste_gratis_ate + 'T12:00:00') - Date.parse(iso(new Date()) + 'T12:00:00')) / 86400000))
      : 0,
    clientes: clientes.count ?? 0,
    cadastrosPendentes: pendentes.count ?? 0,
    cobrarAteHoje: cobrar.count ?? 0,
  }
  return ultimo
}
