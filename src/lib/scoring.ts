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

export const DEADLINE_FASE1 = new Date('2026-06-10T23:59:00-03:00')
export const DEADLINE_FASE2 = new Date('2026-06-27T23:59:00-03:00')
export const DEADLINE_CAMPEAO = new Date('2026-06-10T23:59:00-03:00')
export const BONUS_CAMPEAO = 200
