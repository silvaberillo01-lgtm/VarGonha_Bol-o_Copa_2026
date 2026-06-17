import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AutoRefresh from '@/components/AutoRefresh'
import { Profile, Game } from '@/types'
import { formatDataHora } from '@/lib/match-utils'

export const dynamic = 'force-dynamic'

interface PredRow {
  user_id: string
  game_id: string
  gols_casa: number
  gols_fora: number
}

interface OusadiaItem {
  key: string
  nome: string
  jogo: string
  data: string
  palpite: string
  resultado: string
  ousadia: number
}

export default async function HallPage() {
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

  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .order('data_hora', { ascending: true })

  const games: Game[] = allGames || []
  const finishedGames = games.filter(
    (g) => g.resultado_lancado && g.gols_casa_real !== null && g.gols_fora_real !== null,
  )
  const finishedIds = finishedGames.map((g) => g.id)
  const gameById = new Map(finishedGames.map((g) => [g.id, g]))

  // Nomes (apenas aprovados entram no hall).
  const { data: profilesRows } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('status', 'approved')
  const nomeById = new Map((profilesRows || []).map((p) => [p.id as string, p.nome as string]))

  // Busca paginada dos palpites dos jogos encerrados (evita o teto de 1000 linhas).
  const preds: PredRow[] = []
  if (finishedIds.length > 0) {
    const pageSize = 1000
    let from = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('predictions')
        .select('user_id, game_id, gols_casa, gols_fora')
        .in('game_id', finishedIds)
        .range(from, from + pageSize - 1)
      if (error || !data || data.length === 0) break
      preds.push(...(data as PredRow[]))
      if (data.length < pageSize) break
      from += pageSize
    }
  }

  const items: OusadiaItem[] = []
  for (const p of preds) {
    const g = gameById.get(p.game_id)
    const nome = nomeById.get(p.user_id)
    if (!g || !nome) continue // ignora palpites de não-aprovados
    const ousadia = Math.abs(p.gols_casa - g.gols_casa_real!) + Math.abs(p.gols_fora - g.gols_fora_real!)
    items.push({
      key: `${p.user_id}-${p.game_id}`,
      nome,
      jogo: `${g.bandeira_casa || ''} ${g.time_casa} × ${g.time_fora} ${g.bandeira_fora || ''}`.trim(),
      data: formatDataHora(g.data_hora),
      palpite: `${p.gols_casa} × ${p.gols_fora}`,
      resultado: `${g.gols_casa_real} × ${g.gols_fora_real}`,
      ousadia,
    })
  }

  const maisOusados = items.slice().sort((a, b) => b.ousadia - a.ousadia).slice(0, 10)
  const maisCerteiros = items.slice().sort((a, b) => a.ousadia - b.ousadia).slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <AutoRefresh intervalMs={60000} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-red-700 mb-1">🤡 Hall da Vergonha</h1>
        <p className="text-gray-500 text-sm mb-6">
          Os palpites mais <strong>ousados</strong> (leia-se: viajados) do bolão, só dos jogos já
          encerrados. Índice de ousadia = distância total entre o palpite e o resultado real.
        </p>

        {items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500">
            <div className="text-4xl mb-3">🫥</div>
            Ainda não há jogos encerrados com palpites. Espere a bola rolar!
          </div>
        ) : (
          <>
            {/* Top ousados */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-red-600 to-orange-500 px-4 py-3">
                <h2 className="text-white font-bold">🔥 Top 10 mais ousados</h2>
              </div>
              <div className="divide-y">
                {maisOusados.map((item, idx) => (
                  <div key={item.key} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-xl font-extrabold text-red-500 w-8 text-center shrink-0">
                      {idx === 0 ? '👑' : `${idx + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 truncate">{item.nome}</div>
                      <div className="text-xs text-gray-500 truncate">{item.jogo}</div>
                      <div className="text-xs text-gray-400">{item.data}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm">
                        <span className="text-gray-400">palpite</span>{' '}
                        <span className="font-bold text-gray-700">{item.palpite}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">real</span>{' '}
                        <span className="font-bold text-green-700">{item.resultado}</span>
                      </div>
                      <div className="mt-1 inline-block text-xs font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        ousadia {item.ousadia} 😬
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mais certeiros */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-3">
                <h2 className="text-white font-bold">🎯 Os mais certeiros</h2>
              </div>
              <div className="divide-y">
                {maisCerteiros.map((item, idx) => (
                  <div key={item.key} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-xl w-8 text-center shrink-0">
                      {idx === 0 ? '🏅' : '✅'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 truncate">{item.nome}</div>
                      <div className="text-xs text-gray-500 truncate">{item.jogo}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm">
                        <span className="font-bold text-gray-700">{item.palpite}</span>
                        <span className="text-gray-400"> vs </span>
                        <span className="font-bold text-green-700">{item.resultado}</span>
                      </div>
                      <div className="mt-1 inline-block text-xs font-extrabold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {item.ousadia === 0 ? 'na mosca! 🎯' : `ousadia ${item.ousadia}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
