import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function RankingPage() {
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

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nome')
    .eq('status', 'approved')

  const { data: predictions } = await supabase
    .from('predictions')
    .select('user_id, pontos')

  const { data: championPreds } = await supabase
    .from('champion_predictions')
    .select('user_id, pontos')

  const { data: specialPreds } = await supabase
    .from('special_predictions')
    .select('user_id, pontos')

  const { data: configRows } = await supabase
    .from('copa_config')
    .select('key, value')

  const copaConfig: Record<string, string> = {}
  if (configRows) {
    for (const row of configRows) {
      copaConfig[row.key] = row.value
    }
  }

  const artilheiroPontos = copaConfig['artilheiro_pontos'] || '50'
  const melhorJogadorPontos = copaConfig['melhor_jogador_pontos'] || '50'

  type RankEntry = {
    user_id: string
    nome: string
    total_pontos: number
    acertos_exatos: number
    acertos_resultado: number
    acertos_parciais: number
    total_palpites: number
  }

  const rankMap: Record<string, RankEntry> = {}

  profiles?.forEach((p) => {
    rankMap[p.id] = {
      user_id: p.id,
      nome: p.nome,
      total_pontos: 0,
      acertos_exatos: 0,
      acertos_resultado: 0,
      acertos_parciais: 0,
      total_palpites: 0,
    }
  })

  predictions?.forEach((pred) => {
    if (rankMap[pred.user_id]) {
      rankMap[pred.user_id].total_pontos += pred.pontos || 0
      rankMap[pred.user_id].total_palpites += 1
      if (pred.pontos === 15) rankMap[pred.user_id].acertos_exatos += 1
      else if (pred.pontos === 10) rankMap[pred.user_id].acertos_resultado += 1
      else if (pred.pontos === 5) rankMap[pred.user_id].acertos_parciais += 1
    }
  })

  championPreds?.forEach((cp) => {
    if (rankMap[cp.user_id]) {
      rankMap[cp.user_id].total_pontos += cp.pontos || 0
    }
  })

  specialPreds?.forEach((sp) => {
    if (rankMap[sp.user_id]) {
      rankMap[sp.user_id].total_pontos += sp.pontos || 0
    }
  })

  const ranking = Object.values(rankMap).sort((a, b) => {
    if (b.total_pontos !== a.total_pontos) return b.total_pontos - a.total_pontos
    if (b.acertos_exatos !== a.acertos_exatos) return b.acertos_exatos - a.acertos_exatos
    if (b.acertos_resultado !== a.acertos_resultado) return b.acertos_resultado - a.acertos_resultado
    return b.acertos_parciais - a.acertos_parciais
  })

  const getMedalha = (pos: number) => {
    if (pos === 0) return '🥇'
    if (pos === 1) return '🥈'
    if (pos === 2) return '🥉'
    return `${pos + 1}º`
  }

  const totalParticipants = ranking.length
  const prizePool = totalParticipants * 40
  const prize1st = Math.floor(prizePool * 0.70)
  const prize2nd = Math.floor(prizePool * 0.20)
  const prize3rd = prizePool - prize1st - prize2nd

  const podium = ranking.slice(0, 3)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-green-800 mb-6">📊 Ranking Geral</h1>

        {/* Podium */}
        {podium.length >= 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-700 mb-5 text-center">🏆 Pódio Atual</h2>
            <div className="flex items-end justify-center gap-4">
              {/* 2nd place */}
              {podium[1] && (
                <div className="flex flex-col items-center flex-1 max-w-[140px]">
                  <div className="text-3xl mb-1">🥈</div>
                  <div className="w-full bg-gray-100 rounded-t-xl pt-6 pb-3 px-2 text-center">
                    <div className="font-bold text-gray-800 text-sm truncate">{podium[1].nome}</div>
                    <div className="text-green-700 font-bold text-lg">{podium[1].total_pontos} pts</div>
                    <div className="text-xs text-gray-400 mt-1">2º lugar</div>
                  </div>
                </div>
              )}

              {/* 1st place — taller */}
              <div className="flex flex-col items-center flex-1 max-w-[160px]">
                <div className="text-4xl mb-1">🥇</div>
                <div className="w-full bg-yellow-50 border-2 border-yellow-300 rounded-t-xl pt-8 pb-3 px-2 text-center">
                  <div className="font-bold text-gray-900 text-sm truncate">{podium[0].nome}</div>
                  <div className="text-green-700 font-bold text-xl">{podium[0].total_pontos} pts</div>
                  <div className="text-xs text-yellow-600 font-semibold mt-1">1º lugar</div>
                </div>
              </div>

              {/* 3rd place */}
              {podium[2] && (
                <div className="flex flex-col items-center flex-1 max-w-[140px]">
                  <div className="text-3xl mb-1">🥉</div>
                  <div className="w-full bg-orange-50 rounded-t-xl pt-4 pb-3 px-2 text-center">
                    <div className="font-bold text-gray-800 text-sm truncate">{podium[2].nome}</div>
                    <div className="text-green-700 font-bold text-lg">{podium[2].total_pontos} pts</div>
                    <div className="text-xs text-gray-400 mt-1">3º lugar</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prize pool */}
        {totalParticipants > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="text-lg font-bold text-gray-700 mb-4">💰 Premiação</h2>
            <div className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-gray-700">{totalParticipants} participantes</span> × R$ 40,00 = {' '}
              <span className="font-bold text-green-700 text-base">R$ {prizePool.toFixed(2).replace('.', ',')}</span> no bolão
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🥇</div>
                <div className="text-xs text-gray-500 mb-1">1º Lugar · 70%</div>
                <div className="font-bold text-green-700 text-xl">
                  R$ {prize1st.toFixed(2).replace('.', ',')}
                </div>
                {podium[0] && (
                  <div className="text-xs text-gray-600 mt-1 truncate">{podium[0].nome}</div>
                )}
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🥈</div>
                <div className="text-xs text-gray-500 mb-1">2º Lugar · 20%</div>
                <div className="font-bold text-green-700 text-xl">
                  R$ {prize2nd.toFixed(2).replace('.', ',')}
                </div>
                {podium[1] && (
                  <div className="text-xs text-gray-600 mt-1 truncate">{podium[1].nome}</div>
                )}
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">🥉</div>
                <div className="text-xs text-gray-500 mb-1">3º Lugar · 10%</div>
                <div className="font-bold text-green-700 text-xl">
                  R$ {prize3rd.toFixed(2).replace('.', ',')}
                </div>
                {podium[2] && (
                  <div className="text-xs text-gray-600 mt-1 truncate">{podium[2].nome}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Full ranking table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-700 text-yellow-300">
                  <th className="px-4 py-3 text-left text-sm font-bold">#</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Participante</th>
                  <th className="px-4 py-3 text-center text-sm font-bold">Pontos</th>
                  <th className="px-4 py-3 text-center text-sm font-bold hidden sm:table-cell">⭐ Exatos</th>
                  <th className="px-4 py-3 text-center text-sm font-bold hidden sm:table-cell">✅ Result.</th>
                  <th className="px-4 py-3 text-center text-sm font-bold hidden sm:table-cell">🟡 Parciais</th>
                  <th className="px-4 py-3 text-center text-sm font-bold hidden md:table-cell">Palpites</th>
                </tr>
              </thead>
              <tbody>
                {ranking.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      Nenhum dado disponível ainda
                    </td>
                  </tr>
                ) : (
                  ranking.map((entry, idx) => {
                    const isMe = entry.user_id === user.id
                    return (
                      <tr
                        key={entry.user_id}
                        className={`border-b last:border-0 ${
                          isMe ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-center font-bold text-lg">
                          {getMedalha(idx)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800">{entry.nome}</span>
                          {isMe && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              você
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-green-700 text-lg">{entry.total_pontos}</span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell text-yellow-600 font-semibold">
                          {entry.acertos_exatos}
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell text-green-600 font-semibold">
                          {entry.acertos_resultado}
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell text-blue-600 font-semibold">
                          {entry.acertos_parciais}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell text-gray-500 text-sm">
                          {entry.total_palpites}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Pontuação:</h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-yellow-600">⭐ Placar exato = 15 pts</span>
            <span className="text-green-600">✅ Resultado correto = 10 pts</span>
            <span className="text-blue-600">🟡 Um gol certo = 5 pts</span>
            <span className="text-purple-600">🏆 Campeão certo = 200 pts</span>
            <span className="text-orange-600">⚽ Artilheiro certo = {artilheiroPontos} pts</span>
            <span className="text-pink-600">🌟 Melhor Jogador certo = {melhorJogadorPontos} pts</span>
          </div>
        </div>
      </main>
    </div>
  )
}
