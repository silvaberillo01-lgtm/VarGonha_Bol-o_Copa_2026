import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminClient from './AdminClient'
import { Profile, Game } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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

  const { data: configRows } = await supabase
    .from('copa_config')
    .select('key, value')

  const copaConfig: Record<string, string> = {}
  if (configRows) {
    for (const row of configRows) {
      copaConfig[row.key] = row.value
    }
  }

  const { data: specialRows } = await supabase
    .from('special_predictions')
    .select('id, user_id, tipo, palpite, pontos, acertou, profiles(nome)')

  const specialPredictions = (specialRows || []).map((r) => {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id as string,
      user_id: r.user_id as string,
      tipo: r.tipo as 'artilheiro' | 'melhor_jogador',
      palpite: r.palpite as string,
      pontos: (r.pontos as number) ?? 0,
      acertou: (r.acertou as boolean | null) ?? null,
      nome: (prof as { nome?: string } | null)?.nome ?? 'Participante',
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-green-800 mb-6">⚙️ Painel Admin</h1>
        <AdminClient
          users={(users || []) as Profile[]}
          games={(games || []) as Game[]}
          copaConfig={copaConfig}
          specialPredictions={specialPredictions}
        />
      </main>
    </div>
  )
}
