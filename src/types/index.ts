export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  nome: string
  email: string
  status: UserStatus
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  fase: string
  grupo: string | null
  rodada: number | null
  data_hora: string
  time_casa: string
  time_fora: string
  bandeira_casa: string | null
  bandeira_fora: string | null
  gols_casa_real: number | null
  gols_fora_real: number | null
  resultado_lancado: boolean
  created_at: string
}

export interface Prediction {
  id: string
  user_id: string
  game_id: string
  gols_casa: number
  gols_fora: number
  pontos: number
  created_at: string
  updated_at: string
}

export interface ChampionPrediction {
  id: string
  user_id: string
  selecao: string
  pontos: number
  created_at: string
  updated_at: string
}

export interface RankingEntry {
  user_id: string
  nome: string
  total_pontos: number
  acertos_exatos: number
  acertos_resultado: number
  acertos_parciais: number
  acertos_fase2: number
}
