import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ChampionClient from './ChampionClient'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ChampionPage() {
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

  const { data: myPrediction } = await supabase
    .from('champion_predictions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: allPredictions } = await supabase
    .from('champion_predictions')
    .select('selecao, pontos, profiles(nome)')

  const { data: mySpecialPredictions } = await supabase
    .from('special_predictions')
    .select('*')
    .eq('user_id', user.id)

  const { data: configRows } = await supabase
    .from('copa_config')
    .select('key, value')

  const copaConfig: Record<string, string> = {}
  if (configRows) {
    for (const row of configRows) {
      copaConfig[row.key] = row.value
    }
  }

  const myArtilheiro = mySpecialPredictions?.find((p) => p.tipo === 'artilheiro') || null
  const myMelhorJogador = mySpecialPredictions?.find((p) => p.tipo === 'melhor_jogador') || null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <ChampionClient
          myPrediction={myPrediction}
          allPredictions={allPredictions || []}
          userId={user.id}
          myArtilheiro={myArtilheiro}
          myMelhorJogador={myMelhorJogador}
          copaConfig={copaConfig}
        />
      </main>
    </div>
  )
}
