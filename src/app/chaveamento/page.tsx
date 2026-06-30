import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AutoRefresh from '@/components/AutoRefresh'
import ChaveamentoClient from './ChaveamentoClient'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ChaveamentoPage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    redirect('/dashboard')
  }

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('data_hora', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)

  const { data: champion } = await supabase
    .from('champion_predictions')
    .select('selecao')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-gray-50">
      <AutoRefresh intervalMs={60000} />
      <Navbar profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <ChaveamentoClient
          games={games || []}
          predictions={predictions || []}
          champion={champion?.selecao || null}
        />
      </main>
    </div>
  )
}
