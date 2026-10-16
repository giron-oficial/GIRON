// Recibo estilo impressora térmica (regra 5.7): monta as linhas do extrato e desenha numa imagem PNG
// que abre e envia normalmente pelo WhatsApp. A mesma lista de linhas vira texto puro (pra copiar).

export type LinhaRecibo =
  | { t: 'texto'; v: string; negrito?: boolean; centro?: boolean; pequeno?: boolean }
  | { t: 'par'; a: string; b: string; negrito?: boolean } // esquerda ... direita
  | { t: 'linha' } // ----------------
  | { t: 'vazio' }

const LARGURA = 384 // 58 mm de papel térmico em pixels (padrão das impressorinhas)
const MARGEM = 16
const ESCALA = 2 // imagem nítida no celular

export function reciboTexto(linhas: LinhaRecibo[]): string {
  const colunas = 32
  return linhas
    .map((l) => {
      if (l.t === 'vazio') return ''
      if (l.t === 'linha') return '-'.repeat(colunas)
      if (l.t === 'texto') return l.centro ? l.v.padStart(Math.floor((colunas + l.v.length) / 2)).trimEnd() : l.v
      const espaco = Math.max(1, colunas - l.a.length - l.b.length)
      return l.a + ' '.repeat(espaco) + l.b
    })
    .join('\n')
}

export async function reciboImagem(linhas: LinhaRecibo[]): Promise<Blob> {
  const fonte = (negrito?: boolean, pequeno?: boolean) => `${negrito ? '700' : '500'} ${pequeno ? 13 : 15}px "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`
  const altura = (l: LinhaRecibo) => (l.t === 'vazio' ? 10 : l.t === 'linha' ? 14 : l.t === 'texto' && l.pequeno ? 19 : 23)
  const total = linhas.reduce((t, l) => t + altura(l), 0) + MARGEM * 2 + 8

  const c = document.createElement('canvas')
  c.width = LARGURA * ESCALA
  c.height = total * ESCALA
  const g = c.getContext('2d')!
  g.scale(ESCALA, ESCALA)
  g.fillStyle = '#FFFDF7' // papel
  g.fillRect(0, 0, LARGURA, total)
  g.fillStyle = '#111111'
  g.textBaseline = 'top'

  let y = MARGEM + 4
  for (const l of linhas) {
    if (l.t === 'linha') {
      g.setLineDash([3, 3])
      g.strokeStyle = '#555'
      g.beginPath()
      g.moveTo(MARGEM, y + 6)
      g.lineTo(LARGURA - MARGEM, y + 6)
      g.stroke()
      g.setLineDash([])
    } else if (l.t === 'texto') {
      g.font = fonte(l.negrito, l.pequeno)
      g.textAlign = l.centro ? 'center' : 'left'
      g.fillText(l.v, l.centro ? LARGURA / 2 : MARGEM, y, LARGURA - MARGEM * 2)
    } else if (l.t === 'par') {
      g.font = fonte(l.negrito)
      g.textAlign = 'left'
      const larguraB = g.measureText(l.b).width
      g.fillText(l.a, MARGEM, y, LARGURA - MARGEM * 2 - larguraB - 8)
      g.textAlign = 'right'
      g.fillText(l.b, LARGURA - MARGEM, y)
    }
    y += altura(l)
  }
  return new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/png'))
}

// Manda a imagem pelo compartilhar do celular (WhatsApp aparece na lista). Se não der, baixa o arquivo.
export async function compartilharImagem(blob: Blob, nomeArquivo: string, titulo: string): Promise<'enviado' | 'baixado'> {
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    await nav.share({ files: [arquivo], title: titulo })
    return 'enviado'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'baixado'
}
