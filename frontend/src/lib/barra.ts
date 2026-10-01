import { supabase } from './supabase'

export type ResumoBarra = {
  nome: string
  subdominio: string
  statusAcesso: string
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
  const [empresa, clientes, pendentes, cobrar] = await Promise.all([
    supabase.from('fomentados').select('nome_empresa, subdominio, status_acesso, teste_gratis_ate').maybeSingle(),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).neq('status_cadastro', 'reprovado'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status_cadastro', 'pendente'),
    supabase
      .from('parcelas')
      .select('id, contratos!inner(status)', { count: 'exact', head: true })
      .neq('status', 'paga')
      .lte('vencimento', iso(new Date()))
      .eq('contratos.status', 'ativo'),
  ])
  if (!empresa.data) return null
  ultimo = {
    nome: empresa.data.nome_empresa,
    subdominio: empresa.data.subdominio,
    statusAcesso: empresa.data.status_acesso,
    testeGratisAte: empresa.data.teste_gratis_ate,
    testeFaltam: empresa.data.teste_gratis_ate
      ? Math.max(0, Math.ceil((Date.parse(empresa.data.teste_gratis_ate + 'T23:59:59') - Date.now()) / 86400000))
      : 0,
    clientes: clientes.count ?? 0,
    cadastrosPendentes: pendentes.count ?? 0,
    cobrarAteHoje: cobrar.count ?? 0,
  }
  return ultimo
}
