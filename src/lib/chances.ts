// Chances de título/pódio no bolão — SOMENTE exibição.
//
// Nada aqui grava no banco nem interfere na pontuação oficial: tudo é
// derivado, em memória, dos dados que já existem (jogos, palpites, campeão,
// especiais). Se este arquivo sumir amanhã, nenhum ponto muda.
//
// Duas saídas por participante:
//
// 1. `max_pontos` — teto matemático: pontuação máxima ainda alcançável.
//    Para cada jogo sem resultado, o máximo depende do cenário de chaveamento
//    ainda possível (se o time do palpite já foi eliminado daquele slot, o
//    teto cai para o do cenário B/C — ver scoring.ts). Soma ainda o bônus de
//    campeão (se o palpite ainda pode ser campeão no chaveamento REAL) e os
//    prêmios pendentes (artilheiro/melhor jogador sem avaliação do admin).
//    Quem tem teto menor que a pontuação fechada do líder está
//    matematicamente fora — mesmo gabaritando tudo não alcança.
//
// 2. `prob_titulo` / `prob_podio` — estimativa por simulação (Monte Carlo):
//    sorteia placares para os jogos restantes (gols ~ Poisson, pênaltis 50/50
//    em empate), propaga os vencedores pelo chaveamento oficial, pontua os
//    palpites de todo mundo com as MESMAS funções da pontuação oficial
//    (calcularPontos / calcularPontosMataMata), aplica o bônus de campeão do
//    cenário sorteado e sorteia os prêmios pendentes com peso proporcional à
//    quantidade de palpites iguais. A fração de cenários em que o
//    participante termina em 1º (ou no top 3) vira a probabilidade.

import { BRACKET_TEMPLATE } from './bracket'
import {
  BONUS_CAMPEAO,
  DEADLINE_FASE1,
  KNOCKOUT_LOCK_OFFSET_MIN,
  calcularPontos,
  calcularPontosMataMata,
} from './scoring'
import { normalizeTeam } from './teams'

export interface ChanceGame {
  id: string
  fase: string
  match_code: string | null
  data_hora: string
  time_casa: string | null
  time_fora: string | null
  gols_casa_real: number | null
  gols_fora_real: number | null
  classificado_real: string | null
  resultado_lancado: boolean
}

export interface ChancePrediction {
  user_id: string
  game_id: string
  gols_casa: number
  gols_fora: number
  time_casa_palpite: string | null
  time_fora_palpite: string | null
  classificado_palpite: string | null
}

export interface ChanceUser {
  user_id: string
  // Base sólida: só jogos encerrados (parciais ao vivo ficam de fora, senão o
  // teto contaria duas vezes o jogo em andamento).
  total_pontos_fechado: number
  acertos_exatos: number
  acertos_resultado: number
  acertos_parciais: number
}

// Prêmio ainda não avaliado pelo admin (acertou IS NULL). `valor` vem da
// copa_config (artilheiro_pontos / melhor_jogador_pontos).
export interface PendingSpecial {
  user_id: string
  tipo: string
  palpite: string
  valor: number
}

export interface UserChance {
  max_pontos: number
  vivo_titulo: boolean
  vivo_podio: boolean
  // Garantia MATEMÁTICA (não é estimativa): verdadeiro só quando nem no pior
  // caso para o participante e no melhor caso para os concorrentes dá pra
  // ser alcançado — ver `titulo_garantido`/`podio_garantido` mais abaixo.
  titulo_garantido: boolean
  podio_garantido: boolean
  prob_titulo: number
  prob_podio: number
}

// ---------------------------------------------------------------------------
// Quais times ainda podem aparecer em cada slot do chaveamento real
// ---------------------------------------------------------------------------

// null = ainda indeterminado (não dá para descartar ninguém).
type TeamSet = Set<string> | null

interface MatchPossibility {
  casa: TeamSet
  fora: TeamSet
  winner: TeamSet
  loser: TeamSet
}

function unionSets(a: TeamSet, b: TeamSet): TeamSet {
  if (!a || !b) return null
  const s = new Set(a)
  b.forEach((t) => s.add(t))
  return s
}

function inSet(team: string | null, set: TeamSet): boolean {
  if (!team) return false
  if (!set) return true // indeterminado: não dá para descartar
  return set.has(team)
}

