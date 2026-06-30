'use client'

import { useState, useEffect } from 'react'
import { Game, Prediction } from '@/types'
import { getTipoAcerto, getTipoAcertoMataMata } from '@/lib/scoring'
import {
  getGameStatus,
  statusLabel,
  isGameLocked,
  formatHora,
  formatDataLonga,
} from '@/lib/match-utils'
import ShareCardButton from '@/components/ShareCardButton'

interface Participante {
  id: string
  nome: string
}

interface Props {
  games: Game[]
  predictions: Prediction[]
  participantes: Participante[]
  isToday: boolean
  dateKey: string
  currentUserId: string
}

export default function HojeClient({
  games,
  predictions,
  participantes,
  isToday,
  dateKey,
  currentUserId,
}: Props) {
  // "now" reativo para o status/bloqueio se atualizarem sozinhos durante o jogo.
  const [now, setNow] = useState<Date>(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const nomeById = (id: string) => participantes.find((p) => p.id === id)?.nome || 'Participante'
  const predsForGame = (gameId: string) => predictions.filter((p) => p.game_id === gameId)

  const firstName = (nome: string) => nome.split(' ')[0]

  if (games.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-green-800 mb-1">🗓️ Jogos de Hoje</h1>
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500 mt-4">
          <div className="text-4xl mb-3">😴</div>
          Nenhum jogo encontrado. Volte mais perto da próxima rodada!
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-1">🗓️ Jogos de Hoje</h1>
      {isToday ? (
        <p className="text-gray-500 text-sm mb-5 capitalize">{formatDataLonga(dateKey)}</p>
      ) : (
        <div className="mb-5">
          <p className="text-orange-600 text-sm font-semibold">
            Nenhum jogo hoje. Veja a próxima rodada:
          </p>
          <p className="text-gray-500 text-sm capitalize">{formatDataLonga(dateKey)}</p>
        </div>
      )}

      <div className="space-y-4">
        {games.map((game) => {
          const status = getGameStatus(game, now)
          const badge = statusLabel(status)
          const locked = isGameLocked(game, now)
          const preds = predsForGame(game.id)
          const myPred = preds.find((p) => p.user_id === currentUserId)
          // Pontos parciais: durante o jogo ao vivo já mostramos quanto cada um
          // está ganhando (a rota de sync recalcula predictions.pontos ao vivo).
          const hasScore = game.gols_casa_real != null && game.gols_fora_real != null
          const isLive = game.status === 'LIVE' && hasScore && !game.resultado_lancado
          const mostrarPontos = game.resultado_lancado || isLive

          return (
            <div key={game.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Cabeçalho do jogo */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-medium">
                    {game.fase === 'grupos' ? `Grupo ${game.grupo} • Rod. ${game.rodada} • ` : ''}
                    {formatHora(game.data_hora)}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.classes}`}>
                    {badge.emoji} {badge.text}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <div className="flex-1 text-right">
                    <div className="text-2xl leading-none">{game.bandeira_casa}</div>
                    <div className="font-bold text-gray-800 text-sm mt-1">{game.time_casa}</div>
                  </div>

                  {(() => {
                    const hasScore = game.gols_casa_real != null && game.gols_fora_real != null
                    const isLive = game.status === 'LIVE' && hasScore && !game.resultado_lancado
                    const showScore = game.resultado_lancado || isLive
                    const hasPenalty = game.gols_penaltis_casa != null && game.gols_penaltis_fora != null
                    return (
                      <div className="flex flex-col items-center min-w-[80px]">
                        {showScore ? (
                          <div className={`text-3xl font-extrabold leading-none ${isLive ? 'text-red-600' : 'text-green-700'}`}>
                            {game.gols_casa_real} <span className="text-gray-300">×</span> {game.gols_fora_real}
                          </div>
                        ) : (
                          <div className="text-2xl font-bold text-gray-300 leading-none">× </div>
                        )}
                        {isLive && (
                          <span className="text-[10px] text-red-600 mt-1 uppercase tracking-wide font-bold flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            ao vivo
                          </span>
                        )}
                        {game.resultado_lancado && !hasPenalty && (
                          <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">resultado</span>
                        )}
                        {game.resultado_lancado && hasPenalty && (
                          <div className="flex flex-col items-center mt-1 gap-0.5">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">tempo normal</span>
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                              pên: {game.gols_penaltis_casa}–{game.gols_penaltis_fora}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="flex-1 text-left">
                    <div className="text-2xl leading-none">{game.bandeira_fora}</div>
                    <div className="font-bold text-gray-800 text-sm mt-1">{game.time_fora}</div>
                  </div>
                </div>

                {/* Compartilhar meu palpite (apenas o próprio, sempre permitido) */}
                {myPred && (
                  <div className="mt-3 flex justify-center">
                    <ShareCardButton
                      label="📲 Compartilhar meu palpite"
                      filename={`vargonha-${game.time_casa}-x-${game.time_fora}.png`}
                      spec={{
                        type: 'palpite',
                        nome: nomeById(currentUserId),
                        timeCasa: game.time_casa,
                        timeFora: game.time_fora,
                        golsCasa: myPred.gols_casa,
                        golsFora: myPred.gols_fora,
                        dataHora: `${formatDataLonga(dateKey)} • ${formatHora(game.data_hora)}`,
                        bandeiraCasa: game.bandeira_casa,
                        bandeiraFora: game.bandeira_fora,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Palpites dos participantes */}
              <div className="px-4 py-3 bg-gray-50/60">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="text-xs font-bold text-gray-500 flex items-center gap-2">
                    👥 Palpites ({preds.length})
                    {isLive && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 normal-case">
                        pontuação parcial
                      </span>
                    )}
                  </div>
                  {locked && preds.length > 0 && (
                    <ShareCardButton
                      label="📲 Compartilhar palpites"
                      filename={`vargonha-palpites-${game.time_casa}-x-${game.time_fora}.png`}
                      shareText={`Palpites de ${game.time_casa} x ${game.time_fora} — VARgonha 🏆`}
                      className="inline-flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-800 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                      spec={{
                        type: 'jogo',
                        timeCasa: game.time_casa,
                        timeFora: game.time_fora,
                        bandeiraCasa: game.bandeira_casa,
                        bandeiraFora: game.bandeira_fora,
                        golsCasaReal: game.gols_casa_real,
                        golsForaReal: game.gols_fora_real,
                        encerrado: game.resultado_lancado,
                        statusText: `${badge.emoji} ${badge.text}`,
                        subtitulo: `${
                          game.fase === 'grupos' ? `Grupo ${game.grupo} • Rod. ${game.rodada} • ` : ''
                        }${formatHora(game.data_hora)}`,
                        palpites: preds
                          .slice()
                          .sort((a, b) => nomeById(a.user_id).localeCompare(nomeById(b.user_id)))
                          .map((p) => ({
                            nome: nomeById(p.user_id),
                            golsCasa: p.gols_casa,
                            golsFora: p.gols_fora,
                            pontos: game.resultado_lancado ? p.pontos : null,
                          })),
                      }}
                    />
                  )}
                </div>

                {!locked ? (
                  <div className="text-xs text-gray-400 py-2 text-center">
                    🔒 Os palpites de todos ficam visíveis quando o jogo começar.
                  </div>
                ) : preds.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 text-center">Ninguém palpitou neste jogo.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {preds
                      .slice()
                      .sort((a, b) => nomeById(a.user_id).localeCompare(nomeById(b.user_id)))
                      .map((p) => {
                        const isMe = p.user_id === currentUserId
                        const acertou = mostrarPontos
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                              isMe ? 'bg-yellow-50 border border-yellow-200' : 'bg-white border border-gray-100'
                            }`}
                          >
                            <span className="font-medium text-gray-700 truncate">
                              {firstName(nomeById(p.user_id))}
                              {isMe && <span className="text-[10px] text-green-600 ml-1">(você)</span>}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <span className="font-bold text-green-800">
                                {p.gols_casa}×{p.gols_fora}
                              </span>
                              {acertou && (() => {
                                const isKo = game.fase !== 'grupos'
                                const label = isKo ? getTipoAcertoMataMata(p.pontos) : getTipoAcerto(p.pontos)
                                const topTier = isKo ? 15 : 15
                                const midTier = isKo ? 7 : 10
                                const lowTier = isKo ? 1 : 5
                                const colorClass =
                                  p.pontos >= topTier
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : p.pontos >= midTier
                                    ? 'bg-green-100 text-green-700'
                                    : p.pontos >= lowTier
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                return (
                                  <span title={label} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass}`}>
                                    +{p.pontos}
                                  </span>
                                )
                              })()}
                            </span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
