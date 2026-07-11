'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Game } from '@/types'
import { getGameStatus } from '@/lib/match-utils'
import ShareCardButton from '@/components/ShareCardButton'
import { UserChance } from '@/lib/chances'

export interface RankEntry {
  user_id: string
  nome: string
  total_pontos: number
  // Pontos considerando só jogos encerrados — base para as setas ↑/↓.
  total_pontos_fechado: number
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
  // Chances de título/pódio (calculadas no servidor ao carregar a página).
  chances: Record<string, UserChance>
}

// Formata a probabilidade da SIMULAÇÃO — nunca mostra 100%/0% literal, pois
// isso é uma amostra (3000 sorteios), não uma prova. Certeza de verdade vem
// de titulo_garantido/podio_garantido (ver abaixo), não daqui.
function fmtPct(p: number): string {
  if (p >= 0.995) return '>99%'
  if (p <= 0.005) return '<1%'
  return `${Math.round(p * 100)}%`
}

// Célula da coluna "Chance": título em destaque, pódio e teto de pontos como
// informação secundária. 💀 = matematicamente fora até do pódio.
// 🔒 = garantido de verdade (pior caso próprio não é alcançado nem pelo
// melhor caso de mais ninguém) — diferente do 🏆/🏅, que são estimativa por
// simulação e podem, em tese, ainda ser superados.
function ChanceCell({ c }: { c: UserChance | undefined }) {
  if (!c) return <span className="text-gray-300">–</span>

  if (!c.vivo_podio) {
    return (
      <div className="leading-tight">
        <span className="text-sm font-semibold text-gray-400">💀 fora</span>
        <div className="text-[10px] text-gray-400">máx {c.max_pontos} pts</div>
      </div>
    )
  }

  if (c.titulo_garantido) {
    return (
      <div className="leading-tight">
        <span className="text-sm font-bold text-green-700">🔒🏆 garantido</span>
        <div className="text-[10px] text-gray-400">ninguém mais alcança · máx {c.max_pontos} pts</div>
      </div>
    )
  }

  if (c.podio_garantido) {
    return (
      <div className="leading-tight">
        <span className="text-sm font-bold text-amber-600">🔒🏅 pódio garantido</span>
        <div className="text-[10px] text-gray-400">
          título ainda em disputa · ~{fmtPct(c.prob_titulo)} · máx {c.max_pontos} pts
        </div>
      </div>
    )
  }

  if (!c.vivo_titulo) {
    return (
      <div className="leading-tight">
        <span className="text-sm font-bold text-amber-600">
          🏅 ~{fmtPct(c.prob_podio)}
        </span>
        <div className="text-[10px] text-gray-400">só pódio · máx {c.max_pontos} pts</div>
      </div>
    )
  }

  const strong = c.prob_titulo >= 0.5
  return (
    <div className="leading-tight">
      <span className={`text-sm font-bold ${strong ? 'text-green-700' : 'text-green-600'}`}>
        🏆 ~{fmtPct(c.prob_titulo)}
      </span>
      <div className="text-[10px] text-gray-400">
        pódio ~{fmtPct(c.prob_podio)} · máx {c.max_pontos} pts
      </div>
    </div>
  )
}

// Ordena por uma pontuação escolhida, com os mesmos critérios de desempate.
function sortBy(rows: RankEntry[], pts: (r: RankEntry) => number): RankEntry[] {
  return rows.slice().sort((a, b) => {
    if (pts(b) !== pts(a)) return pts(b) - pts(a)
    if (b.acertos_exatos !== a.acertos_exatos) return b.acertos_exatos - a.acertos_exatos
    if (b.acertos_resultado !== a.acertos_resultado) return b.acertos_resultado - a.acertos_resultado
    return b.acertos_parciais - a.acertos_parciais
  })
}

const sortRanking = (rows: RankEntry[]) => sortBy(rows, (r) => r.total_pontos)

// Índice de cada participante na classificação FECHADA (só jogos encerrados).
function closedPositions(rows: RankEntry[]): Record<string, number> {
  return Object.fromEntries(
    sortBy(rows, (r) => r.total_pontos_fechado).map((e, i) => [e.user_id, i]),
  )
}

const POLL_MS = 30000

