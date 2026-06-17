'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export interface RankEntry {
  user_id: string
  nome: string
  total_pontos: number
  acertos_exatos: number
  acertos_resultado: number
  acertos_parciais: number
  total_palpites: number
}

interface Props {
  initialRanking: RankEntry[]
  currentUserId: string
  artilheiroPontos: string
  melhorJogadorPontos: string
}

function sortRanking(rows: RankEntry[]): RankEntry[] {
  return rows.slice().sort((a, b) => {
    if (b.total_pontos !== a.total_pontos) return b.total_pontos - a.total_pontos
    if (b.acertos_exatos !== a.acertos_exatos) return b.acertos_exatos - a.acertos_exatos
    if (b.acertos_resultado !== a.acertos_resultado) return b.acertos_resultado - a.acertos_resultado
    return b.acertos_parciais - a.acertos_parciais
  })
}

const POLL_MS = 30000

export default function RankingLiveClient({
  initialRanking,
  currentUserId,
  artilheiroPontos,
  melhorJogadorPontos,
}: Props) {
  const supabase = createClient()
  const [ranking, setRanking] = useState<RankEntry[]>(sortRanking(initialRanking))
  const [movement, setMovement] = useState<Record<string, 'up' | 'down'>>({})
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)

  // posições anteriores para calcular as setas
  const prevPositions = useRef<Record<string, number>>(
    Object.fromEntries(sortRanking(initialRanking).map((e, i) => [e.user_id, i])),
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const { data: rankRows } = await supabase.rpc('get_ranking')

    if (rankRows) {
      const mapped: RankEntry[] = (rankRows as Record<string, unknown>[]).map((r) => ({
        user_id: r.user_id as string,
        nome: r.nome as string,
        total_pontos: Number(r.total_pontos ?? 0),
        acertos_exatos: Number(r.acertos_exatos ?? 0),
        acertos_resultado: Number(r.acertos_resultado ?? 0),
        acertos_parciais: Number(r.acertos_parciais ?? 0),
        total_palpites: Number(r.total_palpites ?? 0),
      }))
      const sorted = sortRanking(mapped)

      // calcula movimento comparando com a posição anterior
      const newMovement: Record<string, 'up' | 'down'> = {}
      sorted.forEach((e, i) => {
        const prev = prevPositions.current[e.user_id]
        if (prev !== undefined && prev !== i) {
          newMovement[e.user_id] = i < prev ? 'up' : 'down'
        }
      })
      prevPositions.current = Object.fromEntries(sorted.map((e, i) => [e.user_id, i]))
      setRanking(sorted)
      setMovement(newMovement)
      setUpdatedAt(new Date())
    }

    setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    const poll = setInterval(refresh, POLL_MS)
    return () => clearInterval(poll)
  }, [refresh])

  const getMedalha = (pos: number) => {
    if (pos === 0) return '🥇'
    if (pos === 1) return '🥈'
    if (pos === 2) return '🥉'
    return `${pos + 1}º`
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-green-800">📊 Ranking Geral</h1>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="shrink-0 text-xs font-semibold bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          {refreshing ? '⏳' : '🔄'} Atualizar
        </button>
      </div>

      {/* Aviso honesto: atualiza sozinho quando o admin lança resultados */}
      <p className="text-gray-500 text-sm mb-4">
        🔄 Atualiza sozinho a cada 30s — a pontuação muda quando o admin lança o resultado de um
        jogo. Última atualização às{' '}
        {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
        <br />
        💡 Clique no nome de um participante para ver os palpites dele.
      </p>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-green-700 text-yellow-300">
                <th className="px-3 py-3 text-left text-sm font-bold">#</th>
                <th className="px-3 py-3 text-left text-sm font-bold">Participante</th>
                <th className="px-3 py-3 text-center text-sm font-bold">Pontos</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">⭐</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">✅</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">🟡</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden md:table-cell">Palpites</th>
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
                  const isMe = entry.user_id === currentUserId
                  const move = movement[entry.user_id]
                  return (
                    <tr
                      key={entry.user_id}
                      className={`border-b last:border-0 transition-colors ${
                        isMe ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-bold text-lg">
                        <span className="inline-flex items-center gap-1">
                          {getMedalha(idx)}
                          {move === 'up' && <span className="text-green-500 text-sm">↑</span>}
                          {move === 'down' && <span className="text-red-500 text-sm">↓</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-green-700 text-lg">{entry.total_pontos}</span>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell text-yellow-600 font-semibold">
                        {entry.acertos_exatos}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell text-green-600 font-semibold">
                        {entry.acertos_resultado}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell text-blue-600 font-semibold">
                        {entry.acertos_parciais}
                      </td>
                      <td className="px-3 py-3 text-center hidden md:table-cell text-gray-500 text-sm">
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

      {/* Legenda */}
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
    </div>
  )
}
