import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ChampionClient from './ChampionClient'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ChampionPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    redirect('/dashboard')
  }

  const { data: myPrediction } = await supabase
    .from('champion_predictions')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  const { data: allPredictions } = await supabase
    .from('champion_predictions')
    .select('selecao, pontos, profiles(nome)')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <ChampionClient
          myPrediction={myPrediction}
          allPredictions={allPredictions || []}
          userId={session.user.id}
        />
      </main>
    </div>
  )
}