export default function RankingLiveClient({
  initialRanking,
  games,
  currentUserId,
  artilheiroPontos,
  melhorJogadorPontos,
  chances,
}: Props) {
  const supabase = createClient()
  const [ranking, setRanking] = useState<RankEntry[]>(sortRanking(initialRanking))
  const [liveGames, setLiveGames] = useState(games)
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState<Date>(new Date())

  // Setas relativas à classificação fechada (ver closedPositions): derivadas
  // direto de `ranking`, sem estado próprio.
  const closedPos = closedPositions(ranking)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const [{ data: rankRows }, { data: gameRows }] = await Promise.all([
      supabase.rpc('get_ranking'),
      supabase.from('games').select('id, data_hora, resultado_lancado, fase'),
    ])

    if (rankRows) {
      const mapped: RankEntry[] = (rankRows as Record<string, unknown>[]).map((r) => {
        const total = Number(r.total_pontos ?? 0)
        // Fallback: se a migração ainda não criou a coluna, usa o total atual
        // (fechado == atual → sem setas, degrada com segurança).
        const fechado = r.total_pontos_fechado == null ? total : Number(r.total_pontos_fechado)
        return {
          user_id: r.user_id as string,
          nome: r.nome as string,
          total_pontos: total,
          total_pontos_fechado: fechado,
          acertos_exatos: Number(r.acertos_exatos ?? 0),
          acertos_resultado: Number(r.acertos_resultado ?? 0),
          acertos_parciais: Number(r.acertos_parciais ?? 0),
          total_palpites: Number(r.total_palpites ?? 0),
        }
      })
      setRanking(sortRanking(mapped))
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

  // Quantos ainda podem levar o título (matematicamente).
  const vivosTitulo = ranking.filter((r) => chances[r.user_id]?.vivo_titulo).length

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
                acertos_parciais: e.acertos_parciais,
                total_palpites: e.total_palpites,
                chance: chances[e.user_id],
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

      {vivosTitulo > 0 && (
        <div className="mb-4 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2">
          🔥 <strong>{vivosTitulo}</strong>{' '}
          {vivosTitulo === 1
            ? 'participante ainda pode ser campeão'
            : 'participantes ainda podem ser campeões'}{' '}
          do bolão — tem muita coisa em jogo! ⚽
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-green-700 text-yellow-300">
                <th className="px-3 py-3 text-left text-sm font-bold">#</th>
                <th className="px-3 py-3 text-left text-sm font-bold">Participante</th>
                <th className="px-3 py-3 text-center text-sm font-bold">Pontos</th>
                <th className="px-3 py-3 text-center text-sm font-bold">Chance</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">⭐</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">✅</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden sm:table-cell">🟡</th>
                <th className="px-3 py-3 text-center text-sm font-bold hidden md:table-cell">Palpites</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Nenhum dado disponível ainda
                  </td>
                </tr>
              ) : (
                ranking.map((entry, idx) => {
                  const isMe = entry.user_id === currentUserId
                  const base = closedPos[entry.user_id]
                  const move: 'up' | 'down' | undefined =
                    base === undefined || base === idx ? undefined : idx < base ? 'up' : 'down'
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
                      <td className="px-3 py-3 text-center">
                        <ChanceCell c={chances[entry.user_id]} />
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
        <div className="mt-3 border-t pt-3 text-xs text-gray-500 space-y-1">
          <p>
            <strong className="text-gray-600">Coluna Chance (só diversão — não muda nada na pontuação):</strong>
          </p>
          <p>
            🏆 = probabilidade <strong>estimada</strong> de terminar em 1º e 🏅 = de terminar no
            pódio (top 3), simulando milhares de cenários para os jogos que faltam — incluindo o
            bônus de campeão (se a seleção do palpite ainda está viva) e os prêmios de artilheiro
            e melhor jogador ainda não definidos. É estimativa: mesmo perto de 100%, ainda existe
            (embora raro) um jeito de virar — por isso usamos o <strong>~</strong> na frente.
          </p>
          <p>
            <strong className="text-gray-600">🔒 garantido</strong> é diferente: significa que{' '}
            <strong>nem no pior caso</strong> (você erra tudo daqui pra frente, seu campeão já
            está fora) alguém te alcança, <strong>mesmo que os outros acertem tudo</strong>. Isso
            não é estimativa, é conta fechada.
          </p>
          <p>
            <strong className="text-gray-600">máx</strong> = teto matemático: a pontuação máxima
            que dá para alcançar gabaritando tudo daqui pra frente. 💀 = matematicamente fora
            até do top 3. Recalculado ao abrir a página.
          </p>
        </div>
      </div>
    </div>
  )
}
