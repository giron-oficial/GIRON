// Diminui a foto no proprio celular antes de enviar (RN-37): maior lado 1600px, JPEG ~80%.
// PDF vai do jeito que esta. Se o navegador nao conseguir abrir a foto (ex.: HEIC fora do iPhone), envia original.
export async function prepararArquivo(arquivo: File): Promise<{ blob: Blob; tipo: string; extensao: string }> {
  if (arquivo.type === 'application/pdf') return { blob: arquivo, tipo: 'application/pdf', extensao: 'pdf' }
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8))
    if (blob) return { blob, tipo: 'image/jpeg', extensao: 'jpg' }
  } catch {
    // segue com o original
  }
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase()
  return { blob: arquivo, tipo: arquivo.type || 'image/jpeg', extensao: ext }
}
