// Motor de chaveamento do mata-mata (Copa 2026).
//
// Tudo aqui é função PURA (sem banco), para ser usado tanto na UI quanto no
// cálculo de pontuação no servidor. A estrutura do chaveamento vem do
// calendário oficial da FIFA (v17): jogos 73..104. As letras (1A, 2B, 3ABCDF…)
// referem-se à posição final dentro de cada grupo do app (A..L); W## = vencedor
// do jogo ##; L## = perdedor do jogo ##.

export type Fase = 'grupos' | 'fase32' | 'oitavas' | 'quartas' | 'semis' | 'terceiro' | 'final'

export interface BracketMatch {
  num: number
  fase: Fase
  slot_casa: string
  slot_fora: string
}

// Template autoritativo (do PDF oficial). Ordem por número do jogo garante que
// as dependências (W##) já estejam resolvidas quando processadas em sequência.
export const BRACKET_TEMPLATE: BracketMatch[] = [
  // ROUND OF 32 / 1/16 avos
  { num: 73, fase: 'fase32', slot_casa: '2A', slot_fora: '2B' },
  { num: 74, fase: 'fase32', slot_casa: '1E', slot_fora: '3ABCDF' },
  { num: 75, fase: 'fase32', slot_casa: '1F', slot_fora: '2C' },
  { num: 76, fase: 'fase32', slot_casa: '1C', slot_fora: '2F' },
  { num: 77, fase: 'fase32', slot_casa: '1I', slot_fora: '3CDFGH' },
  { num: 78, fase: 'fase32', slot_casa: '2E', slot_fora: '2I' },
  { num: 79, fase: 'fase32', slot_casa: '1A', slot_fora: '3CEFHI' },
  { num: 80, fase: 'fase32', slot_casa: '1L', slot_fora: '3EHIJK' },
  { num: 81, fase: 'fase32', slot_casa: '1D', slot_fora: '3BEFIJ' },
  { num: 82, fase: 'fase32', slot_casa: '1G', slot_fora: '3AEHIJ' },
  { num: 83, fase: 'fase32', slot_casa: '2K', slot_fora: '2L' },
  { num: 84, fase: 'fase32', slot_casa: '1H', slot_fora: '2J' },
  { num: 85, fase: 'fase32', slot_casa: '1B', slot_fora: '3EFGIJ' },
  { num: 86, fase: 'fase32', slot_casa: '1J', slot_fora: '2H' },
  { num: 87, fase: 'fase32', slot_casa: '1K', slot_fora: '3DEIJL' },
  { num: 88, fase: 'fase32', slot_casa: '2D', slot_fora: '2G' },
  // ROUND OF 16 / oitavas
  { num: 89, fase: 'oitavas', slot_casa: 'W74', slot_fora: 'W77' },
  { num: 90, fase: 'oitavas', slot_casa: 'W73', slot_fora: 'W75' },
  { num: 91, fase: 'oitavas', slot_casa: 'W76', slot_fora: 'W78' },
  { num: 92, fase: 'oitavas', slot_casa: 'W79', slot_fora: 'W80' },
  { num: 93, fase: 'oitavas', slot_casa: 'W83', slot_fora: 'W84' },
  { num: 94, fase: 'oitavas', slot_casa: 'W81', slot_fora: 'W82' },
  { num: 95, fase: 'oitavas', slot_casa: 'W86', slot_fora: 'W88' },
  { num: 96, fase: 'oitavas', slot_casa: 'W85', slot_fora: 'W87' },
  // QUARTAS
  { num: 97, fase: 'quartas', slot_casa: 'W89', slot_fora: 'W90' },
  { num: 98, fase: 'quartas', slot_casa: 'W93', slot_fora: 'W94' },
  { num: 99, fase: 'quartas', slot_casa: 'W91', slot_fora: 'W92' },
  { num: 100, fase: 'quartas', slot_casa: 'W95', slot_fora: 'W96' },
  // SEMIS
  { num: 101, fase: 'semis', slot_casa: 'W97', slot_fora: 'W98' },
  { num: 102, fase: 'semis', slot_casa: 'W99', slot_fora: 'W100' },
  // TERCEIRO (bronze) e FINAL
  { num: 103, fase: 'terceiro', slot_casa: 'L101', slot_fora: 'L102' },
  { num: 104, fase: 'final', slot_casa: 'W101', slot_fora: 'W102' },
]

export function matchCode(num: number): string {
  return `M${num}`
}

