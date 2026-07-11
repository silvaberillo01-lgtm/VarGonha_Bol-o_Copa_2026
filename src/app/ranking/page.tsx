import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import RankingLiveClient, { RankEntry } from './RankingLiveClient'
import { Profile } from '@/types'
import { computeChances, ChanceGame, ChancePrediction, PendingSpecial } from '@/lib/chances'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
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

  const { data: rankingRows } = await supabase.rpc('get_ranking')

  const { data: configRows } = await supabase
    .from('copa_config')
    .select('key, value')

  const copaConfig: Record<string, string> = {}
  if (configRows) {
    for (const row of configRows) {
      copaConfig[row.key] = row.value
    }
  }

  const artilheiroPontos = copaConfig['artilheiro_pontos'] || '50'
  const melhorJogadorPontos = copaConfig['melhor_jogador_pontos'] || '50'

  // A agregação é feita no banco (função get_ranking) para evitar o teto de
  // 1000 linhas do PostgREST, que truncava os palpites e zerava o ranking.
  const ranking: RankEntry[] = (rankingRows || []).map((r: Record<string, unknown>) => {
    const total = Number(r.total_pontos ?? 0)
    // Fallback caso a migração 0002 ainda não tenha criado a coluna.
    const fechado = r.total_pontos_fechado == null ? total : Number(r.total_pontos_fechado)
    return {
      user_id: r.user_id as string,
      nome: r.nome as string,
      total_pontos: total,
      total_pontos_fechado: fechado,
      acertos_exatos: Number(r.acertos_exatos ?? 0),
      acertos_resultado: Number(r.acertos_resultado ?? 0),
      acertos_parciais: Number(r.acertos_parciais ?? 0),
      total_palpites: Number(r.total_palpites ?? 0),
    }
  })

  // Jogos com os campos necessários tanto para o client ("ao vivo") quanto
  // para o cálculo de chances (chaveamento real + jogos restantes).
  const { data: gameRows } = await supabase
    .from('games')
    .select('id, data_hora, resultado_lancado, fase, match_code, time_casa, time_fora, gols_casa_real, gols_fora_real, classificado_real')

  const chanceGames = (gameRows || []) as ChanceGame[]

  // Palpites dos jogos ainda sem resultado — só o necessário para estimar as
  // chances. Fica no servidor: o client recebe apenas os agregados.
  const openGameIds = chanceGames.filter((g) => !g.resultado_lancado).map((g) => g.id)
  const predictions: ChancePrediction[] = []
  if (openGameIds.length > 0) {
    // Paginação para não esbarrar no teto de 1000 linhas do PostgREST.
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await supabase
        .from('predictions')
        .select('user_id, game_id, gols_casa, gols_fora, time_casa_palpite, time_fora_palpite, classificado_palpite')
        .in('game_id', openGameIds)
        .range(from, from + PAGE - 1)
      if (!page || page.length === 0) break
      predictions.push(...(page as ChancePrediction[]))
      if (page.length < PAGE) break
    }
  }

  const { data: championRows } = await supabase
    .from('champion_predictions')
    .select('user_id, selecao')

  const { data: specialRows } = await supabase
    .from('special_predictions')
    .select('user_id, tipo, palpite, acertou')

  const championPicks: Record<string, string | null> = {}
  for (const row of championRows || []) {
    championPicks[row.user_id as string] = (row.selecao as string) ?? null
  }

  const pendingSpecials: PendingSpecial[] = (specialRows || [])
    .filter((row) => row.acertou == null)
    .map((row) => ({
      user_id: row.user_id as string,
      tipo: row.tipo as string,
      palpite: (row.palpite as string) || '',
      valor:
        row.tipo === 'artilheiro'
          ? parseInt(artilheiroPontos, 10) || 0
          : parseInt(melhorJogadorPontos, 10) || 0,
    }))

  const chances = computeChances({
    games: chanceGames,
    predictions,
    users: ranking.map((r) => ({
      user_id: r.user_id,
      total_pontos_fechado: r.total_pontos_fechado,
      acertos_exatos: r.acertos_exatos,
      acertos_resultado: r.acertos_resultado,
      acertos_parciais: r.acertos_parciais,
    })),
    championPicks,
    championSettled: !!copaConfig['campeao'],
    pendingSpecials,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <RankingLiveClient
          initialRanking={ranking}
          games={gameRows || []}
          currentUserId={user.id}
          artilheiroPontos={artilheiroPontos}
          melhorJogadorPontos={melhorJogadorPontos}
          chances={chances}
        />
      </main>
    </div>
  )
}
