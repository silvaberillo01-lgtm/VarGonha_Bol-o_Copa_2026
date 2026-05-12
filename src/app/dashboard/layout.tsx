import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import Navbar from '@/components/Navbar'
import LogoutButton from '@/components/LogoutButton'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
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

  if (!profile) {
    redirect('/auth/login')
  }

  if (profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-green-800 mb-3">Aguardando aprovação</h2>
          <p className="text-gray-600 mb-4">
            Seu cadastro ainda está sendo analisado pelo administrador.
            Assim que for aprovado, você poderá acessar o bolão!
          </p>
          <p className="text-sm text-gray-500">
            Confirme seu pagamento para agilizar o processo.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  if (profile.status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-700 mb-3">Cadastro não aprovado</h2>
          <p className="text-gray-600 mb-4">
            Infelizmente seu cadastro não foi aprovado. Entre em contato com o organizador do bolão para mais informações.
          </p>
          <LogoutButton />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
