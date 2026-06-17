import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CompartilharClient from './CompartilharClient'
import { Profile, Game } from '@/types'

export const dynamic = 'force-dynamic'

interface RankRow {
  user_id: string
  nome: string
  total_pontos: number
  acertos_exatos: number
  acertos_resultado: number
  acertos_parciais: number
  total_palpites: number
}

export default async function CompartilharPage() {
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
  const rows: RankRow[] = (rankingRows || []).map((r: Record<string, unknown>) => ({
    user_id: r.user_id as string,
    nome: r.nome as string,
    total_pontos: Number(r.total_pontos ?? 0),
    acertos_exatos: Number(r.acertos_exatos ?? 0),
    acertos_resultado: Number(r.acertos_resultado ?? 0),
    acertos_parciais: Number(r.acertos_parciais ?? 0),
    total_palpites: Number(r.total_palpites ?? 0),
  }))

  rows.sort((a, b) => {
    if (b.total_pontos !== a.total_pontos) return b.total_pontos - a.total_pontos
    if (b.acertos_exatos !== a.acertos_exatos) return b.acertos_exatos - a.acertos_exatos
    if (b.acertos_resultado !== a.acertos_resultado) return b.acertos_resultado - a.acertos_resultado
    return b.acertos_parciais - a.acertos_parciais
  })

  const minhaPos = rows.findIndex((r) => r.user_id === user.id)
  const eu = minhaPos >= 0 ? rows[minhaPos] : null

  const { data: champion } = await supabase
    .from('champion_predictions')
    .select('selecao')
    .eq('user_id', user.id)
    .single()

  // Mapa seleção -> bandeira (a partir dos jogos cadastrados).
  const { data: gameRows } = await supabase
    .from('games')
    .select('time_casa, time_fora, bandeira_casa, bandeira_fora')
  const bandeiraMap: Record<string, string> = {}
  for (const g of (gameRows || []) as Pick<Game, 'time_casa' | 'time_fora' | 'bandeira_casa' | 'bandeira_fora'>[]) {
    if (g.bandeira_casa) bandeiraMap[g.time_casa] = g.bandeira_casa
    if (g.bandeira_fora) bandeiraMap[g.time_fora] = g.bandeira_fora
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <CompartilharClient
          nome={profile.nome}
          posicao={minhaPos >= 0 ? minhaPos + 1 : 0}
          totalParticipantes={rows.length}
          pontos={eu?.total_pontos ?? 0}
          exatos={eu?.acertos_exatos ?? 0}
          resultado={eu?.acertos_resultado ?? 0}
          parciais={eu?.acertos_parciais ?? 0}
          totalPalpites={eu?.total_palpites ?? 0}
          selecaoCampeao={champion?.selecao ?? null}
          bandeiraCampeao={champion?.selecao ? bandeiraMap[champion.selecao] ?? null : null}
        />
      </main>
    </div>
  )
}
