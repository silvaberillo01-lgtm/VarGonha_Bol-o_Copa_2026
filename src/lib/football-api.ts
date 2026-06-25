// Cliente da Football-Data.org (https://www.football-data.org).
//
// USO: somente no servidor (rota de cron). A chave NUNCA pode ir ao browser —
// por isso a env é FOOTBALL_DATA_API_KEY (sem prefixo NEXT_PUBLIC_).
//
// O plano gratuito cobre a Copa do Mundo (competição "WC"), com placares
// atrasados e limite de 10 req/min (sem teto diário). Uma única chamada a
// /matches retorna TODOS os jogos do dia de uma vez.

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC' // World Cup

// Status possíveis vindos da API.
export type FdStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED'

export interface FdMatch {
  id: number
  utcDate: string
  status: FdStatus
  homeTeam: { id: number; name: string | null }
  awayTeam: { id: number; name: string | null }
  score: {
    fullTime: { home: number | null; away: number | null }
  }
}

export interface FetchResult {
  ok: boolean
  matches: FdMatch[]
  // Mensagem de erro legível (rate limit, chave ausente, etc.) quando ok=false.
  error?: string
}

// Mapeia o status da API para o nosso ciclo de vida simplificado.
export function mapStatus(s: FdStatus): 'SCHEDULED' | 'LIVE' | 'FINISHED' {
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE'
  if (s === 'FINISHED' || s === 'AWARDED') return 'FINISHED'
  return 'SCHEDULED'
}

// Busca todos os jogos da Copa num intervalo de datas (YYYY-MM-DD, inclusivo).
// Por padrão pega só o dia informado. Nunca lança: devolve ok=false em erro
// para a rota seguir funcionando sem derrubar o cron.
export async function fetchMatchesByDate(
  dateISO: string,
  dateToISO: string = dateISO,
): Promise<FetchResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return { ok: false, matches: [], error: 'FOOTBALL_DATA_API_KEY ausente' }
  }

  const url = `${BASE_URL}/competitions/${COMPETITION}/matches?dateFrom=${dateISO}&dateTo=${dateToISO}`

  try {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      // Evita cache do Next em rota dinâmica.
      cache: 'no-store',
    })

    if (res.status === 429) {
      return { ok: false, matches: [], error: 'Rate limit atingido (429)' }
    }
    if (!res.ok) {
      return { ok: false, matches: [], error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as { matches?: FdMatch[] }
    return { ok: true, matches: data.matches ?? [] }
  } catch (e) {
    return { ok: false, matches: [], error: (e as Error).message }
  }
}
