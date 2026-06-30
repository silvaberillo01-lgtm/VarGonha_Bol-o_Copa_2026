'use client'

import { useState, useEffect, useMemo } from 'react'
import { Game, Prediction } from '@/types'
import { DEADLINE_FASE1, getTipoAcerto, getTipoAcertoMataMata } from '@/lib/scoring'
import { knockoutLockTime } from '@/lib/match-utils'
import { computeUserBracket, GroupGameResult, KnockoutPick, ResolvedMatch } from '@/lib/bracket'
import { normalizeTeam, isSelecao } from '@/lib/teams'

interface Props {
  games: Game[]
  predictions: Prediction[]
  userId: string
  champion: string | null
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const KNOCKOUT_FASES: { key: string; label: string }[] = [
  { key: 'fase32', label: '1/16 avos' },
  { key: 'oitavas', label: 'Oitavas' },
  { key: 'quartas', label: 'Quartas' },
  { key: 'semis', label: 'Semifinal' },
  { key: 'terceiro', label: '3º Lugar' },
  { key: 'final', label: 'Final' },
]

const numFromCode = (code?: string | null) => (code ? parseInt(code.replace(/^M/, '')) : NaN)

export default function DashboardClient({ games, predictions, champion }: Props) {
  const [mainTab, setMainTab] = useState<'grupos' | 'eliminatoria'>('grupos')
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [selectedKoFase, setSelectedKoFase] = useState('fase32')
  const [localPredictions, setLocalPredictions] = useState<Record<string, { casa: string; fora: string }>>({})
  const [localClassificado, setLocalClassificado] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isPastGroupDeadline = new Date() > DEADLINE_FASE1

  const groupGames = games.filter((g) => g.fase === 'grupos')
  const knockoutGames = games.filter((g) => g.fase !== 'grupos')
  const hasKnockout = knockoutGames.length > 0

  useEffect(() => {
    const initialPreds: Record<string, { casa: string; fora: string }> = {}
    const initialClass: Record<string, string> = {}
    predictions.forEach((p) => {
      initialPreds[p.game_id] = { casa: p.gols_casa.toString(), fora: p.gols_fora.toString() }
      if (p.classificado_palpite) initialClass[p.game_id] = p.classificado_palpite
    })
    setLocalPredictions(initialPreds)
    setLocalClassificado(initialClass)
  }, [predictions])

  const getPrediction = (gameId: string) => predictions.find((p) => p.game_id === gameId)
  const getLocalPred = (gameId: string) => localPredictions[gameId] || { casa: '', fora: '' }

  // Chaveamento derivado do próprio usuário (grupos -> mata-mata, com campeão).
  const bracket = useMemo<Record<number, ResolvedMatch>>(() => {
    const predByGame = new Map(predictions.map((p) => [p.game_id, p]))
    const groupResults: GroupGameResult[] = []
    const knockoutPicks: Record<number, KnockoutPick> = {}

    groupGames.forEach((g) => {
      const p = predByGame.get(g.id)
      if (p) {
        groupResults.push({
          grupo: g.grupo as string,
          time_casa: g.time_casa,
          time_fora: g.time_fora,
          gols_casa: p.gols_casa,
          gols_fora: p.gols_fora,
        })
      }
    })
    const fase32Teams: Record<number, { time_casa: string | null; time_fora: string | null }> = {}
    knockoutGames.forEach((g) => {
      const num = numFromCode(g.match_code)
      if (isNaN(num)) return
      const p = predByGame.get(g.id)
      knockoutPicks[num] = {
        classificado_palpite: localClassificado[g.id] ?? p?.classificado_palpite ?? null,
        gols_casa: p?.gols_casa ?? null,
        gols_fora: p?.gols_fora ?? null,
      }
      // 16 avos: confronto real do admin (igual pra todos).
      if (g.fase === 'fase32') {
        fase32Teams[num] = { time_casa: g.time_casa || null, time_fora: g.time_fora || null }
      }
    })
    return computeUserBracket(groupResults, knockoutPicks, champion, fase32Teams)
  }, [predictions, groupGames, knockoutGames, localClassificado, champion])

  const isGroupLocked = (game: Game) => isPastGroupDeadline || game.resultado_lancado
  const isKnockoutLocked = (game: Game) =>
    new Date() > knockoutLockTime(game.data_hora) || game.resultado_lancado

  const handleChange = (gameId: string, side: 'casa' | 'fora', value: string) => {
    if (value !== '' && (isNaN(parseInt(value)) || parseInt(value) < 0)) return
    setLocalPredictions((prev) => ({ ...prev, [gameId]: { ...prev[gameId], [side]: value } }))
    setSaved((prev) => ({ ...prev, [gameId]: false }))
  }

  // Mata-mata: ao mudar o placar, se não for empate, define automaticamente o
  // classificado como o vencedor pelo placar.
  const handleKnockoutScore = (game: Game, side: 'casa' | 'fora', value: string) => {
    if (value !== '' && (isNaN(parseInt(value)) || parseInt(value) < 0)) return
    setSaved((prev) => ({ ...prev, [game.id]: false }))
    setLocalPredictions((prev) => {
      const next = { ...(prev[game.id] || { casa: '', fora: '' }), [side]: value }
      const casa = parseInt(next.casa)
      const fora = parseInt(next.fora)
      const r = bracket[numFromCode(game.match_code)]
      const champInMatch = !!champion && (champion === r?.time_casa || champion === r?.time_fora)
      // Campeão sempre avança: não deixa o placar mudar quem passa.
      if (!champInMatch && !isNaN(casa) && !isNaN(fora) && casa !== fora && r?.time_casa && r?.time_fora) {
        const winner = casa > fora ? r.time_casa : r.time_fora
        setLocalClassificado((c) => ({ ...c, [game.id]: winner }))
      }
      return { ...prev, [game.id]: next }
    })
  }

  const handleSaveGroup = async (gameId: string) => {
    const pred = localPredictions[gameId]
    if (!pred || pred.casa === '' || pred.fora === '') {
      setErrors((prev) => ({ ...prev, [gameId]: 'Preencha ambos os campos.' }))
      return
    }
    const golsCasa = parseInt(pred.casa)
    const golsFora = parseInt(pred.fora)
    setSaving((prev) => ({ ...prev, [gameId]: true }))
    setErrors((prev) => ({ ...prev, [gameId]: '' }))
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, gols_casa: golsCasa, gols_fora: golsFora }),
    })
    setSaving((prev) => ({ ...prev, [gameId]: false }))
    if (response.ok) setSaved((prev) => ({ ...prev, [gameId]: true }))
    else {
      const data = await response.json()
      setErrors((prev) => ({ ...prev, [gameId]: data.error || 'Erro ao salvar.' }))
    }
  }

  const handleSaveKnockout = async (game: Game) => {
    const gameId = game.id
    const pred = localPredictions[gameId]
    if (!pred || pred.casa === '' || pred.fora === '') {
      setErrors((prev) => ({ ...prev, [gameId]: 'Preencha o placar.' }))
      return
    }
    const golsCasa = parseInt(pred.casa)
    const golsFora = parseInt(pred.fora)
    const r = bracket[numFromCode(game.match_code)]
    const champInMatch = !!champion && (champion === r?.time_casa || champion === r?.time_fora)
    let classificado = localClassificado[gameId]
    // Campeão sempre avança: se está no confronto, ele é quem passa (sobrepõe).
    if (champInMatch) {
      classificado = champion as string
    } else if (golsCasa !== golsFora && r?.time_casa && r?.time_fora) {
      classificado = golsCasa > golsFora ? r.time_casa : r.time_fora
    }
    if (!classificado && r?.time_casa && r?.time_fora) {
      setErrors((prev) => ({ ...prev, [gameId]: 'Empate: escolha quem passa nos pênaltis.' }))
      return
    }
    setSaving((prev) => ({ ...prev, [gameId]: true }))
    setErrors((prev) => ({ ...prev, [gameId]: '' }))
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: gameId,
        gols_casa: golsCasa,
        gols_fora: golsFora,
        classificado_palpite: classificado || null,
      }),
    })
    setSaving((prev) => ({ ...prev, [gameId]: false }))
    if (response.ok) setSaved((prev) => ({ ...prev, [gameId]: true }))
    else {
      const data = await response.json()
      setErrors((prev) => ({ ...prev, [gameId]: data.error || 'Erro ao salvar.' }))
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })

  const getTimeUntilDeadline = () => {
    const diff = DEADLINE_FASE1.getTime() - Date.now()
    if (diff <= 0) return null
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes} minutos`
  }

  const timeLeft = getTimeUntilDeadline()

  // -------- Card da fase de grupos --------
  const renderGroupCard = (game: Game) => {
    const existingPred = getPrediction(game.id)
    const localPred = getLocalPred(game.id)
    const isLocked = isGroupLocked(game)

    return (
      <div key={game.id}
        className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
          game.resultado_lancado ? 'border-gray-200'
            : isLocked ? 'border-gray-200'
            : existingPred ? 'border-green-300' : 'border-yellow-300'
        }`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium">
            Grupo {game.grupo} • Rodada {game.rodada} • {formatDate(game.data_hora)}
          </span>
          {isLocked ? <span className="text-xs text-gray-400">🔒 Bloqueado</span>
            : existingPred ? <span className="text-xs text-green-600">✓ Salvo</span>
            : <span className="text-xs text-yellow-600">● Pendente</span>}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <div className="text-lg">{game.bandeira_casa}</div>
            <div className="font-bold text-gray-800 text-sm">{game.time_casa}</div>
          </div>
          <div className="flex items-center gap-2">
            {game.resultado_lancado ? (
              <div className="flex items-center gap-2 text-lg font-bold">
                <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">{game.gols_casa_real}</span>
                <span className="text-gray-400">×</span>
                <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">{game.gols_fora_real}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="99" value={localPred.casa}
                  onChange={(e) => handleChange(game.id, 'casa', e.target.value)} disabled={isLocked}
                  className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'}`} placeholder="-" />
                <span className="text-gray-400 font-bold">×</span>
                <input type="number" min="0" max="99" value={localPred.fora}
                  onChange={(e) => handleChange(game.id, 'fora', e.target.value)} disabled={isLocked}
                  className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'}`} placeholder="-" />
              </div>
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="text-lg">{game.bandeira_fora}</div>
            <div className="font-bold text-gray-800 text-sm">{game.time_fora}</div>
          </div>
        </div>

        {game.resultado_lancado && existingPred && (
          <div className="mt-3 text-center">
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
              existingPred.pontos === 15 ? 'bg-yellow-100 text-yellow-700'
                : existingPred.pontos === 10 ? 'bg-green-100 text-green-700'
                : existingPred.pontos === 5 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
              {getTipoAcerto(existingPred.pontos)} • {existingPred.pontos} pts
            </span>
            <div className="text-xs text-gray-500 mt-1">Seu palpite: {existingPred.gols_casa} × {existingPred.gols_fora}</div>
          </div>
        )}

        {!isLocked && (
          <div className="mt-3 flex items-center justify-between">
            {errors[game.id] ? <span className="text-red-500 text-xs">{errors[game.id]}</span>
              : saved[game.id] ? <span className="text-green-600 text-xs">✓ Palpite salvo!</span> : <span />}
            <button onClick={() => handleSaveGroup(game.id)} disabled={saving[game.id]}
              className="ml-auto bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
              {saving[game.id] ? 'Salvando...' : existingPred ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // -------- Card do mata-mata --------
  const renderKnockoutCard = (game: Game) => {
    const num = numFromCode(game.match_code)
    const resolved = bracket[num]
    const existingPred = getPrediction(game.id)
    const localPred = getLocalPred(game.id)
    const isLocked = isKnockoutLocked(game)

    // Times derivados do chaveamento do PRÓPRIO usuário (base da pontuação).
    const derivedCasa = resolved?.time_casa ?? null
    const derivedFora = resolved?.time_fora ?? null
    // Times REAIS do confronto (quando o admin já definiu quem passou de fato).
    const realCasa = isSelecao(game.time_casa) ? (normalizeTeam(game.time_casa) as string) : null
    const realFora = isSelecao(game.time_fora) ? (normalizeTeam(game.time_fora) as string) : null

    // Mostra os times REAIS para palpitar quando: (1) o admin já definiu o
    // confronto e (2) o chaveamento do usuário também resolveu este jogo — assim
    // conseguimos mapear o "quem passa" ao lado certo sem mudar a pontuação.
    const showReal = !game.resultado_lancado && !!realCasa && !!realFora && !!derivedCasa && !!derivedFora

    // Rótulos exibidos (reais quando showReal); a lógica/pontuação segue derivada.
    const betCasa = game.resultado_lancado ? game.time_casa : showReal ? realCasa : derivedCasa
    const betFora = game.resultado_lancado ? game.time_fora : showReal ? realFora : derivedFora
    const undecided = !game.resultado_lancado && (!betCasa || !betFora)

    // Campeão sempre avança: se o campeão palpitado está no confronto (derivado),
    // ele é forçado como "quem passa" (não editável) em qualquer fase.
    const forcedChamp =
      champion && (champion === derivedCasa || champion === derivedFora) ? champion : null
    const classificado = forcedChamp ?? localClassificado[game.id] ?? undefined
    const casa = parseInt(localPred.casa)
    const fora = parseInt(localPred.fora)
    const isDraw = !isNaN(casa) && !isNaN(fora) && casa === fora

    // Seletor "quem passa": rótulo é o time real (quando showReal), mas o valor
    // gravado é sempre o time DERIVADO daquele lado (mantém a pontuação intacta).
    const sides = [
      { label: betCasa, pick: derivedCasa },
      { label: betFora, pick: derivedFora },
    ]
    const mismatch = showReal && (derivedCasa !== realCasa || derivedFora !== realFora)
    const acertosClass = (derivedCasa === realCasa ? 1 : 0) + (derivedFora === realFora ? 1 : 0)

    // Após o resultado: a previsão do chaveamento bateu com o confronto real?
    const bracketMissReal =
      game.resultado_lancado && !!existingPred &&
      (normalizeTeam(existingPred.time_casa_palpite) !== normalizeTeam(game.time_casa) ||
        normalizeTeam(existingPred.time_fora_palpite) !== normalizeTeam(game.time_fora))
    // Time real do lado em que o usuário apostou que passava (mapeado do derivado).
    const pickedRealTeam = existingPred?.classificado_palpite
      ? normalizeTeam(existingPred.classificado_palpite) === normalizeTeam(existingPred.time_casa_palpite)
        ? game.time_casa
        : game.time_fora
      : null

    return (
      <div key={game.id}
        className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
          game.resultado_lancado ? 'border-gray-200'
            : isLocked ? 'border-gray-200'
            : existingPred ? 'border-green-300' : 'border-yellow-300'}`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium">
            {KNOCKOUT_FASES.find((f) => f.key === game.fase)?.label} • {formatDate(game.data_hora)}
          </span>
          {game.resultado_lancado ? <span className="text-xs text-gray-400">✔️ Encerrado</span>
            : isLocked ? <span className="text-xs text-gray-400">🔒 Fechado</span>
            : existingPred ? <span className="text-xs text-green-600">✓ Salvo</span>
            : <span className="text-xs text-yellow-600">● Pendente</span>}
        </div>

        {undecided ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Confronto a definir — complete seus palpites das fases anteriores.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-right font-bold text-gray-800 text-sm">{betCasa}</div>
              <div className="flex items-center gap-2">
                {game.resultado_lancado ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2 text-lg font-bold">
                      <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">{game.gols_casa_real}</span>
                      <span className="text-gray-400">×</span>
                      <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">{game.gols_fora_real}</span>
                    </div>
                    {game.gols_penaltis_casa != null && game.gols_penaltis_fora != null && (
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                        pên: {game.gols_penaltis_casa}–{game.gols_penaltis_fora}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="99" value={localPred.casa}
                      onChange={(e) => handleKnockoutScore(game, 'casa', e.target.value)} disabled={isLocked}
                      className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'}`} placeholder="-" />
                    <span className="text-gray-400 font-bold">×</span>
                    <input type="number" min="0" max="99" value={localPred.fora}
                      onChange={(e) => handleKnockoutScore(game, 'fora', e.target.value)} disabled={isLocked}
                      className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                        isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'}`} placeholder="-" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-left font-bold text-gray-800 text-sm">{betFora}</div>
            </div>

            {/* Aviso: confronto real diferente do que o chaveamento do usuário previu */}
            {mismatch && (
              <div className="mt-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 leading-relaxed">
                ⚠️ Você está palpitando no <strong>jogo real</strong>. Seu chaveamento previa{' '}
                <strong>{derivedCasa} × {derivedFora}</strong>, mas quem passou foi{' '}
                <strong>{realCasa} × {realFora}</strong>. Você pontua pelo placar, mas como acertou{' '}
                {acertosClass}/2 dos classificados, <strong>não terá a pontuação máxima</strong> deste jogo.
              </div>
            )}

            {/* Quem se classifica (pênaltis em caso de empate) */}
            {!game.resultado_lancado && !isLocked && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1 text-center">
                  {forcedChamp ? '🏆 Seu campeão avança automaticamente'
                    : isDraw ? '🥅 Empate — quem passa nos pênaltis?' : 'Quem se classifica'}
                </p>
                <div className="flex gap-2 justify-center">
                  {sides.map((s) => (
                    <button key={(s.pick ?? s.label) as string} type="button"
                      onClick={() => { if (forcedChamp) return; setLocalClassificado((c) => ({ ...c, [game.id]: s.pick as string })); setSaved((st) => ({ ...st, [game.id]: false })) }}
                      disabled={!!forcedChamp ? classificado !== s.pick : (!isDraw && classificado === s.pick)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-colors ${
                        classificado === s.pick ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'} ${forcedChamp && classificado !== s.pick ? 'opacity-40' : ''}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {game.resultado_lancado && (
              <div className="mt-2 text-center text-xs text-gray-500">
                Classificado: <strong>{game.classificado_real}</strong>
              </div>
            )}

            {game.resultado_lancado && existingPred && (
              <div className="mt-3 text-center">
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  existingPred.pontos >= 15 ? 'bg-yellow-100 text-yellow-700'
                    : existingPred.pontos >= 7 ? 'bg-green-100 text-green-700'
                    : existingPred.pontos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                  {getTipoAcertoMataMata(existingPred.pontos)} • {existingPred.pontos} pts
                </span>
                <div className="text-xs text-gray-500 mt-1">
                  Seu palpite: <strong>{game.time_casa} {existingPred.gols_casa} × {existingPred.gols_fora} {game.time_fora}</strong>
                  {pickedRealTeam ? ` (você apostou que passava: ${pickedRealTeam})` : ''}
                </div>
                {bracketMissReal && (
                  <div className="text-[11px] text-amber-600 mt-0.5">
                    Seu chaveamento previa {existingPred.time_casa_palpite} × {existingPred.time_fora_palpite}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isLocked && !undecided && (
          <div className="mt-3 flex items-center justify-between">
            {errors[game.id] ? <span className="text-red-500 text-xs">{errors[game.id]}</span>
              : saved[game.id] ? <span className="text-green-600 text-xs">✓ Palpite salvo!</span>
              : <span className="text-xs text-gray-400">Fecha 30 min antes</span>}
            <button onClick={() => handleSaveKnockout(game)} disabled={saving[game.id]}
              className="ml-auto bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
              {saving[game.id] ? 'Salvando...' : existingPred ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Main tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMainTab('grupos')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
            mainTab === 'grupos' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'}`}>
          ⚽ Fase de Grupos
        </button>
        <button onClick={() => setMainTab('eliminatoria')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all relative ${
            mainTab === 'eliminatoria' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'}`}>
          🏆 Fase Eliminatória
          {!hasKnockout && <span className="ml-1 text-xs opacity-60">(em breve)</span>}
        </button>
      </div>

      {/* GRUPOS */}
      {mainTab === 'grupos' && (
        <div>
          <div className="mb-4">
            {timeLeft ? (
              <div className="inline-flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm px-4 py-2 rounded-lg">
                ⏰ Prazo para palpites: <strong>{timeLeft}</strong>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 text-sm px-4 py-2 rounded-lg">
                🔒 Prazo encerrado! Palpites bloqueados.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-6 bg-white p-2 rounded-xl shadow-sm">
            {GROUPS.map((group) => (
              <button key={group} onClick={() => setSelectedGroup(group)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  selectedGroup === group ? 'bg-green-700 text-yellow-400 shadow-md' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'}`}>
                Grupo {group}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {groupGames.filter((g) => g.grupo === selectedGroup).length === 0 ? (
              <div className="text-center py-12 text-gray-500">Nenhum jogo encontrado para o Grupo {selectedGroup}</div>
            ) : (
              groupGames.filter((g) => g.grupo === selectedGroup).map(renderGroupCard)
            )}
          </div>
        </div>
      )}

      {/* ELIMINATÓRIA */}
      {mainTab === 'eliminatoria' && (
        <div>
          {!hasKnockout ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="text-5xl mb-4">🏆</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Fase Eliminatória</h2>
              <p className="text-gray-500">
                Os jogos da fase eliminatória serão disponibilizados pelo administrador
                após o fim da fase de grupos.
              </p>
            </div>
          ) : (
            <div>
              <div className="bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg px-3 py-2 mb-4">
                💡 Seu confronto em cada fase vem dos seus palpites de grupos e de quem você faz avançar.
                O palpite fica aberto até <strong>30 min antes</strong> de cada jogo.
              </div>
              <div className="flex flex-wrap gap-1 mb-6 bg-white p-2 rounded-xl shadow-sm">
                {KNOCKOUT_FASES.filter((f) => knockoutGames.some((g) => g.fase === f.key)).map((f) => (
                  <button key={f.key} onClick={() => setSelectedKoFase(f.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      selectedKoFase === f.key ? 'bg-green-700 text-yellow-400 shadow-md' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {knockoutGames.filter((g) => g.fase === selectedKoFase).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">Nenhum jogo nesta fase ainda.</div>
                ) : (
                  knockoutGames
                    .filter((g) => g.fase === selectedKoFase)
                    .sort((a, b) => numFromCode(a.match_code) - numFromCode(b.match_code))
                    .map(renderKnockoutCard)
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
