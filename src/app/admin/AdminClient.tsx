'use client'

import { useState } from 'react'
import { Profile, Game } from '@/types'

interface Props {
  users: Profile[]
  games: Game[]
}

type Tab = 'users' | 'results'

export default function AdminClient({ users, games }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [localUsers, setLocalUsers] = useState<Profile[]>(users)
  const [localGames] = useState<Game[]>(games)
  const [results, setResults] = useState<Record<string, { casa: string; fora: string }>>({})
  const [savingUser, setSavingUser] = useState<Record<string, boolean>>({})
  const [savingGame, setSavingGame] = useState<Record<string, boolean>>({})
  const [savedGame, setSavedGame] = useState<Record<string, boolean>>({})
  const [userMsg, setUserMsg] = useState<Record<string, string>>({})
  const [gameMsg, setGameMsg] = useState<Record<string, string>>({})

  const handleUserStatus = async (userId: string, status: 'approved' | 'rejected') => {
    setSavingUser((prev) => ({ ...prev, [userId]: true }))
    setUserMsg((prev) => ({ ...prev, [userId]: '' }))

    const response = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, status }),
    })

    setSavingUser((prev) => ({ ...prev, [userId]: false }))

    if (response.ok) {
      setLocalUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status } : u))
      )
      setUserMsg((prev) => ({ ...prev, [userId]: 'Atualizado!' }))
    } else {
      setUserMsg((prev) => ({ ...prev, [userId]: 'Erro ao atualizar.' }))
    }
  }

  const handleResultChange = (gameId: string, side: 'casa' | 'fora', value: string) => {
    setResults((prev) => ({
      ...prev,
      [gameId]: { ...prev[gameId], [side]: value },
    }))
    setSavedGame((prev) => ({ ...prev, [gameId]: false }))
  }

  const handleSaveResult = async (gameId: string) => {
    const result = results[gameId]
    if (!result || result.casa === undefined || result.fora === undefined || result.casa === '' || result.fora === '') {
      setGameMsg((prev) => ({ ...prev, [gameId]: 'Preencha ambos os campos.' }))
      return
    }

    const golsCasa = parseInt(result.casa)
    const golsFora = parseInt(result.fora)

    if (isNaN(golsCasa) || isNaN(golsFora) || golsCasa < 0 || golsFora < 0) {
      setGameMsg((prev) => ({ ...prev, [gameId]: 'Valores inválidos.' }))
      return
    }

    setSavingGame((prev) => ({ ...prev, [gameId]: true }))
    setGameMsg((prev) => ({ ...prev, [gameId]: '' }))

    const response = await fetch('/api/admin/update-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, gols_casa_real: golsCasa, gols_fora_real: golsFora }),
    })

    setSavingGame((prev) => ({ ...prev, [gameId]: false }))

    if (response.ok) {
      setSavedGame((prev) => ({ ...prev, [gameId]: true }))
      setGameMsg((prev) => ({ ...prev, [gameId]: 'Resultado salvo e pontos calculados!' }))
    } else {
      const data = await response.json()
      setGameMsg((prev) => ({ ...prev, [gameId]: data.error || 'Erro ao salvar.' }))
    }
  }

  const getInitialResult = (game: Game) => {
    if (results[game.id]) return results[game.id]
    if (game.resultado_lancado && game.gols_casa_real !== null && game.gols_fora_real !== null) {
      return { casa: game.gols_casa_real.toString(), fora: game.gols_fora_real.toString() }
    }
    return { casa: '', fora: '' }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  const pendingUsers = localUsers.filter((u) => u.status === 'pending')
  const approvedUsers = localUsers.filter((u) => u.status === 'approved')
  const rejectedUsers = localUsers.filter((u) => u.status === 'rejected')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${
            activeTab === 'users'
              ? 'bg-green-700 text-yellow-400'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          👥 Usuários ({localUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${
            activeTab === 'results'
              ? 'bg-green-700 text-yellow-400'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          ⚽ Resultados ({localGames.length})
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Pending */}
          {pendingUsers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-orange-700 mb-3">
                ⏳ Aguardando aprovação ({pendingUsers.length})
              </h2>
              <div className="space-y-2">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">{user.nome}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">
                        Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {userMsg[user.id] && (
                        <span className="text-xs text-gray-500">{userMsg[user.id]}</span>
                      )}
                      <button
                        onClick={() => handleUserStatus(user.id, 'approved')}
                        disabled={savingUser[user.id]}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        ✓ Aprovar
                      </button>
                      <button
                        onClick={() => handleUserStatus(user.id, 'rejected')}
                        disabled={savingUser[user.id]}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        ✗ Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved */}
          <div>
            <h2 className="text-lg font-bold text-green-700 mb-3">
              ✅ Aprovados ({approvedUsers.length})
            </h2>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="px-4 py-3 text-left">Nome</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-center">Admin</th>
                    <th className="px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedUsers.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {user.nome}
                        {user.is_admin && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">admin</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{user.email}</td>
                      <td className="px-4 py-3 text-center">{user.is_admin ? '⭐' : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {userMsg[user.id] && (
                          <span className="text-xs text-gray-500 mr-2">{userMsg[user.id]}</span>
                        )}
                        <button
                          onClick={() => handleUserStatus(user.id, 'rejected')}
                          disabled={savingUser[user.id] || user.is_admin}
                          className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-30"
                        >
                          Rejeitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rejected */}
          {rejectedUsers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-red-700 mb-3">
                ❌ Rejeitados ({rejectedUsers.length})
              </h2>
              <div className="space-y-2">
                {rejectedUsers.map((user) => (
                  <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-400 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{user.nome}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {userMsg[user.id] && (
                        <span className="text-xs text-gray-500">{userMsg[user.id]}</span>
                      )}
                      <button
                        onClick={() => handleUserStatus(user.id, 'approved')}
                        disabled={savingUser[user.id]}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        Reativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div>
          <p className="text-gray-600 text-sm mb-4">
            Lance os resultados dos jogos. Os pontos serão calculados automaticamente para todos os participantes.
          </p>
          <div className="space-y-3">
            {localGames.map((game) => {
              const result = getInitialResult(game)
              const isSaving = savingGame[game.id]
              const isSaved = savedGame[game.id]
              const msg = gameMsg[game.id]

              return (
                <div
                  key={game.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    game.resultado_lancado ? 'border-green-400' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Grupo {game.grupo} • Rodada {game.rodada} • {formatDate(game.data_hora)}
                        {game.resultado_lancado && <span className="ml-2 text-green-600 font-medium">✓ Lançado</span>}
                      </div>
                      <div className="flex items-center gap-2 font-semibold text-gray-800">
                        <span>{game.bandeira_casa} {game.time_casa}</span>
                        <span className="text-gray-400">vs</span>
                        <span>{game.time_fora} {game.bandeira_fora}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={results[game.id]?.casa ?? result.casa}
                        onChange={(e) => handleResultChange(game.id, 'casa', e.target.value)}
                        className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="-"
                      />
                      <span className="font-bold text-gray-400">×</span>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={results[game.id]?.fora ?? result.fora}
                        onChange={(e) => handleResultChange(game.id, 'fora', e.target.value)}
                        className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="-"
                      />
                      <button
                        onClick={() => handleSaveResult(game.id)}
                        disabled={isSaving}
                        className="bg-green-700 hover:bg-green-800 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
                      >
                        {isSaving ? '...' : game.resultado_lancado ? 'Atualizar' : 'Lançar'}
                      </button>
                    </div>
                  </div>

                  {msg && (
                    <p className={`text-xs mt-2 ${isSaved || game.resultado_lancado ? 'text-green-600' : 'text-red-500'}`}>
                      {msg}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
