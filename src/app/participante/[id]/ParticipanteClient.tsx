'use client'

import { useState } from 'react'
import { Game, Prediction, SpecialPrediction } from '@/types'
import { DEADLINE_FASE1, DEADLINE_CAMPEAO, getTipoAcerto } from '@/lib/scoring'

interface ChampionPred {
  selecao: string
  pontos: number
}

interface Props {
  nome: string
  games: Game[]
  predictions: Prediction[]
  championPrediction: ChampionPred | null
  artilheiro: SpecialPrediction | null
  melhorJogador: SpecialPrediction | null
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

export default function ParticipanteClient({
  nome,
  games,
  predictions,
  championPrediction,
  artilheiro,
  melhorJogador,
}: Props) {
  const [mainTab, setMainTab] = useState<'grupos' | 'eliminatoria'>('grupos')
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [selectedKoFase, setSelectedKoFase] = useState('fase32')

  const isPastGroupDeadline = new Date() > DEADLINE_FASE1
  const isPastCampeaoDeadline = new Date() > DEADLINE_CAMPEAO

  const groupGames = games.filter((g) => g.fase === 'grupos')
  const knockoutGames = games.filter((g) => g.fase !== 'grupos')
  const hasKnockout = knockoutGames.length > 0

  // Mesmo critério de bloqueio do dashboard: só revela o palpite de quem
  // já não pode mais alterá-lo (prazo encerrado ou jogo iniciado/lançado).
  const isGameLocked = (game: Game) => {
    if (game.fase === 'grupos') return isPastGroupDeadline || game.resultado_lancado
    return new Date() > new Date(game.data_hora) || game.resultado_lancado
  }

  const getPrediction = (gameId: string) => predictions.find((p) => p.game_id === gameId)

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })

  const renderGameCard = (game: Game) => {
    const pred = getPrediction(game.id)
    const locked = isGameLocked(game)

    return (
      <div
        key={game.id}
        className={`bg-white rounded-xl shadow-sm border-2 p-5 ${
          game.resultado_lancado ? 'border-gray-200' : locked ? 'border-green-200' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 font-medium">
            {game.fase === 'grupos' ? `Grupo ${game.grupo} • Rodada ${game.rodada} • ` : ''}
            {formatDate(game.data_hora)}
          </span>
          {game.resultado_lancado && (
            <span className="text-xs text-gray-400">✔️ Resultado lançado</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <div className="text-lg">{game.bandeira_casa}</div>
            <div className="font-bold text-gray-800 text-sm">{game.time_casa}</div>
          </div>

          <div className="flex flex-col items-center gap-1">
            {/* Palpite deste participante (só após bloqueio) */}
            {!locked ? (
              <span className="text-xs text-gray-400">🔒 Palpite oculto até o bloqueio</span>
            ) : pred ? (
              <div className="flex items-center gap-2 text-lg font-bold">
                <span className="w-10 h-10 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg text-green-800">
                  {pred.gols_casa}
                </span>
                <span className="text-gray-400">×</span>
                <span className="w-10 h-10 flex items-center justify-center bg-green-50 border border-green-200 rounded-lg text-green-800">
                  {pred.gols_fora}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">— Sem palpite —</span>
            )}

            {/* Resultado real, quando lançado */}
            {game.resultado_lancado && (
              <span className="text-xs text-gray-500">
                Resultado: <strong>{game.gols_casa_real} × {game.gols_fora_real}</strong>
              </span>
            )}
          </div>

          <div className="flex-1 text-left">
            <div className="text-lg">{game.bandeira_fora}</div>
            <div className="font-bold text-gray-800 text-sm">{game.time_fora}</div>
          </div>
        </div>

        {game.resultado_lancado && pred && (
          <div className="mt-3 text-center">
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
              pred.pontos === 15 ? 'bg-yellow-100 text-yellow-700'
                : pred.pontos === 10 ? 'bg-green-100 text-green-700'
                : pred.pontos === 5 ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {getTipoAcerto(pred.pontos)} • {pred.pontos} pts
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Palpites especiais */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">🏆 Palpites Especiais</h2>
        {isPastCampeaoDeadline ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="text-xs text-purple-600 font-semibold">🏆 Campeão</div>
              <div className="text-gray-800 font-medium">{championPrediction?.selecao || '—'}</div>
              {championPrediction && championPrediction.pontos > 0 && (
                <div className="text-green-600 text-xs font-bold mt-0.5">+{championPrediction.pontos} pts</div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
              <div className="text-xs text-orange-600 font-semibold">⚽ Artilheiro</div>
              <div className="text-gray-800 font-medium">{artilheiro?.palpite || '—'}</div>
              {artilheiro && artilheiro.pontos > 0 && (
                <div className="text-green-600 text-xs font-bold mt-0.5">+{artilheiro.pontos} pts</div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-pink-50 border border-pink-200">
              <div className="text-xs text-pink-600 font-semibold">🌟 Melhor Jogador</div>
              <div className="text-gray-800 font-medium">{melhorJogador?.palpite || '—'}</div>
              {melhorJogador && melhorJogador.pontos > 0 && (
                <div className="text-green-600 text-xs font-bold mt-0.5">+{melhorJogador.pontos} pts</div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">🔒 Palpites especiais ocultos até o bloqueio.</p>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMainTab('grupos')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
            mainTab === 'grupos' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'
          }`}>
          ⚽ Fase de Grupos
        </button>
        <button onClick={() => setMainTab('eliminatoria')}
          className={`px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
            mainTab === 'eliminatoria' ? 'bg-green-700 text-yellow-400 shadow-md' : 'bg-white text-gray-600 hover:bg-green-50'
          }`}>
          🏆 Fase Eliminatória
          {!hasKnockout && <span className="ml-1 text-xs opacity-60">(em breve)</span>}
        </button>
      </div>

      {/* GRUPOS */}
      {mainTab === 'grupos' && (
        <div>
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
              <p className="text-gray-500">Os jogos da fase eliminatória ainda não foram disponibilizados.</p>
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