// Os 8 slots de terceiros: cada um aceita o terceiro de um subconjunto de grupos.
export const THIRD_SLOTS: { code: string; eligible: string[] }[] = [
  { code: '3ABCDF', eligible: ['A', 'B', 'C', 'D', 'F'] },
  { code: '3CDFGH', eligible: ['C', 'D', 'F', 'G', 'H'] },
  { code: '3CEFHI', eligible: ['C', 'E', 'F', 'H', 'I'] },
  { code: '3EHIJK', eligible: ['E', 'H', 'I', 'J', 'K'] },
  { code: '3BEFIJ', eligible: ['B', 'E', 'F', 'I', 'J'] },
  { code: '3AEHIJ', eligible: ['A', 'E', 'H', 'I', 'J'] },
  { code: '3EFGIJ', eligible: ['E', 'F', 'G', 'I', 'J'] },
  { code: '3DEIJL', eligible: ['D', 'E', 'I', 'J', 'L'] },
]

export interface GroupGameResult {
  grupo: string
  time_casa: string
  time_fora: string
  gols_casa: number
  gols_fora: number
}

export interface TeamStanding {
  team: string
  group: string
  played: number
  points: number
  gd: number
  gf: number
}

interface MutableStanding extends TeamStanding {
  // guardado para desempate por confronto direto
}

// Confronto direto (head-to-head) entre um conjunto de times empatados.
function headToHead(
  teams: string[],
  games: GroupGameResult[],
): Record<string, { points: number; gd: number; gf: number }> {
  const set = new Set(teams)
  const tbl: Record<string, { points: number; gd: number; gf: number }> = {}
  teams.forEach((t) => (tbl[t] = { points: 0, gd: 0, gf: 0 }))
  for (const g of games) {
    if (!set.has(g.time_casa) || !set.has(g.time_fora)) continue
    tbl[g.time_casa].gf += g.gols_casa
    tbl[g.time_fora].gf += g.gols_fora
    tbl[g.time_casa].gd += g.gols_casa - g.gols_fora
    tbl[g.time_fora].gd += g.gols_fora - g.gols_casa
    if (g.gols_casa > g.gols_fora) tbl[g.time_casa].points += 3
    else if (g.gols_fora > g.gols_casa) tbl[g.time_fora].points += 3
    else {
      tbl[g.time_casa].points += 1
      tbl[g.time_fora].points += 1
    }
  }
  return tbl
}

// Ordena um grupo aplicando os critérios oficiais: pontos > SG > GP > confronto
// direto (pontos > SG > GP) > nome (desempate determinístico final).
function sortGroup(teams: MutableStanding[], games: GroupGameResult[]): MutableStanding[] {
  const base = teams.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.team.localeCompare(b.team)
  })

  // Reordena blocos empatados em (pontos, SG, GP) pelo confronto direto.
  const result: MutableStanding[] = []
  let i = 0
  while (i < base.length) {
    let j = i + 1
    while (
      j < base.length &&
      base[j].points === base[i].points &&
      base[j].gd === base[i].gd &&
      base[j].gf === base[i].gf
    )
      j++
    const tied = base.slice(i, j)
    if (tied.length > 1) {
      const h2h = headToHead(tied.map((t) => t.team), games)
      tied.sort((a, b) => {
        const ha = h2h[a.team]
        const hb = h2h[b.team]
        if (hb.points !== ha.points) return hb.points - ha.points
        if (hb.gd !== ha.gd) return hb.gd - ha.gd
        if (hb.gf !== ha.gf) return hb.gf - ha.gf
        return a.team.localeCompare(b.team)
      })
    }
    result.push(...tied)
    i = j
  }
  return result
}

// Calcula a classificação de cada grupo a partir dos resultados (palpitados ou
// reais). Se `champion` for informado e estiver num grupo, ele é forçado para a
// 1ª posição (regra "campeão avança em todas as fases").
export function computeGroupStandings(
  games: GroupGameResult[],
  champion?: string | null,
): Record<string, TeamStanding[]> {
  const byGroup: Record<string, Record<string, MutableStanding>> = {}

  const ensure = (grupo: string, team: string) => {
    byGroup[grupo] = byGroup[grupo] || {}
    if (!byGroup[grupo][team]) {
      byGroup[grupo][team] = { team, group: grupo, played: 0, points: 0, gd: 0, gf: 0 }
    }
    return byGroup[grupo][team]
  }

  for (const g of games) {
    const c = ensure(g.grupo, g.time_casa)
    const f = ensure(g.grupo, g.time_fora)
    c.played++
    f.played++
    c.gf += g.gols_casa
    f.gf += g.gols_fora
    c.gd += g.gols_casa - g.gols_fora
    f.gd += g.gols_fora - g.gols_casa
    if (g.gols_casa > g.gols_fora) c.points += 3
    else if (g.gols_fora > g.gols_casa) f.points += 3
    else {
      c.points += 1
      f.points += 1
    }
  }

  const out: Record<string, TeamStanding[]> = {}
  const groupGamesOf = (grupo: string) => games.filter((x) => x.grupo === grupo)

  for (const grupo of Object.keys(byGroup)) {
    let ordered = sortGroup(Object.values(byGroup[grupo]), groupGamesOf(grupo))
    if (champion) {
      const idx = ordered.findIndex((t) => t.team === champion)
      if (idx > 0) {
        const [champ] = ordered.splice(idx, 1)
        ordered.unshift(champ)
      }
    }
    out[grupo] = ordered.map((t) => ({ ...t }))
  }
  return out
}

