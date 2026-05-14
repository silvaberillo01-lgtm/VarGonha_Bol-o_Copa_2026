'use client'

import { useState, useEffect } from 'react'
import { Game, Prediction } from '@/types'
import { DEADLINE_FASE1, getTipoAcerto } from '@/lib/scoring'

interface Props {
  games: Game[]
  predictions: Prediction[]
  userId: string
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const KNOCKOUT_FASES: { key: string; label: string }[] = [
  { key: 'fase32', label: 'Fase de 32' },
  { key: 'oitavas', label: 'Oitavas' },
  { key: 'quartas', label: 'Quartas' },
  { key: 'semis', label: 'Semifinal' },
  { key: 'terceiro', label: '3º Lugar' },
  { key: 'final', label: 'Final' },
]

export default function DashboardClient({ games, predictions, userId }: Props) {
  const [mainTab, setMainTab] = useState<'grupos' | 'eliminatoria'>('grupos')
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [selectedKoFase, setSelectedKoFase] = useState('fase32')
  const [localPredictions, setLocalPredictions] = useState<Record<string, { casa: string; fora: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isPastGroupDeadline = new Date() > DEADLINE_FASE1

  const groupGames = games.filter((g) => g.fase === 'grupos')
  const knockoutGames = games.filter((g) => g.fase !== 'grupos')

  const hasKnockout = knockoutGames.length > 0

  useEffect(() => {
    const initialPreds: Record<string, { casa: string; fora: string }> = {}
    predictions.forEach((p) => {
      initialPreds[p.game_id] = {
        casa: p.gols_casa.toString(),
        fora: p.gols_fora.toString(),
      }
    })
    setLocalPredictions(initialPreds)
  }, [predictions])

  const getPrediction = (gameId: string) => predictions.find((p) => p.game_id === gameId)
  const getLocalPred = (gameId: string) => localPredictions[gameId] || { casa: '', fora: '' }

  const isGameLocked = (game: Game) => {
    if (game.fase === 'grupos') return isPastGroupDeadline || game.resultado_lancado
    return new Date() > new Date(game.data_hora) || game.resultado_lancado
  }

  const handleChange = (gameId: string, side: 'casa' | 'fora', value: string) => {
    if (value !== '' && (isNaN(parseInt(value)) || parseInt(value) < 0)) return
    setLocalPredictions((prev) => ({ ...prev, [gameId]: { ...prev[gameId], [side]: value } }))
    setSaved((prev) => ({ ...prev, [gameId]: false }))
  }

  const handleSave = async (gameId: string) => {
    const pred = localPredictions[gameId]
    if (!pred || pred.casa === '' || pred.fora === '') {
      setErrors((prev) => ({ ...prev, [gameId]: 'Preencha ambos os campos.' }))
      return
    }
    const golsCasa = parseInt(pred.casa)
    const golsFora = parseInt(pred.fora)
    if (isNaN(golsCasa) || isNaN(golsFora) || golsCasa < 0 || golsFora < 0) {
      setErrors((prev) => ({ ...prev, [gameId]: 'Valores inválidos.' }))
      return
    }
    setSaving((prev) => ({ ...prev, [gameId]: true }))
    setErrors((prev) => ({ ...prev, [gameId]: '' }))

    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, gols_casa: golsCasa, gols_fora: golsFora }),
    })

    setSaving((prev) => ({ ...prev, [gameId]: false }))
    if (response.ok) {
      setSaved((prev) => ({ ...prev, [gameId]: true }))
    } else {
      const data = await response.json()
      setErrors((prev) => ({ ...prev, [gameId]: data.error || 'Erro ao salvar.' }))
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

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

  const renderGameCard = (game: Game) => {
    const existingPred = getPrediction(game.id)
    const localPred = getLocalPred(game.id)
    const isLocked = isGameLocked(game)
    const isSaving = saving[game.id]
    const isSaved = saved[game.id]
    const errorMsg = errors[game.id]

    return (
      <div
        key={game.id}
        className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
          game.resultado_lancado ? 'border-gray-200'
            : isLocked ? 'border-gray-200'
            : (existingPred || isSaved) ? 'border-green-300'
            : 'border-yellow-300'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium">
            {game.fase === 'grupos' ? `Grupo ${game.grupo} • Rodada ${game.rodada} • ` : ''}
            {formatDate(game.data_hora)}
          </span>
          {isLocked ? (
            <span className="text-xs text-gray-400">🔒 Bloqueado</span>
          ) : (existingPred || isSaved) ? (
            <span className="text-xs text-green-600">✓ Salvo</span>
          ) : (
            <span className="text-xs text-yellow-600">● Pendente</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <div className="text-lg">{game.bandeira_casa}</div>
            <div className="font-bold text-gray-800 text-sm">{game.time_casa}</div>
          </div>

          <div className="flex items-center gap-2">
            {game.resultado_lancado ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-lg font-bold">
                  <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">
                    {game.gols_casa_real}
                  </span>
                  <span className="text-gray-400">×</span>
                  <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">
                    {game.gols_fora_real}
                  </span>
                </div>
                {game.penaltis_casa !== null && game.penaltis_fora !== null && (
                  <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                    Pên: {game.penaltis_casa} × {game.penaltis_fora}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="99" value={localPred.casa}
                  onChange={(e) => handleChange(game.id, 'casa', e.target.value)}
                  disabled={isLocked}
                  className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'
                  }`}
                  placeholder="-"
                />
                <span className="text-gray-400 font-bold">×</span>
                <input type="number" min="0" max="99" value={localPred.fora}
                  onChange={(e) => handleChange(game.id, 'fora', e.target.value)}
                  disabled={isLocked}
                  className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    isLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-green-300 text-green-800'
                  }`}
                  placeholder="-"
                />
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
                : existingPred.pontos === 5 ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {getTipoAcerto(existingPred.pontos)} • {existingPred.pontos} pts
            </span>
            <div className="text-xs text-gray-500 mt-1">
              Seu palpite: {existingPred.gols_casa} × {existingPred.gols_fora}
            </div>
          </div>
        )}

        {!isLocked && (
          <div className="mt-3 flex items-center justify-between">
            {errorMsg ? <span className="text-red-500 text-xs">{errorMsg}</span>
              : isSaved ? <span className="text-green-600 text-xs">✓ Palpite salvo!</span>
              : <span />}
            <button onClick={() => handleSave(game.id)} disabled={isSaving}
              className="ml-auto bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50">
              {isSaving ? 'Salvando...' : (existingPred || isSaved) ? 'Atualizar' : 'Salvar'}
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
            mainTab === 'grupos' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'
          }`}>
          ⚽ Fase de Grupos
        </button>
        <button onClick={() => setMainTab('eliminatoria')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all relative ${
            mainTab === 'eliminatoria' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'
          }`}>
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
                  selectedGroup === group ? 'bg-green-700 text-yellow-400 shadow-md' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                }`}>
                Grupo {group}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {groupGames.filter((g) => g.grupo === selectedGroup).length === 0 ? (
              <div className="text-center py-12 text-gray-500">Nenhum jogo encontrado para o Grupo {selectedGroup}</div>
            ) : (
              groupGames.filter((g) => g.grupo === selectedGroup).map(renderGameCard)
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
                após o fim da fase de grupos (a partir de 29/06/2026).
              </p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-1 mb-6 bg-white p-2 rounded-xl shadow-sm">
                {KNOCKOUT_FASES.filter((f) => knockoutGames.some((g) => g.fase === f.key)).map((f) => (
                  <button key={f.key} onClick={() => setSelectedKoFase(f.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      selectedKoFase === f.key ? 'bg-green-700 text-yellow-400 shadow-md' : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {knockoutGames.filter((g) => g.fase === selectedKoFase).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">Nenhum jogo nesta fase ainda.</div>
                ) : (
                  knockoutGames.filter((g) => g.fase === selectedKoFase).map(renderGameCard)
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
