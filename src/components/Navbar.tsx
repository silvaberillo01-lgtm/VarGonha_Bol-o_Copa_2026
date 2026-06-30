'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'

interface NavbarProps {
  profile: Profile
}

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/dashboard', label: '⚽ Palpitar' },
  { href: '/hoje', label: '🗓️ Hoje' },
  { href: '/chaveamento', label: '🗺️ Chave' },
  { href: '/ranking', label: '📊 Ranking' },
  { href: '/champion', label: '🥇 Campeão' },
  { href: '/palpites', label: '👁️ Palpites' },
  { href: '/hall', label: '🤡 Hall' },
  { href: '/compartilhar', label: '📲 Cards' },
]

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
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="text-yellow-400 font-bold text-lg leading-none block">VARgonha</span>
              <span className="text-green-300 text-xs leading-none">Copa 2026</span>
            </div>
          </Link>

          {/* Nav Links (desktop) */}
          <div className="hidden md:flex items-center gap-1 flex-wrap justify-center">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-yellow-200 hover:text-yellow-400 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
            {profile.is_admin && (
              <Link
                href="/admin"
                className="text-orange-300 hover:text-orange-400 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                ⚙️ Admin
              </Link>
            )}
          </div>

          {/* User Info + Logout */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-green-300 text-sm hidden sm:block">
              Olá, <span className="text-yellow-300 font-semibold">{profile.nome.split(' ')[0]}</span>
            </span>
            <button
              onClick={handleLogout}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Nav Links (mobile) — rolagem horizontal para não estourar a tela */}
        <div className="md:hidden -mx-4 px-4 pb-3">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-yellow-200 hover:text-yellow-400 bg-green-700/40 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0"
              >
                {link.label}
              </Link>
            ))}
            {profile.is_admin && (
              <Link
                href="/admin"
                className="text-orange-300 hover:text-orange-400 bg-green-700/40 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0"
              >
                ⚙️ Admin
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
