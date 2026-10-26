import { supabase } from './supabase'

// Selfie do cadastro de cada cliente (cliente_arquivos tipo "selfie", no cofre privado "clientes").
// O cofre é privado: cada foto ganha um link temporário de 1 hora, guardado aqui pra não pedir de novo a cada tela.

const VALIDADE = 3600
const guardadas = new Map<string, { url: string | null; ate: number }>()

export async function fotosClientes(ids: string[]): Promise<Record<string, string>> {
  const agora = Date.now()
  const faltam = [...new Set(ids)].filter((id) => !(guardadas.get(id)?.ate! > agora))
  if (faltam.length) {
    const { data } = await supabase
      .from('cliente_arquivos')
      .select('cliente_id, caminho_arquivo')
      .eq('tipo', 'selfie')
      .in('cliente_id', faltam)
    const caminhos = (data ?? []).map((a) => a.caminho_arquivo as string)
    const { data: assinadas } = caminhos.length
      ? await supabase.storage.from('clientes').createSignedUrls(caminhos, VALIDADE)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const porCaminho = new Map((assinadas ?? []).map((s) => [s.path, s.signedUrl]))
    const ate = agora + (VALIDADE - 120) * 1000
    for (const id of faltam) guardadas.set(id, { url: null, ate })
    for (const a of data ?? []) guardadas.set(a.cliente_id as string, { url: porCaminho.get(a.caminho_arquivo as string) ?? null, ate })
  }
  const r: Record<string, string> = {}
  for (const id of ids) { const u = guardadas.get(id)?.url; if (u) r[id] = u }
  return r
}