function matchNum(g: ChanceGame): number | null {
  if (!g.match_code) return null
  const n = parseInt(g.match_code.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// Vencedor de um jogo já encerrado (classificado lançado ou, na falta, gols).
function decidedWinner(g: ChanceGame): string | null {
  const cl = normalizeTeam(g.classificado_real)
  if (cl) return cl
  if (g.gols_casa_real == null || g.gols_fora_real == null) return null
  if (g.gols_casa_real > g.gols_fora_real) return normalizeTeam(g.time_casa)
  if (g.gols_fora_real > g.gols_casa_real) return normalizeTeam(g.time_fora)
  return null
}

function computePossibilities(games: ChanceGame[]): Record<number, MatchPossibility> {
  const byNum = new Map<number, ChanceGame>()
  for (const g of games) {
    const n = matchNum(g)
    if (n != null) byNum.set(n, g)
  }

  const poss: Record<number, MatchPossibility> = {}
  const slotSet = (code: string): TeamSet => {
    if (code.startsWith('W')) return poss[parseInt(code.slice(1), 10)]?.winner ?? null
    if (code.startsWith('L')) return poss[parseInt(code.slice(1), 10)]?.loser ?? null
    // Slots de grupo (1A/2B/3ABCDF): a fase32 usa os times reais do jogo; se o
    // admin ainda não lançou, fica indeterminado.
    return null
  }

  for (const m of BRACKET_TEMPLATE) {
    const g = byNum.get(m.num)
    const casaReal = normalizeTeam(g?.time_casa ?? null)
    const foraReal = normalizeTeam(g?.time_fora ?? null)
    // Time já lançado pelo admin vale mais que a derivação pelo template.
    const casa: TeamSet = casaReal ? new Set([casaReal]) : slotSet(m.slot_casa)
    const fora: TeamSet = foraReal ? new Set([foraReal]) : slotSet(m.slot_fora)

    if (g?.resultado_lancado) {
      const w = decidedWinner(g)
      const l = w ? (w === casaReal ? foraReal : casaReal) : null
      poss[m.num] = {
        casa,
        fora,
        winner: w ? new Set([w]) : unionSets(casa, fora),
        loser: l ? new Set([l]) : unionSets(casa, fora),
      }
    } else {
      const both = unionSets(casa, fora)
      poss[m.num] = { casa, fora, winner: both, loser: both }
    }
  }
  return poss
}

// ---------------------------------------------------------------------------
// Teto de pontos por jogo
// ---------------------------------------------------------------------------

function isLockedByTime(g: ChanceGame, now: Date): boolean {
  if (g.fase === 'grupos') return now > DEADLINE_FASE1
  return now.getTime() > new Date(g.data_hora).getTime() - KNOCKOUT_LOCK_OFFSET_MIN * 60_000
}

// Máximo que um palpite ainda pode render num jogo sem resultado.
function maxPontosJogo(
  g: ChanceGame,
  pred: ChancePrediction | undefined,
  poss: Record<number, MatchPossibility>,
  now: Date,
): number {
  if (g.fase === 'grupos') {
    // Sem palpite e com deadline vencido não há o que pontuar.
    return pred || !isLockedByTime(g, now) ? 15 : 0
  }

  // Mata-mata: sem palpite ainda dá para palpitar até 30 min antes do jogo.
  if (!pred) return isLockedByTime(g, now) ? 0 : 25

  const n = matchNum(g)
  const p = n != null ? poss[n] : undefined
  const casaOk = inSet(normalizeTeam(pred.time_casa_palpite), p?.casa ?? null)
  const foraOk = inSet(normalizeTeam(pred.time_fora_palpite), p?.fora ?? null)
  const acertos = (casaOk ? 1 : 0) + (foraOk ? 1 : 0)
  // Tetos dos cenários A/B/C da tabela de multiplicadores (scoring.ts).
  return acertos === 2 ? 25 : acertos === 1 ? 18 : 6
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return Math.min(k - 1, 6)
}

// Média de gols por time num jogo de Copa (~2.5 no total).
const GOLS_LAMBDA = 1.25

interface SpecialPool {
  // Cada opção é um palpite distinto; peso = nº de pessoas que o fizeram
  // ("sabedoria da torcida"). Uma opção extra "outro" (peso 1) representa o
  // prêmio sair para alguém que ninguém palpitou.
  options: { weight: number; members: { userIdx: number; valor: number }[] }[]
  totalWeight: number
}

export function computeChances(params: {
  games: ChanceGame[]
  predictions: ChancePrediction[] // apenas de jogos ainda sem resultado
  users: ChanceUser[]
  championPicks: Record<string, string | null>
  championSettled: boolean
  pendingSpecials: PendingSpecial[]
  sims?: number
  now?: Date
  rng?: () => number
}): Record<string, UserChance> {
  const {
    games,
    predictions,
    users,
    championPicks,
    championSettled,
    pendingSpecials,
    sims = 3000,
    now = new Date(),
    rng = Math.random,
  } = params

  if (users.length === 0) return {}

  const poss = computePossibilities(games)
  const openGames = games.filter((g) => !g.resultado_lancado)

  const idxByUser = new Map(users.map((u, i) => [u.user_id, i]))
  const predByGame = new Map<string, Map<number, ChancePrediction>>()
  for (const pr of predictions) {
    const uIdx = idxByUser.get(pr.user_id)
    if (uIdx == null) continue
    let m = predByGame.get(pr.game_id)
    if (!m) predByGame.set(pr.game_id, (m = new Map()))
    m.set(uIdx, pr)
  }

  const champPick = users.map((u) => normalizeTeam(championPicks[u.user_id] ?? null))

  // ---- Teto de pontos -----------------------------------------------------
  const maxPontos = users.map((u, i) => {
    let max = u.total_pontos_fechado
    for (const g of openGames) {
      max += maxPontosJogo(g, predByGame.get(g.id)?.get(i), poss, now)
    }
    if (!championSettled && inSet(champPick[i], poss[104]?.winner ?? null)) {
      max += BONUS_CAMPEAO
    }
    for (const sp of pendingSpecials) {
      if (sp.user_id === u.user_id) max += sp.valor
    }
    return max
  })

  // Matematicamente vivo: o teto alcança a pontuação FECHADA de quem hoje
  // ocupa o 1º (título) ou o 3º (pódio) lugar — quem está na frente nunca
  // perde ponto, então abaixo disso não há milagre.
  const fechadoDesc = users
    .map((u) => u.total_pontos_fechado)
    .sort((a, b) => b - a)
  const pontosLider = fechadoDesc[0]
  const pontosTerceiro = fechadoDesc[Math.min(2, fechadoDesc.length - 1)]

  // ---- Garantia matemática (pior caso PRÓPRIO x melhor caso ALHEIO) -------
  //
  // total_pontos_fechado é o PISO de cada um: já é o "eu erro tudo daqui pra
  // frente" (jogos ainda sem resultado somam 0, exatamente como pedido).
  // max_pontos é o TETO de cada concorrente: o melhor cenário possível pra
  // ele. Se, mesmo no seu pior caso, nenhum concorrente alcança nem empata
  // com você no melhor caso DELE, está garantido de verdade — não é a
  // simulação "não ter sorteado" o azar, é matematicamente impossível.
  //
  // Empate conta como ameaça (conservador): não sabemos como o desempate por
  // acertos vai se comportar em jogos que ainda vão rolar.
  const ameacas = users.map((u, i) =>
    users.reduce((n, _, j) => (j !== i && maxPontos[j] >= u.total_pontos_fechado ? n + 1 : n), 0),
  )
  const tituloGarantido = ameacas.map((n) => n === 0)
  const podioGarantido = ameacas.map((n) => n <= 2)

  // ---- Monte Carlo --------------------------------------------------------
  const knockoutByNum = new Map<number, ChanceGame>()
  for (const g of games) {
    const n = matchNum(g)
    if (n != null) knockoutByNum.set(n, g)
  }
  const openGroupGames = openGames.filter((g) => g.fase === 'grupos')

  // Pools dos prêmios pendentes, por tipo.
  const pools: SpecialPool[] = []
  {
    const byTipo = new Map<string, PendingSpecial[]>()
    for (const sp of pendingSpecials) {
      if (!idxByUser.has(sp.user_id)) continue
      const list = byTipo.get(sp.tipo) ?? []
      list.push(sp)
      byTipo.set(sp.tipo, list)
    }
    byTipo.forEach((list) => {
      const byPalpite = new Map<string, { userIdx: number; valor: number }[]>()
      for (const sp of list) {
        const key = sp.palpite.trim().toLowerCase()
        const members = byPalpite.get(key) ?? []
        members.push({ userIdx: idxByUser.get(sp.user_id)!, valor: sp.valor })
        byPalpite.set(key, members)
      }
      const options = Array.from(byPalpite.values()).map((members) => ({
        weight: members.length,
        members,
      }))
      // "Outro": o prêmio sai para um jogador que ninguém palpitou.
      options.push({ weight: 1, members: [] })
      pools.push({ options, totalWeight: options.reduce((s, o) => s + o.weight, 0) })
    })
  }

  const nUsers = users.length
  const winCount = new Array<number>(nUsers).fill(0)
  const top3Count = new Array<number>(nUsers).fill(0)
  const order = users.map((_, i) => i)

  for (let s = 0; s < sims; s++) {
    const pts = users.map((u) => u.total_pontos_fechado)

    // Grupos ainda abertos (só existe no começo da Copa): sorteia o placar e
    // pontua direto — a classificação dos grupos não é propagada aqui, então
    // nesse período a simulação cobre grupos + campeão, e o mata-mata só
    // depois que a fase32 for lançada.
    for (const g of openGroupGames) {
      const gc = poisson(GOLS_LAMBDA, rng)
      const gf = poisson(GOLS_LAMBDA, rng)
      predByGame.get(g.id)?.forEach((pr, uIdx) => {
        pts[uIdx] += calcularPontos(pr.gols_casa, pr.gols_fora, gc, gf)
      })
    }

    // Mata-mata em ordem de jogo: resultados reais valem; o resto é sorteado
    // e o vencedor propaga para as fases seguintes.
    const winners: Record<number, string | null> = {}
    const losers: Record<number, string | null> = {}
    const resolveSlot = (code: string): string | null => {
      if (code.startsWith('W')) return winners[parseInt(code.slice(1), 10)] ?? null
      if (code.startsWith('L')) return losers[parseInt(code.slice(1), 10)] ?? null
      return null
    }

    for (const m of BRACKET_TEMPLATE) {
      const g = knockoutByNum.get(m.num)
      const casa = normalizeTeam(g?.time_casa ?? null) ?? resolveSlot(m.slot_casa)
      const fora = normalizeTeam(g?.time_fora ?? null) ?? resolveSlot(m.slot_fora)

      if (g?.resultado_lancado) {
        const w = decidedWinner(g)
        winners[m.num] = w
        losers[m.num] = w ? (w === casa ? fora : casa) : null
        continue
      }

      if (!casa || !fora) {
        // Confronto ainda indeterminável (ex.: grupos em andamento).
        winners[m.num] = null
        losers[m.num] = null
        continue
      }

      const gc = poisson(GOLS_LAMBDA, rng)
      const gf = poisson(GOLS_LAMBDA, rng)
      // Empate no tempo normal: pênaltis, moeda honesta.
      const w = gc > gf ? casa : gf > gc ? fora : rng() < 0.5 ? casa : fora
      winners[m.num] = w
      losers[m.num] = w === casa ? fora : casa

      if (!g) continue
      predByGame.get(g.id)?.forEach((pr, uIdx) => {
        pts[uIdx] += calcularPontosMataMata(pr, {
          time_casa_real: casa,
          time_fora_real: fora,
          classificado_real: w,
          gols_casa_real: gc,
          gols_fora_real: gf,
        })
      })
    }

    // Bônus de campeão do cenário sorteado.
    if (!championSettled && winners[104]) {
      for (let i = 0; i < nUsers; i++) {
        if (champPick[i] && champPick[i] === winners[104]) pts[i] += BONUS_CAMPEAO
      }
    }

    // Prêmios pendentes.
    for (const pool of pools) {
      let r = rng() * pool.totalWeight
      for (const opt of pool.options) {
        r -= opt.weight
        if (r < 0) {
          for (const mb of opt.members) pts[mb.userIdx] += mb.valor
          break
        }
      }
    }

    // Classificação final do cenário (mesmos desempates do ranking; os
    // acertos ⭐/✅/🟡 são só da fase de grupos, portanto já são fixos).
    order.sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a]
      const ua = users[a]
      const ub = users[b]
      if (ub.acertos_exatos !== ua.acertos_exatos) return ub.acertos_exatos - ua.acertos_exatos
      if (ub.acertos_resultado !== ua.acertos_resultado) return ub.acertos_resultado - ua.acertos_resultado
      if (ub.acertos_parciais !== ua.acertos_parciais) return ub.acertos_parciais - ua.acertos_parciais
      return a - b
    })
    winCount[order[0]]++
    for (let k = 0; k < Math.min(3, nUsers); k++) top3Count[order[k]]++
  }

  const out: Record<string, UserChance> = {}
  users.forEach((u, i) => {
    out[u.user_id] = {
      max_pontos: maxPontos[i],
      vivo_titulo: maxPontos[i] >= pontosLider,
      vivo_podio: maxPontos[i] >= pontosTerceiro,
      titulo_garantido: tituloGarantido[i],
      podio_garantido: podioGarantido[i],
      prob_titulo: winCount[i] / sims,
      prob_podio: top3Count[i] / sims,
    }
  })
  return out
}
