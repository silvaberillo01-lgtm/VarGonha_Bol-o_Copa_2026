import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
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

  const { data: rankingRows } = await supabase.rpc('get_ranking')

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

  // A agregação é feita no banco (função get_ranking) para evitar o teto de
  // 1000 linhas do PostgREST, que truncava os palpites e zerava o ranking.
  const ranking: RankEntry[] = (rankingRows || []).map((r: Record<string, unknown>) => ({
    user_id: r.user_id as string,
    nome: r.nome as string,
    total_pontos: Number(r.total_pontos ?? 0),
    acertos_exatos: Number(r.acertos_exatos ?? 0),
    acertos_resultado: Number(r.acertos_resultado ?? 0),
    acertos_parciais: Number(r.acertos_parciais ?? 0),
    total_palpites: Number(r.total_palpites ?? 0),
  }))

  ranking.sort((a, b) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-green-800 mb-1">📊 Ranking Geral</h1>
        <p className="text-gray-500 text-sm mb-6">
          💡 Clique no nome de um participante para ver os palpites dele (visíveis após o bloqueio).
        </p>

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
                          <Link
                            href={`/participante/${entry.user_id}`}
                            className="font-semibold text-green-700 hover:text-green-900 hover:underline"
                          >
                            {entry.nome}
                          </Link>
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
