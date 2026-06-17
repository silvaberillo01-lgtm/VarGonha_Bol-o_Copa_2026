import { Game } from '@/types'
import { DEADLINE_FASE1 } from '@/lib/scoring'

export type GameStatus = 'nao_iniciado' | 'em_andamento' | 'encerrado'

// Janela aproximada (minutos) em que um jogo é considerado "em andamento"
// caso o resultado ainda não tenha sido lançado pelo admin.
export const MATCH_WINDOW_MIN = 150

export function getGameStatus(game: Game, now: Date = new Date()): GameStatus {
  if (game.resultado_lancado) return 'encerrado'
  const start = new Date(game.data_hora)
  if (now < start) return 'nao_iniciado'
  return 'em_andamento'
}

export function statusLabel(status: GameStatus): { text: string; emoji: string; classes: string } {
  switch (status) {
    case 'nao_iniciado':
      return { text: 'Não iniciado', emoji: '🕒', classes: 'bg-gray-100 text-gray-600' }
    case 'em_andamento':
      return { text: 'Em andamento', emoji: '🔴', classes: 'bg-red-100 text-red-700 animate-pulse' }
    case 'encerrado':
      return { text: 'Encerrado', emoji: '✅', classes: 'bg-green-100 text-green-700' }
  }
}

// Mesmo critério de bloqueio usado no dashboard e na tela de participante:
// um palpite só fica visível para todos depois que não pode mais ser alterado.
export function isGameLocked(game: Game, now: Date = new Date()): boolean {
  if (game.fase === 'grupos') return now > DEADLINE_FASE1 || game.resultado_lancado
  return now > new Date(game.data_hora) || game.resultado_lancado
}

// Chave AAAA-MM-DD no fuso de Brasília (America/Sao_Paulo, UTC-3).
// Ordem lexicográfica = ordem cronológica, então pode comparar como string.
export function brasiliaDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatHora(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDataHora(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDataLonga(dateKey: string): string {
  // dateKey no formato AAAA-MM-DD -> "sábado, 13 de junho"
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}
