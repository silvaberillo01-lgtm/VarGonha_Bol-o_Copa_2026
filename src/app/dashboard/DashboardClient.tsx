'use client'

import { useState, useEffect } from 'react'
import { Game, Prediction } from '@/types'
import { DEADLINE_FASE1, getTipoAcerto } from '@/lib/scoring'
import { createClient } from '@/lib/supabase'

interface Props {
  games: Game[]
  predictions: Prediction[]
  userId: string
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function DashboardClient({ games, predictions, userId }: Props) {
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [localPredictions, setLocalPredictions] = useState<Record<string, { casa: string; fora: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const supabase = createClient()

  const isPastDeadline = new Date() > DEADLINE_FASE1

  // Initialize local predictions from existing data
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

  const filteredGames = games.filter((g) => g.grupo === selectedGroup)

  const getPrediction = (gameId: string) => {
    return predictions.find((p) => p.game_id === gameId)
  }

  const getLocalPred = (gameId: string) => {
    return localPredictions[gameId] || { casa: '', fora: '' }
  }

  const handleChange = (gameId: string, side: 'casa' | 'fora', value: string) => {
    if (value !== '' && (isNaN(parseInt(value)) || parseInt(value) < 0)) return
    setLocalPredictions((prev) => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [side]: value,
      },
    }))
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
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeUntilDeadline = () => {
    const now = new Date()
    const diff = DEADLINE_FASE1.getTime() - now.getTime()
    if (diff <= 0) return null

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes} minutos`
  }

  const timeLeft = getTimeUntilDeadline()

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-800">⚽ Meus Palpites - Fase de Grupos</h1>
        {timeLeft ? (
          <div className="mt-2 inline-flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 text-sm px-4 py-2 rounded-lg">
            ⏰ Prazo para palpites: <strong>{timeLeft}</strong>
          </div>
        ) : (
          <div className="mt-2 inline-flex items-center gap-2 bg-red-100 border border-red-300 text-red-700 text-sm px-4 py-2 rounded-lg">
            🔒 Prazo encerrado! Palpites bloqueados.
          </div>
        )}
      </div>

      {/* Group Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 bg-white p-2 rounded-xl shadow-sm">
        {GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => setSelectedGroup(group)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              selectedGroup === group
                ? 'bg-green-700 text-yellow-400 shadow-md'
                : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
            }`}
          >
            Grupo {group}
          </button>
        ))}
      </div>

      {/* Games List */}
      <div className="space-y-4">
        {filteredGames.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhum jogo encontrado para o Grupo {selectedGroup}
          </div>
        ) : (
          filteredGames.map((game) => {
            const existingPred = getPrediction(game.id)
            const localPred = getLocalPred(game.id)
            const isLocked = isPastDeadline || game.resultado_lancado
            const isSaving = saving[game.id]
            const isSaved = saved[game.id]
            const errorMsg = errors[game.id]

            return (
              <div
                key={game.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-5 transition-all ${
                  game.resultado_lancado
                    ? 'border-gray-200'
                    : isLocked
                    ? 'border-gray-200'
                    : existingPred
                    ? 'border-green-300'
                    : 'border-yellow-300'
                }`}
              >
                {/* Game Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-medium">
                    Rodada {game.rodada} • {formatDate(game.data_hora)}
                  </span>
                  {isLocked && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      🔒 Bloqueado
                    </span>
                  )}
                  {!isLocked && existingPred && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      ✓ Salvo
                    </span>
                  )}
                  {!isLocked && !existingPred && (
                    <span className="text-xs text-yellow-600 flex items-center gap-1">
                      ● Pendente
                    </span>
                  )}
                </div>

                {/* Teams and Score */}
                <div className="flex items-center gap-3">
                  {/* Home Team */}
                  <div className="flex-1 text-right">
                    <div className="text-lg">{game.bandeira_casa}</div>
                    <div className="font-bold text-gray-800 text-sm">{game.time_casa}</div>
                  </div>

                  {/* Score Input or Result */}
                  <div className="flex items-center gap-2">
                    {game.resultado_lancado ? (
                      <div className="flex items-center gap-2 text-lg font-bold">
                        <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">
                          {game.gols_casa_real}
                        </span>
                        <span className="text-gray-400">×</span>
                        <span className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">
                          {game.gols_fora_real}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={localPred.casa}
                          onChange={(e) => handleChange(game.id, 'casa', e.target.value)}
                          disabled={isLocked}
                          className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            isLocked
                              ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                              : 'border-green-300 text-green-800'
                          }`}
                          placeholder="-"
                        />
                        <span className="text-gray-400 font-bold">×</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={localPred.fora}
                          onChange={(e) => handleChange(game.id, 'fora', e.target.value)}
                          disabled={isLocked}
                          className={`w-12 h-10 text-center text-lg font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                            isLocked
                              ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                              : 'border-green-300 text-green-800'
                          }`}
                          placeholder="-"
                        />
                      </div>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex-1 text-left">
                    <div className="text-lg">{game.bandeira_fora}</div>
                    <div className="font-bold text-gray-800 text-sm">{game.time_fora}</div>
                  </div>
                </div>

                {/* Result and points if game is done */}
                {game.resultado_lancado && existingPred && (
                  <div className="mt-3 text-center">
                    <span
                      className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                        existingPred.pontos === 15
                          ? 'bg-yellow-100 text-yellow-700'
                          : existingPred.pontos === 10
                          ? 'bg-green-100 text-green-700'
                          : existingPred.pontos === 5
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {getTipoAcerto(existingPred.pontos)} • {existingPred.pontos} pts
                    </span>
                    <div className="text-xs text-gray-500 mt-1">
                      Seu palpite: {existingPred.gols_casa} × {existingPred.gols_fora}
                    </div>
                  </div>
                )}

                {/* Save Button */}
                {!isLocked && (
                  <div className="mt-3 flex items-center justify-between">
                    {errorMsg && (
                      <span className="text-red-500 text-xs">{errorMsg}</span>
                    )}
                    {isSaved && (
                      <span className="text-green-600 text-xs">✓ Palpite salvo!</span>
                    )}
                    {!errorMsg && !isSaved && <span />}
                    <button
                      onClick={() => handleSave(game.id)}
                      disabled={isSaving}
                      className="ml-auto bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Salvando...' : existingPred ? 'Atualizar' : 'Salvar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
