import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminClient from './AdminClient'
import { Profile, Game } from '@/types'

export default async function AdminPage() {
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

  if (!profile || !profile.is_admin) {
    redirect('/dashboard')
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('data_hora', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-green-800 mb-6">⚙️ Painel Admin</h1>
        <AdminClient
          users={(users || []) as Profile[]}
          games={(games || []) as Game[]}
        />
      </main>
    </div>
  )
}
