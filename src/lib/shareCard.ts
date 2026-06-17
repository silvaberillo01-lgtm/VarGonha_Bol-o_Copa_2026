// Geração de cards compartilháveis (PNG) 100% no browser, via Canvas nativo.
// Sem dependências externas e sem servidor. Cada função desenha um card no
// tema VARgonha e devolve um <canvas> pronto para baixar ou copiar.

export interface PalpiteCard {
  type: 'palpite'
  nome: string
  timeCasa: string
  timeFora: string
  golsCasa: number
  golsFora: number
  dataHora: string // texto já formatado (ex: "13/06 21:00")
  bandeiraCasa?: string | null
  bandeiraFora?: string | null
}

export interface RankingCard {
  type: 'ranking'
  nome: string
  posicao: number
  total: number
  pontos: number
}

export interface RetrospectoCard {
  type: 'retrospecto'
  nome: string
  exatos: number
  resultado: number
  parciais: number
  totalPalpites: number
  pontos: number
}

export interface CampeaoCard {
  type: 'campeao'
  nome: string
  selecao: string
  bandeira?: string | null
}

export type ShareSpec = PalpiteCard | RankingCard | RetrospectoCard | CampeaoCard

const W = 1080
const H = 1350

const GREEN_DARK = '#14532d'
const GREEN = '#166534'
const YELLOW = '#facc15'
const WHITE = '#ffffff'
const LIGHT = '#dcfce7'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, GREEN_DARK)
  grad.addColorStop(1, '#052e16')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // borda decorativa
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 10
  roundRect(ctx, 24, 24, W - 48, H - 48, 36)
  ctx.stroke()
}

function drawHeader(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.fillStyle = YELLOW
  ctx.font = 'bold 84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('🏆 VARgonha', W / 2, 170)
  ctx.fillStyle = LIGHT
  ctx.font = '600 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('Bolão da Copa 2026', W / 2, 230)
}

function drawFooter(ctx: CanvasRenderingContext2D, frase: string) {
  ctx.textAlign = 'center'
  ctx.fillStyle = YELLOW
  ctx.font = 'italic 600 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  wrapText(ctx, frase, W / 2, H - 150, W - 160, 50)
}

function drawNome(ctx: CanvasRenderingContext2D, nome: string, y: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = WHITE
  ctx.font = 'bold 60px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(nome, W / 2, y)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, yy)
}

function drawPalpite(ctx: CanvasRenderingContext2D, c: PalpiteCard) {
  drawNome(ctx, c.nome, 360)
  ctx.fillStyle = LIGHT
  ctx.font = '600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText('aposta que vai ser:', W / 2, 420)

  // Card central com o placar
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, 90, 500, W - 180, 420, 32)
  ctx.fill()

  const midY = 720
  ctx.fillStyle = WHITE
  ctx.font = 'bold 56px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  // times
  ctx.textAlign = 'center'
  ctx.fillText(`${c.bandeiraCasa || ''} ${c.timeCasa}`, W / 2, 590)
  ctx.fillText(`${c.bandeiraFora || ''} ${c.timeFora}`, W / 2, 860)

  // placar grande
  ctx.fillStyle = YELLOW
  ctx.font = 'bold 150px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`${c.golsCasa}  ×  ${c.golsFora}`, W / 2, midY + 50)

  // data
  ctx.fillStyle = LIGHT
  ctx.font = '600 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`📅 ${c.dataHora}`, W / 2, 1000)

  drawFooter(ctx, 'Pode cobrar depois 👀')
}

function drawRanking(ctx: CanvasRenderingContext2D, c: RankingCard) {
  const medalha = c.posicao === 1 ? '🥇' : c.posicao === 2 ? '🥈' : c.posicao === 3 ? '🥉' : `${c.posicao}º`
  drawNome(ctx, c.nome, 380)

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, 120, 460, W - 240, 460, 32)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.fillStyle = YELLOW
  ctx.font = 'bold 200px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(medalha, W / 2, 680)

  ctx.fillStyle = LIGHT
  ctx.font = '600 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`de ${c.total} participantes`, W / 2, 760)

  ctx.fillStyle = WHITE
  ctx.font = 'bold 70px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`${c.pontos} pts`, W / 2, 870)

  drawFooter(ctx, 'Esse é o meu posto no bolão 🪖')
}

function drawRetrospecto(ctx: CanvasRenderingContext2D, c: RetrospectoCard) {
  drawNome(ctx, c.nome, 350)
  ctx.fillStyle = LIGHT
  ctx.font = '600 36px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('meu bolão até agora', W / 2, 410)

  const rows: [string, string][] = [
    ['⭐ Placares exatos', String(c.exatos)],
    ['✅ Resultados certos', String(c.resultado)],
    ['🟡 Parciais (1 gol)', String(c.parciais)],
    ['📝 Palpites feitos', String(c.totalPalpites)],
  ]

  let y = 520
  ctx.font = '600 46px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  for (const [label, val] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, 120, y - 50, W - 240, 90, 20)
    ctx.fill()
    ctx.fillStyle = WHITE
    ctx.textAlign = 'left'
    ctx.fillText(label, 160, y + 10)
    ctx.fillStyle = YELLOW
    ctx.textAlign = 'right'
    ctx.fillText(val, W - 160, y + 10)
    y += 120
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = WHITE
  ctx.font = 'bold 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(`Total: ${c.pontos} pts`, W / 2, y + 30)

  drawFooter(ctx, 'Tô só esquentando 🔥')
}

function drawCampeao(ctx: CanvasRenderingContext2D, c: CampeaoCard) {
  drawNome(ctx, c.nome, 400)
  ctx.fillStyle = LIGHT
  ctx.font = '600 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('aposta que o campeão vai ser', W / 2, 470)

  ctx.fillStyle = YELLOW
  ctx.font = 'bold 220px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(c.bandeira || '🏆', W / 2, 730)

  ctx.fillStyle = WHITE
  ctx.font = 'bold 84px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(c.selecao, W / 2, 860)

  drawFooter(ctx, 'Anota aí: campeã da Copa 2026 🏆')
}

export function generateShareCard(spec: ShareSpec): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  drawBackground(ctx)
  drawHeader(ctx)

  switch (spec.type) {
    case 'palpite':
      drawPalpite(ctx, spec)
      break
    case 'ranking':
      drawRanking(ctx, spec)
      break
    case 'retrospecto':
      drawRetrospecto(ctx, spec)
      break
    case 'campeao':
      drawCampeao(ctx, spec)
      break
  }

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Falha ao gerar a imagem'))
    }, 'image/png')
  })
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false
    const blob = await canvasToBlob(canvas)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
