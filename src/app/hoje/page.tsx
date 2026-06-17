import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AutoRefresh from '@/components/AutoRefresh'
import HojeClient from './HojeClient'
import { Profile, Game, Prediction } from '@/types'
import { brasiliaDateKey } from '@/lib/match-utils'

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

  const games: Game[] = allGames || []
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
