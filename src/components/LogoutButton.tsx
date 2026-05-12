'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-6 bg-gray-200 hover:bg-gray-300 text-gray-600 px-6 py-2 rounded-lg text-sm transition-colors"
    >
      Sair
    </button>
  )
}
