import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PalpitesPage() {
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

  // Reaproveita o ranking (já agregado no banco) para ordenar por pontos.
  const { data: rankingRows } = await supabase.rpc('get_ranking')

  type RankEntry = { user_id: string; nome: string; total_pontos: number }
  const participantes: RankEntry[] = (rankingRows || []).map((r: Record<string, unknown>) => ({
    user_id: r.user_id as string,
    nome: r.nome as string,
    total_pontos: Number(r.total_pontos ?? 0),
  }))

  participantes.sort((a, b) => b.total_pontos - a.total_pontos)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-green-800 mb-1">👁️ Palpites de Todos</h1>
        <p className="text-gray-500 text-sm mb-6">
          Escolha um participante para ver os palpites dele. Os palpites de cada jogo aparecem
          somente após o bloqueio (prazo encerrado ou jogo iniciado).
        </p>

        <div className="bg-white rounded-xl shadow-sm divide-y">
          {participantes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nenhum participante ainda</div>
          ) : (
            participantes.map((p) => {
              const isMe = p.user_id === user.id
              return (
                <Link
                  key={p.user_id}
                  href={`/participante/${p.user_id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-green-50 transition-colors"
                >
                  <span className="font-semibold text-gray-800">
                    {p.nome}
                    {isMe && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">você</span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-bold text-green-700">{p.total_pontos} pts</span>
                    <span className="text-green-600">→</span>
                  </span>
                </Link>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
