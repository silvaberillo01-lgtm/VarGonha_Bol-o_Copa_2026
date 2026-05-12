import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('fase', 'grupos')
    .order('grupo', { ascending: true })
    .order('rodada', { ascending: true })
    .order('data_hora', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', session.user.id)

  return (
    <DashboardClient
      games={games || []}
      predictions={predictions || []}
      userId={session.user.id}
    />
  )
}
