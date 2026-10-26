import { supabase } from './supabase'

// Logo da empresa do Fomentado (bucket público "marcas", caminho <tenant_id>/<arquivo>)

export const urlLogo = (caminho: string | null | undefined) =>
  caminho ? supabase.storage.from('marcas').getPublicUrl(caminho).data.publicUrl : null

// Avisa o menu pra recarregar nome e logo depois que o dono troca
export const avisarMarcaMudou = () => window.dispatchEvent(new Event('giron:marca'))

// Diminui a imagem pra no máximo 512 px (mantém o fundo transparente) e devolve PNG
export async function prepararLogo(arquivo: File): Promise<Blob> {
  const img = await createImageBitmap(arquivo)
  const escala = Math.min(1, 512 / Math.max(img.width, img.height))
  const tela = document.createElement('canvas')
  tela.width = Math.round(img.width * escala)
  tela.height = Math.round(img.height * escala)
  tela.getContext('2d')!.drawImage(img, 0, 0, tela.width, tela.height)
  return new Promise((ok, falha) => tela.toBlob((b) => (b ? ok(b) : falha(new Error('imagem'))), 'image/png'))
}

// Único contato que aparece no sistema (regra do dono: nada pessoal dele na tela)
export const EMAIL_SUPORTE = 'girongestao@gmail.com'
