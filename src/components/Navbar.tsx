'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'

interface NavbarProps {
  profile: Profile
}

export default function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <nav className="bg-green-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="text-yellow-400 font-bold text-lg leading-none block">VARgonha</span>
              <span className="text-green-300 text-xs leading-none">Copa 2026</span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className="text-yellow-200 hover:text-yellow-400 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              ⚽ Palpites
            </Link>
            <Link
              href="/champion"
              className="text-yellow-200 hover:text-yellow-400 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              🥇 Campeão
            </Link>
            <Link
              href="/ranking"
              className="text-yellow-200 hover:text-yellow-400 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              📊 Ranking
            </Link>
            <Link
              href="/palpites"
              className="text-yellow-200 hover:text-yellow-400 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              👁️ Palpites
            </Link>
            {profile.is_admin && (
              <Link
                href="/admin"
                className="text-orange-300 hover:text-orange-400 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ⚙️ Admin
              </Link>
            )}
          </div>

          {/* User Info + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-green-300 text-sm hidden sm:block">
              Olá, <span className="text-yellow-300 font-semibold">{profile.nome.split(' ')[0]}</span>
            </span>
            <button
              onClick={handleLogout}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex gap-1 pb-3">
          <Link href="/dashboard" className="text-yellow-200 hover:text-yellow-400 px-3 py-1.5 rounded text-sm font-medium">
            ⚽ Palpites
          </Link>
          <Link href="/champion" className="text-yellow-200 hover:text-yellow-400 px-3 py-1.5 rounded text-sm font-medium">
            🥇 Campeão
          </Link>
          <Link href="/ranking" className="text-yellow-200 hover:text-yellow-400 px-3 py-1.5 rounded text-sm font-medium">
            📊 Ranking
          </Link>
          <Link href="/palpites" className="text-yellow-200 hover:text-yellow-400 px-3 py-1.5 rounded text-sm font-medium">
            👁️ Palpites
          </Link>
          {profile.is_admin && (
            <Link href="/admin" className="text-orange-300 hover:text-orange-400 px-3 py-1.5 rounded text-sm font-medium">
              ⚙️ Admin
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
