// Layout do chaveamento: ordena os jogos VERTICALMENTE como numa chave de
// verdade, para que os dois alimentadores de cada confronto fiquem adjacentes
// (ex.: vencedor do jogo 74 e do jogo 77 ficam um sobre o outro, formando o
// jogo 89 das oitavas). A ordem natural por número (73,74,...) NÃO faz isso —
// por isso derivamos a ordem por uma DFS in-order a partir da final.

import { BRACKET_TEMPLATE, Fase } from './bracket'

const BY_NUM = new Map(BRACKET_TEMPLATE.map((m) => [m.num, m]))

// Jogos que alimentam um confronto (slots W##). Slots de grupo (1A/3ABC) e
// de perdedor (L##) não contam como "filhos" na árvore principal.
function feeders(num: number): number[] {
  const m = BY_NUM.get(num)
  if (!m) return []
  const out: number[] = []
  for (const s of [m.slot_casa, m.slot_fora]) {
    if (s.startsWith('W')) out.push(parseInt(s.slice(1)))
  }
  return out
}

export interface BracketRound {
  fase: Fase
  label: string
  nums: number[]
}

const FASE_LABEL: Record<string, string> = {
  fase32: '16 avos',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semis: 'Semifinal',
  final: 'Final',
  terceiro: '3º lugar',
}

// Colunas da esquerda (16 avos) para a direita (final), cada uma com os jogos
// já na ordem vertical correta do chaveamento.
export function getBracketRounds(): BracketRound[] {
  const buckets: Record<number, number[]> = {}

  // DFS in-order: filho de cima -> nó -> filho de baixo. Isso empilha cada
  // profundidade (fase) na ordem vertical de cima para baixo.
  const visit = (num: number, depth: number) => {
    const kids = feeders(num)
    if (kids[0] != null) visit(kids[0], depth + 1)
    ;(buckets[depth] = buckets[depth] || []).push(num)
    if (kids[1] != null) visit(kids[1], depth + 1)
  }
  visit(104, 0) // final

  // Profundidade maior = mais perto das folhas (16 avos) => coluna da esquerda.
  const depths = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => b - a)

  return depths.map((d) => {
    const nums = buckets[d]
    const fase = BY_NUM.get(nums[0])!.fase
    return { fase, label: FASE_LABEL[fase] ?? fase, nums }
  })
}

// Texto amigável para um slot ainda indefinido.
//   '1A'      -> '1º A'
//   '2B'      -> '2º B'
//   '3ABCDF'  -> '3º (A·B·C·D·F)'
//   'W74'     -> 'Vencedor 74'
//   'L101'    -> 'Perdedor 101'
export function friendlySlot(code: string): string {
  if (!code) return '—'
  if (code.startsWith('W')) return `Vencedor ${code.slice(1)}`
  if (code.startsWith('L')) return `Perdedor ${code.slice(1)}`
  if (code.startsWith('3')) {
    const grupos = code.slice(1).split('').join('·')
    return `3º (${grupos})`
  }
  const pos = code[0]
  const grupo = code.slice(1)
  return `${pos}º ${grupo}`
}

export { BRACKET_TEMPLATE }
