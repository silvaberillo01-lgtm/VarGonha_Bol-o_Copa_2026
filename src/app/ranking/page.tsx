import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import RankingLiveClient, { RankEntry } from './RankingLiveClient'
import { Profile } from '@/types'
import { getChances } from '@/lib/getChances'

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

  // Jogos (apenas campos necessários) para detectar "ao vivo" no client.
  const { data: gameRows } = await supabase
    .from('games')
    .select('id, data_hora, resultado_lancado, fase')

  // Mesma lógica usada pela rota /api/chances (chamada pelo botão Atualizar e
  // pelo auto-refresh), para a coluna Chance não ficar presa no valor do
  // primeiro carregamento da página.
  const chances = await getChances(supabase)

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
