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

export interface JogoPalpite {
  nome: string
  golsCasa: number
  golsFora: number
  pontos: number | null // null = jogo ainda não encerrado
}

export interface JogoCard {
  type: 'jogo'
  timeCasa: string
  timeFora: string
  bandeiraCasa?: string | null
  bandeiraFora?: string | null
  golsCasaReal?: number | null
  golsForaReal?: number | null
  encerrado: boolean
  statusText: string
  subtitulo: string // ex: "Grupo J • Rod. 1 • 01:00"
  palpites: JogoPalpite[]
}

export type ShareSpec = PalpiteCard | RankingCard | RetrospectoCard | CampeaoCard | JogoCard

const W = 1080
const DEFAULT_H = 1350

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

function drawBackground(ctx: CanvasRenderingContext2D, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, GREEN_DARK)
  grad.addColorStop(1, '#052e16')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, h)

  // borda decorativa
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 10
  roundRect(ctx, 24, 24, W - 48, h - 48, 36)
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

function drawFooter(ctx: CanvasRenderingContext2D, frase: string, h: number) {
  ctx.textAlign = 'center'
  ctx.fillStyle = YELLOW
  ctx.font = 'italic 600 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  wrapText(ctx, frase, W / 2, h - 110, W - 160, 50)
}

// Reduz a fonte até o texto caber em maxWidth (mantém o peso/sufixo do template).
function drawFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  weight: string,
  startSize: number,
  minSize = 28,
) {
  let size = startSize
  do {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 4
  } while (size > minSize)
  ctx.fillText(text, x, y)
}

function pontosBadgeColor(pontos: number): { bg: string; fg: string } {
  if (pontos === 15) return { bg: '#fef9c3', fg: '#a16207' }
  if (pontos === 10) return { bg: '#dcfce7', fg: '#15803d' }
  if (pontos === 5) return { bg: '#dbeafe', fg: '#1d4ed8' }
  return { bg: '#fee2e2', fg: '#b91c1c' }
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

  drawFooter(ctx, 'Pode cobrar depois 👀', DEFAULT_H)
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

  drawFooter(ctx, 'Esse é o meu posto no bolão 🪖', DEFAULT_H)
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

  drawFooter(ctx, 'Tô só esquentando 🔥', DEFAULT_H)
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

  drawFooter(ctx, 'Anota aí: campeã da Copa 2026 🏆', DEFAULT_H)
}

// Layout da grade de palpites do card de jogo.
const JOGO_TOP = 560 // onde começa a grade de palpites
const JOGO_ROW_H = 84
const JOGO_FOOTER = 200

function jogoHeight(c: JogoCard): number {
  const linhas = Math.ceil(c.palpites.length / 2)
  return JOGO_TOP + Math.max(linhas, 1) * JOGO_ROW_H + JOGO_FOOTER
}

function drawJogo(ctx: CanvasRenderingContext2D, c: JogoCard, h: number) {
  // Subtítulo (grupo / rodada / horário)
  ctx.textAlign = 'center'
  ctx.fillStyle = LIGHT
  ctx.font = '600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(c.subtitulo, W / 2, 300)

  // Placar / confronto numa linha que se ajusta à largura
  const placar = c.encerrado ? `${c.golsCasaReal} × ${c.golsForaReal}` : '×'
  const linha = `${c.bandeiraCasa || ''} ${c.timeCasa}   ${placar}   ${c.timeFora} ${c.bandeiraFora || ''}`
  ctx.fillStyle = WHITE
  drawFitText(ctx, linha, W / 2, 400, W - 140, 'bold', 64, 30)

  // Selo de status
  ctx.fillStyle = c.encerrado ? '#86efac' : '#fca5a5'
  ctx.font = '700 30px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.fillText(c.statusText, W / 2, 460)

  // Título da seção
  ctx.fillStyle = YELLOW
  ctx.font = '700 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`👥 Palpites (${c.palpites.length})`, 70, 525)

  // Grade de palpites (2 colunas)
  const margin = 70
  const gap = 24
  const colW = (W - margin * 2 - gap) / 2
  const cellH = 68

  c.palpites.forEach((p, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = margin + col * (colW + gap)
    const y = JOGO_TOP + row * JOGO_ROW_H

    // fundo da célula
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, x, y, colW, cellH, 16)
    ctx.fill()

    // nome
    ctx.fillStyle = WHITE
    ctx.textAlign = 'left'
    ctx.font = '600 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    const placarTxt = `${p.golsCasa}×${p.golsFora}`
    const badgeTxt = p.pontos !== null ? `+${p.pontos}` : ''
    // largura reservada à direita para placar+badge
    const rightW = badgeTxt ? 200 : 130
    let nome = p.nome
    while (ctx.measureText(nome).width > colW - rightW - 40 && nome.length > 1) {
      nome = nome.slice(0, -1)
    }
    if (nome !== p.nome) nome = nome.trimEnd() + '…'
    ctx.fillText(nome, x + 24, y + cellH / 2 + 11)

    // placar
    ctx.textAlign = 'right'
    ctx.fillStyle = YELLOW
    ctx.font = 'bold 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    const badgeX = x + colW - 20
    const placarX = badgeTxt ? badgeX - 90 : badgeX
    ctx.fillText(placarTxt, placarX, y + cellH / 2 + 12)

    // badge de pontos
    if (p.pontos !== null) {
      const { bg, fg } = pontosBadgeColor(p.pontos)
      const bw = 78
      const bh = 40
      const bx = x + colW - bw - 16
      const by = y + (cellH - bh) / 2
      ctx.fillStyle = bg
      roundRect(ctx, bx, by, bw, bh, 12)
      ctx.fill()
      ctx.fillStyle = fg
      ctx.font = 'bold 26px system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(badgeTxt, bx + bw / 2, by + bh / 2 + 9)
    }
  })

  drawFooter(ctx, c.encerrado ? 'Quem mandou bem? 👀' : 'Tá lançado, sem choro depois 😎', h)
}

export function generateShareCard(spec: ShareSpec): HTMLCanvasElement {
  const h = spec.type === 'jogo' ? jogoHeight(spec) : DEFAULT_H

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  drawBackground(ctx, h)
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
    case 'jogo':
      drawJogo(ctx, spec, h)
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

// Indica se dá pra compartilhar uma imagem pela folha nativa (WhatsApp etc.).
export function canShareImage(): boolean {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare) return false
    const probe = new File([new Blob([''], { type: 'image/png' })], 'probe.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'error'

// Abre a folha de compartilhamento nativa do dispositivo já com a imagem
// anexada — no celular isso inclui o WhatsApp diretamente.
export async function shareCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  texto: string,
): Promise<ShareResult> {
  try {
    if (typeof navigator === 'undefined' || !navigator.share) return 'unsupported'
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare && !navigator.canShare({ files: [file] })) return 'unsupported'
    await navigator.share({ files: [file], text: texto })
    return 'shared'
  } catch (err) {
    // O usuário cancelar a folha de compartilhamento dispara AbortError.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'error'
  }
}