// Ranqueia os terceiros colocados e devolve os 8 melhores (critérios oficiais).
export function selectBestThirds(
  standings: Record<string, TeamStanding[]>,
): TeamStanding[] {
  const thirds: TeamStanding[] = []
  for (const grupo of Object.keys(standings)) {
    if (standings[grupo][2]) thirds.push(standings[grupo][2])
  }
  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.gd !== a.gd) return b.gd - a.gd
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.group.localeCompare(b.group)
  })
  return thirds.slice(0, 8)
}

// Atribui os 8 melhores terceiros aos 8 slots respeitando a elegibilidade de
// cada slot (matching bijetivo determinístico). Devolve slotCode -> time.
export function assignThirds(bestThirds: TeamStanding[]): Record<string, string> {
  const result: Record<string, string> = {}
  const used = new Set<number>()

  const bt = (slotIdx: number): boolean => {
    if (slotIdx === THIRD_SLOTS.length) return true
    const slot = THIRD_SLOTS[slotIdx]
    for (let j = 0; j < bestThirds.length; j++) {
      if (used.has(j)) continue
      if (!slot.eligible.includes(bestThirds[j].group)) continue
      used.add(j)
      result[slot.code] = bestThirds[j].team
      if (bt(slotIdx + 1)) return true
      used.delete(j)
      delete result[slot.code]
    }
    return false
  }

  bt(0)
  return result
}

export interface ResolvedMatch {
  num: number
  fase: Fase
  time_casa: string | null
  time_fora: string | null
  classificado: string | null // quem o usuário (ou regra) faz avançar
}

// Palpites do usuário no mata-mata, por número de jogo.
export interface KnockoutPick {
  classificado_palpite?: string | null
  gols_casa?: number | null
  gols_fora?: number | null
}

// Resolve TODO o chaveamento de um usuário a partir dos palpites de grupos +
// dos palpites de mata-mata já feitos + do palpite de campeão.
export function computeUserBracket(
  groupGames: GroupGameResult[],
  knockoutPicks: Record<number, KnockoutPick>,
  champion?: string | null,
): Record<number, ResolvedMatch> {
  const standings = computeGroupStandings(groupGames, champion)
  const thirds = assignThirds(selectBestThirds(standings))

  const winners: Record<number, string | null> = {}
  const losers: Record<number, string | null> = {}
  const out: Record<number, ResolvedMatch> = {}

  const resolveSlot = (code: string): string | null => {
    if (code.startsWith('W')) return winners[parseInt(code.slice(1))] ?? null
    if (code.startsWith('L')) return losers[parseInt(code.slice(1))] ?? null
    if (code.startsWith('3')) return thirds[code] ?? null
    // 1A / 2B
    const pos = parseInt(code[0]) - 1
    const grupo = code.slice(1)
    return standings[grupo]?.[pos]?.team ?? null
  }

  for (const m of BRACKET_TEMPLATE) {
    const time_casa = resolveSlot(m.slot_casa)
    const time_fora = resolveSlot(m.slot_fora)
    const pick = knockoutPicks[m.num] || {}

    // Quem avança: campeão sempre avança (sobrepõe); senão o palpite do usuário;
    // só vale se for um dos dois times do confronto.
    let classificado: string | null = null
    if (champion && (champion === time_casa || champion === time_fora)) {
      classificado = champion
    } else if (
      pick.classificado_palpite &&
      (pick.classificado_palpite === time_casa || pick.classificado_palpite === time_fora)
    ) {
      classificado = pick.classificado_palpite
    }

    out[m.num] = { num: m.num, fase: m.fase, time_casa, time_fora, classificado }

    if (classificado && time_casa && time_fora) {
      winners[m.num] = classificado
      losers[m.num] = classificado === time_casa ? time_fora : time_casa
    } else {
      winners[m.num] = null
      losers[m.num] = null
    }
  }

  return out
}
