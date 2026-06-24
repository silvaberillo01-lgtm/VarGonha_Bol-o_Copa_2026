'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Game } from '@/types'
import { getGameStatus } from '@/lib/match-utils'
import ShareCardButton from '@/components/ShareCardButton'

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
  games: Pick<Game, 'id' | 'data_hora' | 'resultado_lancado' | 'fase'>[]
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
  games,
  currentUserId,
  artilheiroPontos,
  melhorJogadorPontos,
}: Props) {
  const supabase = createClient()
  const [ranking, setRanking] = useState<RankEntry[]>(sortRanking(initialRanking))
  const [liveGames, setLiveGames] = useState(games)
  const [movement, setMovement] = useState<Record<string, 'up' | 'down'>>({})
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState<Date>(new Date())

  // posições anteriores para calcular as setas
  const prevPositions = useRef<Record<string, number>>(
    Object.fromEntries(sortRanking(initialRanking).map((e, i) => [e.user_id, i])),
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const [{ data: rankRows }, { data: gameRows }] = await Promise.all([
      supabase.rpc('get_ranking'),
      supabase.from('games').select('id, data_hora, resultado_lancado, fase'),
    ])

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

    if (gameRows) {
      setLiveGames(gameRows as Props['games'])
    }
    setRefreshing(false)
  }, [supabase])

  useEffect(() => {
    const poll = setInterval(refresh, POLL_MS)
    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [refresh])

  const jogosEmAndamento = liveGames.filter(
    (g) => getGameStatus(g as Game, now) === 'em_andamento',
  ).length

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
        <div className="flex gap-2 shrink-0">
          <ShareCardButton
            label="📸 Compartilhar"
            filename="vargonha-ranking.png"
            shareText="VARgonha — Ranking do Bolão da Copa 2026 🏆"
            className="text-xs font-semibold bg-yellow-400 hover:bg-yellow-300 text-green-900 px-3 py-1.5 rounded-lg transition-colors"
            spec={{
              type: 'ranking-completo',
              entries: ranking.map((e) => ({
                nome: e.nome,
                total_pontos: e.total_pontos,
                acertos_exatos: e.acertos_exatos,
                acertos_resultado: e.acertos_resultado,
              })),
              timestamp: updatedAt.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
            }}
          />
          <button
            onClick={refresh}
            disabled={refreshing}
            className="text-xs font-semibold bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {refreshing ? '⏳' : '🔄'} Atualizar
          </button>
        </div>
      </div>

      {/* Indicador de pontuação parcial x final */}
      {jogosEmAndamento > 0 ? (
        <div className="flex items-center gap-2 mb-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold">AO VIVO</span>
          <span>
            Pontuação <strong>parcial</strong> — {jogosEmAndamento} jogo
            {jogosEmAndamento > 1 ? 's' : ''} em andamento. Atualiza sozinho a cada 30s.
          </span>
        </div>
      ) : (
        <p className="text-gray-500 text-sm mb-4">
          Pontuação atualizada •{' '}
          {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          {' '}• 💡 clique no nome para ver os palpites.
        </p>
      )}

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
          <span className="text-gray-600">🏟️ Mata-mata = até 25 pts (placar + classificados)</span>
          <span className="text-purple-600">🏆 Campeão certo = 200 pts</span>
          <span className="text-orange-600">⚽ Artilheiro certo = {artilheiroPontos} pts</span>
          <span className="text-pink-600">🌟 Melhor Jogador certo = {melhorJogadorPontos} pts</span>
        </div>
      </div>
    </div>
  )
}
