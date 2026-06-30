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
  // Sincronização automática de placar (API Football-Data.org)
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED'
  external_match_id?: number | null
  last_synced_at?: string | null
  // Mata-mata (nulos na fase de grupos)
  match_code?: string | null
  slot_casa?: string | null
  slot_fora?: string | null
  classificado_real?: string | null
  // Placar dos pênaltis (quando o tempo normal termina empatado)
  gols_penaltis_casa?: number | null
  gols_penaltis_fora?: number | null
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
  // Mata-mata: times derivados do chaveamento do usuário + quem ele faz avançar
  time_casa_palpite?: string | null
  time_fora_palpite?: string | null
  classificado_palpite?: string | null
}

export interface ChampionPrediction {
  id: string
  user_id: string
  selecao: string
  pontos: number
  created_at: string
  updated_at: string
}

export interface SpecialPrediction {
  id: string
  user_id: string
  tipo: 'artilheiro' | 'melhor_jogador'
  palpite: string
  pontos: number
  acertou: boolean | null
  created_at: string
  updated_at?: string
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

