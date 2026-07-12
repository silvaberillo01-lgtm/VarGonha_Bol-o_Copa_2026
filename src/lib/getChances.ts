import { SupabaseClient } from '@supabase/supabase-js'
import { computeChances, ChanceGame, ChancePrediction, PendingSpecial, UserChance } from '@/lib/chances'

// Busca tudo que o cálculo de chances precisa e roda a simulação. Usado tanto
// no carregamento inicial da página (Server Component) quanto na rota de API
// chamada pelo botão "Atualizar"/auto-refresh — assim a coluna Chance fica
// tão "viva" quanto o resto do ranking, em vez de presa no primeiro load.
export async function getChances(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
): Promise<Record<string, UserChance>> {
  const { data: rankingRows } = await supabase.rpc('get_ranking')

  const { data: configRows } = await supabase.from('copa_config').select('key, value')
  const copaConfig: Record<string, string> = {}
  for (const row of configRows || []) {
    copaConfig[row.key] = row.value
  }
  const artilheiroPontos = copaConfig['artilheiro_pontos'] || '50'
  const melhorJogadorPontos = copaConfig['melhor_jogador_pontos'] || '50'

  const users = (rankingRows || []).map((r: Record<string, unknown>) => {
    const total = Number(r.total_pontos ?? 0)
    const fechado = r.total_pontos_fechado == null ? total : Number(r.total_pontos_fechado)
    return {
      user_id: r.user_id as string,
      total_pontos_fechado: fechado,
      acertos_exatos: Number(r.acertos_exatos ?? 0),
      acertos_resultado: Number(r.acertos_resultado ?? 0),
      acertos_parciais: Number(r.acertos_parciais ?? 0),
    }
  })

  const { data: gameRows } = await supabase
    .from('games')
    .select(
      'id, data_hora, resultado_lancado, fase, match_code, time_casa, time_fora, gols_casa_real, gols_fora_real, classificado_real',
    )
  const chanceGames = (gameRows || []) as ChanceGame[]

  const openGameIds = chanceGames.filter((g) => !g.resultado_lancado).map((g) => g.id)
  const predictions: ChancePrediction[] = []
  if (openGameIds.length > 0) {
    // Paginação para não esbarrar no teto de 1000 linhas do PostgREST.
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await supabase
        .from('predictions')
        .select(
          'user_id, game_id, gols_casa, gols_fora, time_casa_palpite, time_fora_palpite, classificado_palpite',
        )
        .in('game_id', openGameIds)
        .range(from, from + PAGE - 1)
      if (!page || page.length === 0) break
      predictions.push(...(page as ChancePrediction[]))
      if (page.length < PAGE) break
    }
  }

  const { data: championRows } = await supabase.from('champion_predictions').select('user_id, selecao')
  const championPicks: Record<string, string | null> = {}
  for (const row of championRows || []) {
    championPicks[row.user_id as string] = (row.selecao as string) ?? null
  }

  const { data: specialRows } = await supabase
    .from('special_predictions')
    .select('user_id, tipo, palpite, acertou')
  const pendingSpecials: PendingSpecial[] = (specialRows || [])
    .filter((row) => row.acertou == null)
    .map((row) => ({
      user_id: row.user_id as string,
      tipo: row.tipo as string,
      palpite: (row.palpite as string) || '',
      valor:
        row.tipo === 'artilheiro' ? parseInt(artilheiroPontos, 10) || 0 : parseInt(melhorJogadorPontos, 10) || 0,
    }))

  return computeChances({
    games: chanceGames,
    predictions,
    users,
    championPicks,
    championSettled: !!copaConfig['campeao'],
    pendingSpecials,
  })
}
