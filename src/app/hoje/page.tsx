import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AutoRefresh from '@/components/AutoRefresh'
import HojeClient from './HojeClient'
import { Profile, Game, Prediction } from '@/types'
import { brasiliaDateKey } from '@/lib/match-utils'
import { computeOfficialBracket, OfficialGameInput } from '@/lib/bracket'
import { normalizeTeam } from '@/lib/teams'

const numFromCode = (code?: string | null) => (code ? parseInt(code.replace(/^M/, '')) : NaN)

export const dynamic = 'force-dynamic'

export default async function HojePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    redirect('/dashboard')
  }

  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .order('data_hora', { ascending: true })

  const rawGames: Game[] = allGames || []

  // Das oitavas em diante, time_casa/time_fora no banco começam como o slot
  // ("W73", "L101"...) e só viram o nome real quando o admin lança o jogo que
  // alimenta aquele slot — mas isso não propaga sozinho para os jogos
  // seguintes. Resolvemos aqui o mesmo chaveamento oficial usado na aba
  // "Chave", para exibir o time real assim que ele já estiver definido.
  const knockoutGames = rawGames.filter((g) => g.fase !== 'grupos')
  const oficialInputs: OfficialGameInput[] = knockoutGames.map((g) => ({
    num: numFromCode(g.match_code),
    resultado_lancado: g.resultado_lancado,
    time_casa: g.time_casa,
    time_fora: g.time_fora,
    classificado_real: g.classificado_real ?? null,
    gols_casa_real: g.gols_casa_real,
    gols_fora_real: g.gols_fora_real,
    gols_penaltis_casa: g.gols_penaltis_casa ?? null,
    gols_penaltis_fora: g.gols_penaltis_fora ?? null,
  }))
  const oficial = computeOfficialBracket(oficialInputs)

  // Bandeira por seleção, derivada de qualquer jogo (grupos ou mata-mata) que
  // já tenha essa seleção com bandeira cadastrada.
  const teamFlag = new Map<string, string>()
  for (const g of rawGames) {
    const tc = normalizeTeam(g.time_casa)
    const tf = normalizeTeam(g.time_fora)
    if (tc && g.bandeira_casa && !teamFlag.has(tc)) teamFlag.set(tc, g.bandeira_casa)
    if (tf && g.bandeira_fora && !teamFlag.has(tf)) teamFlag.set(tf, g.bandeira_fora)
  }

  const games: Game[] = rawGames.map((g) => {
    if (g.fase === 'grupos') return g
    const r = oficial[numFromCode(g.match_code)]
    const time_casa = r?.time_casa || g.time_casa
    const time_fora = r?.time_fora || g.time_fora
    return {
      ...g,
      time_casa,
      time_fora,
      bandeira_casa: teamFlag.get(time_casa || '') || g.bandeira_casa,
      bandeira_fora: teamFlag.get(time_fora || '') || g.bandeira_fora,
    }
  })
  const todayKey = brasiliaDateKey(new Date())

  // Jogos de hoje (fuso de Brasília). Se não houver, mostra a próxima rodada
  // disponível (a data futura mais próxima com jogos).
  let selecionados = games.filter((g) => brasiliaDateKey(new Date(g.data_hora)) === todayKey)
  let isToday = true
  let dateKey = todayKey

  if (selecionados.length === 0) {
    const futuros = games.filter((g) => brasiliaDateKey(new Date(g.data_hora)) > todayKey)
    if (futuros.length > 0) {
      // games já vem ordenado por data_hora asc, então o primeiro é o mais próximo
      const proximoKey = brasiliaDateKey(new Date(futuros[0].data_hora))
      selecionados = games.filter((g) => brasiliaDateKey(new Date(g.data_hora)) === proximoKey)
      isToday = false
      dateKey = proximoKey
    }
  }

  // Palpites de todos os participantes apenas para os jogos exibidos.
  const gameIds = selecionados.map((g) => g.id)
  let predictions: Prediction[] = []
  if (gameIds.length > 0) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .in('game_id', gameIds)
    predictions = preds || []
  }

  // Nomes dos participantes aprovados.
  const { data: profilesRows } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('status', 'approved')

  const participantes = (profilesRows || []).map((p) => ({ id: p.id as string, nome: p.nome as string }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <AutoRefresh intervalMs={60000} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <HojeClient
          games={selecionados}
          predictions={predictions}
          participantes={participantes}
          isToday={isToday}
          dateKey={dateKey}
          currentUserId={user.id}
        />
      </main>
    </div>
  )
}
