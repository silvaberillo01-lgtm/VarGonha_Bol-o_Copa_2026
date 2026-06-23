export function calcularPontos(
  golsCasaPalpite: number,
  golsForaPalpite: number,
  golsCasaReal: number,
  golsForaReal: number
): number {
  if (golsCasaPalpite === golsCasaReal && golsForaPalpite === golsForaReal) {
    return 15
  }

  const resultadoPalpite = Math.sign(golsCasaPalpite - golsForaPalpite)
  const resultadoReal = Math.sign(golsCasaReal - golsForaReal)

  if (resultadoPalpite === resultadoReal) {
    return 10
  }

  if (golsCasaPalpite === golsCasaReal || golsForaPalpite === golsForaReal) {
    return 5
  }

  return 0
}

export function getTipoAcerto(pontos: number): string {
  switch (pontos) {
    case 15: return 'Placar exato ⭐'
    case 10: return 'Resultado correto ✅'
    case 5: return 'Um gol correto 🟡'
    default: return 'Errou ❌'
  }
}

// First group game: June 11 at 16:00 BRT (México x África do Sul)
export const DEADLINE_FASE1 = new Date('2026-06-11T15:00:00-03:00')
export const DEADLINE_CAMPEAO = new Date('2026-06-11T15:00:00-03:00')
export const BONUS_CAMPEAO = 200

// Mata-mata: o palpite fica aberto até 30 min antes de cada jogo.
export const KNOCKOUT_LOCK_OFFSET_MIN = 30

// ---------------------------------------------------------------------------
// Pontuação do mata-mata
//
// Tier base (maior aplicável), comparando posicionalmente (casa↔casa, fora↔fora):
//   25 = placar exato
//   15 = acertou o classificado (lado que avança) + gols do classificado
//   10 = acertou o classificado (lado que avança)
//    5 = acertou os gols de pelo menos uma das equipes
//    0 = errou
//
// Multiplicador de chaveamento (quantos times do confronto o palpite acertou),
// com os valores EXATOS da regra (não recalcular por %):
//   A (2 times) = 100%      B (1 time) = 70%       C (0 time) = 40% e sem 25
// ---------------------------------------------------------------------------

type Cenario = 'A' | 'B' | 'C'

const MULTIPLICADOR: Record<Cenario, Record<number, number>> = {
  A: { 25: 25, 15: 15, 10: 10, 5: 5, 0: 0 },
  B: { 25: 18, 15: 11, 10: 7, 5: 3, 0: 0 },
  C: { 25: 0, 15: 6, 10: 4, 5: 2, 0: 0 }, // 25 é impossível (tratado abaixo)
}

export interface PalpiteMataMata {
  time_casa_palpite: string | null
  time_fora_palpite: string | null
  classificado_palpite: string | null
  gols_casa: number
  gols_fora: number
}

export interface ResultadoMataMata {
  time_casa_real: string | null
  time_fora_real: string | null
  classificado_real: string | null
  gols_casa_real: number
  gols_fora_real: number
}

export function calcularPontosMataMata(p: PalpiteMataMata, r: ResultadoMataMata): number {
  // Cenário pelo acerto posicional dos times.
  let acertosTimes = 0
  if (p.time_casa_palpite && p.time_casa_palpite === r.time_casa_real) acertosTimes++
  if (p.time_fora_palpite && p.time_fora_palpite === r.time_fora_real) acertosTimes++
  const cenario: Cenario = acertosTimes === 2 ? 'A' : acertosTimes === 1 ? 'B' : 'C'

  // Lado que avança no palpite e na realidade (posicional).
  const ladoPalpite =
    p.classificado_palpite && p.classificado_palpite === p.time_casa_palpite
      ? 'casa'
      : p.classificado_palpite && p.classificado_palpite === p.time_fora_palpite
      ? 'fora'
      : p.gols_casa > p.gols_fora
      ? 'casa'
      : p.gols_fora > p.gols_casa
      ? 'fora'
      : null
  const ladoReal =
    r.classificado_real && r.classificado_real === r.time_casa_real
      ? 'casa'
      : r.classificado_real && r.classificado_real === r.time_fora_real
      ? 'fora'
      : r.gols_casa_real > r.gols_fora_real
      ? 'casa'
      : r.gols_fora_real > r.gols_casa_real
      ? 'fora'
      : null

  const exato = p.gols_casa === r.gols_casa_real && p.gols_fora === r.gols_fora_real
  const ladoCorreto = ladoPalpite !== null && ladoPalpite === ladoReal
  const golsDoClassificado =
    ladoCorreto &&
    ((ladoReal === 'casa' && p.gols_casa === r.gols_casa_real) ||
      (ladoReal === 'fora' && p.gols_fora === r.gols_fora_real))
  const umGol = p.gols_casa === r.gols_casa_real || p.gols_fora === r.gols_fora_real

  let tier = 0
  if (exato) tier = 25
  else if (ladoCorreto && golsDoClassificado) tier = 15
  else if (ladoCorreto) tier = 10
  else if (umGol) tier = 5

  // No cenário C não há possibilidade de 25; placar exato cai no tier 15.
  if (cenario === 'C' && tier === 25) tier = 15

  return MULTIPLICADOR[cenario][tier]
}

export function getTipoAcertoMataMata(pontos: number): string {
  switch (pontos) {
    case 25: return 'Placar exato + confronto ⭐'
    case 18: return 'Placar exato (1 time) ⭐'
    case 15: return 'Classificado + gols ✅'
    case 11: return 'Classificado + gols (1 time) ✅'
    case 10: return 'Classificado certo ✅'
    case 7: return 'Classificado (1 time) ✅'
    case 6: return 'Placar projetado 🟡'
    case 5: return 'Um gol certo 🟡'
    case 4: return 'Classificado projetado 🟡'
    case 3: return 'Classificado/gol (1 time) 🟡'
    case 2: return 'Um gol projetado 🟡'
    default: return 'Errou ❌'
  }
}
