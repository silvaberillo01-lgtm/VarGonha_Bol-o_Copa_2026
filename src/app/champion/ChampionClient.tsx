'use client'

import { useState } from 'react'
import { DEADLINE_CAMPEAO, BONUS_CAMPEAO } from '@/lib/scoring'

// 48 seleções classificadas para a Copa do Mundo 2026
const SELECOES = [
  'África do Sul', 'Alemanha', 'Arábia Saudita', 'Argentina', 'Argélia',
  'Austrália', 'Áustria', 'Bélgica', 'Bósnia e Herzegovina', 'Brasil',
  'Cabo Verde', 'Canadá', 'Catar', 'Colômbia', 'Coreia do Sul',
  'Costa do Marfim', 'Croácia', 'Curaçao', 'Egito', 'Equador',
  'Escócia', 'Espanha', 'Estados Unidos', 'França', 'Gana',
  'Haiti', 'Holanda', 'Inglaterra', 'Irã', 'Iraque',
  'Japão', 'Jordânia', 'Marrocos', 'México', 'Noruega',
  'Nova Zelândia', 'Panamá', 'Paraguai', 'Portugal', 'RD do Congo',
  'República Tcheca', 'Senegal', 'Suécia', 'Suíça', 'Tunísia',
  'Turquia', 'Uruguai', 'Uzbequistão',
].sort()

interface ChampionPrediction {
  selecao: string
  pontos: number
  profiles?: { nome: string } | { nome: string }[] | null
}

interface Props {
  myPrediction: { id: string; selecao: string; pontos: number } | null
  allPredictions: ChampionPrediction[]
  userId: string
}

export default function ChampionClient({ myPrediction, allPredictions, userId }: Props) {
  const [selected, setSelected] = useState(myPrediction?.selecao || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const isPastDeadline = new Date() > DEADLINE_CAMPEAO

  const handleSave = async () => {
    if (!selected) {
      setError('Selecione uma seleção.')
      return
    }

    setSaving(true)
    setError('')

    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'champion', selecao: selected }),
    })

    setSaving(false)

    if (response.ok) {
      setSaved(true)
    } else {
      const data = await response.json()
      setError(data.error || 'Erro ao salvar.')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-2">🏆 Campeão da Copa 2026</h1>
      <p className="text-gray-600 mb-6">
        Acerte o campeão e ganhe <strong className="text-green-700">{BONUS_CAMPEAO} pontos bônus!</strong>
      </p>

      {/* Deadline Notice */}
      {isPastDeadline ? (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <p className="font-semibold">🔒 Prazo encerrado!</p>
          <p className="text-sm mt-1">
            O prazo para palpite do campeão era {DEADLINE_CAMPEAO.toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}.
          </p>
        </div>
      ) : (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4">
          <p className="font-semibold">⏰ Prazo: {DEADLINE_CAMPEAO.toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}</p>
          <p className="text-sm mt-1">Após o prazo, não será possível alterar seu palpite.</p>
        </div>
      )}

      {/* My Prediction */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Meu palpite de campeão</h2>

        {myPrediction && !isPastDeadline && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✓ Palpite atual: <strong>{myPrediction.selecao}</strong>
            {myPrediction.pontos > 0 && (
              <span className="ml-2 font-bold">({myPrediction.pontos} pts)</span>
            )}
          </div>
        )}

        {myPrediction && isPastDeadline && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 font-semibold">Seu palpite: {myPrediction.selecao}</p>
            {myPrediction.pontos > 0 && (
              <p className="text-green-600 mt-1">🎉 Você ganhou {myPrediction.pontos} pontos!</p>
            )}
          </div>
        )}

        {!isPastDeadline && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione a seleção campeã:
              </label>
              <select
                value={selected}
                onChange={(e) => { setSelected(e.target.value); setSaved(false) }}
                className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 font-medium"
              >
                <option value="">-- Escolha uma seleção --</option>
                {SELECOES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            {saved && (
              <p className="text-green-600 text-sm">✓ Palpite salvo com sucesso!</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !selected}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-green-900 font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : myPrediction ? 'Atualizar palpite' : 'Salvar palpite'}
            </button>
          </div>
        )}
      </div>

      {/* All predictions (after deadline) */}
      {isPastDeadline && allPredictions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Palpites de todos</h2>
          <div className="space-y-2">
            {allPredictions.map((pred, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-gray-700 font-medium">
                  {Array.isArray(pred.profiles)
                    ? pred.profiles[0]?.nome || 'Participante'
                    : pred.profiles?.nome || 'Participante'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">{pred.selecao}</span>
                  {pred.pontos > 0 && (
                    <span className="text-green-600 font-bold">+{pred.pontos} pts</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
