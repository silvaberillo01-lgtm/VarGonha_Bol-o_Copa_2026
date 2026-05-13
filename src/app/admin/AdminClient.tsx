'use client'

import { useState } from 'react'
import { Profile, Game } from '@/types'

interface Props {
  users: Profile[]
  games: Game[]
}

type Tab = 'users' | 'results' | 'knockout'

const KNOCKOUT_FASES = [
  { key: 'fase32', label: 'Fase de 32' },
  { key: 'oitavas', label: 'Oitavas de Final' },
  { key: 'quartas', label: 'Quartas de Final' },
  { key: 'semis', label: 'Semifinal' },
  { key: 'terceiro', label: '3º e 4º Lugar' },
  { key: 'final', label: 'Final' },
]

export default function AdminClient({ users, games }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [localUsers, setLocalUsers] = useState<Profile[]>(users)
  const [localGames, setLocalGames] = useState<Game[]>(games)
  const [results, setResults] = useState<Record<string, { casa: string; fora: string }>>({})
  const [savingUser, setSavingUser] = useState<Record<string, boolean>>({})
  const [savingGame, setSavingGame] = useState<Record<string, boolean>>({})
  const [savedGame, setSavedGame] = useState<Record<string, boolean>>({})
  const [userMsg, setUserMsg] = useState<Record<string, string>>({})
  const [gameMsg, setGameMsg] = useState<Record<string, string>>({})

  // Add game form
  const [newGame, setNewGame] = useState({
    time_casa: '', bandeira_casa: '', time_fora: '', bandeira_fora: '',
    data_hora: '', fase: 'fase32',
  })
  const [addingGame, setAddingGame] = useState(false)
  const [addGameMsg, setAddGameMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const now = new Date()

  const handleUserStatus = async (userId: string, status: 'approved' | 'rejected') => {
    setSavingUser((prev) => ({ ...prev, [userId]: true }))
    const response = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, status }),
    })
    setSavingUser((prev) => ({ ...prev, [userId]: false }))
    if (response.ok) {
      setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)))
      setUserMsg((prev) => ({ ...prev, [userId]: 'Atualizado!' }))
    } else {
      setUserMsg((prev) => ({ ...prev, [userId]: 'Erro ao atualizar.' }))
    }
  }

  const handleResultChange = (gameId: string, side: 'casa' | 'fora', value: string) => {
    setResults((prev) => ({ ...prev, [gameId]: { ...prev[gameId], [side]: value } }))
    setSavedGame((prev) => ({ ...prev, [gameId]: false }))
  }

  const handleSaveResult = async (gameId: string) => {
    const result = results[gameId]
    if (!result || result.casa === '' || result.fora === '') {
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
      setGameMsg((prev) => ({ ...prev, [gameId]: '✓ Resultado salvo e pontos calculados!' }))
      setLocalGames((prev) =>
        prev.map((g) => g.id === gameId ? { ...g, resultado_lancado: true, gols_casa_real: golsCasa, gols_fora_real: golsFora } : g)
      )
    } else {
      const data = await response.json()
      setGameMsg((prev) => ({ ...prev, [gameId]: data.error || 'Erro ao salvar.' }))
    }
  }

  const handleAddGame = async () => {
    if (!newGame.time_casa || !newGame.time_fora || !newGame.data_hora) {
      setAddGameMsg('Preencha times e data/hora.')
      return
    }
    setAddingGame(true)
    setAddGameMsg('')
    const response = await fetch('/api/admin/add-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGame),
    })
    setAddingGame(false)
    if (response.ok) {
      const { game } = await response.json()
      setLocalGames((prev) => [...prev, game])
      setNewGame({ time_casa: '', bandeira_casa: '', time_fora: '', bandeira_fora: '', data_hora: '', fase: 'fase32' })
      setAddGameMsg('✓ Jogo adicionado!')
      setShowAddForm(false)
    } else {
      const data = await response.json()
      setAddGameMsg(data.error || 'Erro ao adicionar.')
    }
  }

  const getInitialResult = (game: Game) => {
    if (results[game.id]) return results[game.id]
    if (game.resultado_lancado && game.gols_casa_real !== null && game.gols_fora_real !== null) {
      return { casa: game.gols_casa_real.toString(), fora: game.gols_fora_real.toString() }
    }
    return { casa: '', fora: '' }
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  const pendingUsers = localUsers.filter((u) => u.status === 'pending')
  const approvedUsers = localUsers.filter((u) => u.status === 'approved')
  const rejectedUsers = localUsers.filter((u) => u.status === 'rejected')

  // Sort games: pending (past + no result) → upcoming → completed
  const groupGames = localGames.filter((g) => g.fase === 'grupos')
  const knockoutGamesLocal = localGames.filter((g) => g.fase !== 'grupos')

  const sortGames = (gs: Game[]) => {
    const pending = gs.filter((g) => !g.resultado_lancado && new Date(g.data_hora) < now)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    const upcoming = gs.filter((g) => !g.resultado_lancado && new Date(g.data_hora) >= now)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    const completed = gs.filter((g) => g.resultado_lancado)
      .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime())
    return { pending, upcoming, completed }
  }

  const { pending: pendingGroup, upcoming: upcomingGroup, completed: completedGroup } = sortGames(groupGames)
  const pendingTotal = pendingGroup.length

  const renderResultRow = (game: Game) => {
    const result = getInitialResult(game)
    const isSaving = savingGame[game.id]
    const isSaved = savedGame[game.id]
    const msg = gameMsg[game.id]
    const isPending = !game.resultado_lancado && new Date(game.data_hora) < now

    return (
      <div key={game.id}
        className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
          game.resultado_lancado ? 'border-green-400'
            : isPending ? 'border-orange-400'
            : 'border-gray-200'
        }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">
              {game.fase === 'grupos' ? `Grupo ${game.grupo} • Rodada ${game.rodada} • ` : `${game.fase} • `}
              {formatDate(game.data_hora)}
              {isPending && <span className="ml-2 text-orange-500 font-bold">⚡ PENDENTE</span>}
              {game.resultado_lancado && <span className="ml-2 text-green-600 font-medium">✓ Lançado</span>}
            </div>
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <span>{game.bandeira_casa} {game.time_casa}</span>
              <span className="text-gray-400">vs</span>
              <span>{game.time_fora} {game.bandeira_fora}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="99"
              value={results[game.id]?.casa ?? result.casa}
              onChange={(e) => handleResultChange(game.id, 'casa', e.target.value)}
              className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="-"
            />
            <span className="font-bold text-gray-400">×</span>
            <input type="number" min="0" max="99"
              value={results[game.id]?.fora ?? result.fora}
              onChange={(e) => handleResultChange(game.id, 'fora', e.target.value)}
              className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="-"
            />
            <button onClick={() => handleSaveResult(game.id)} disabled={isSaving}
              className={`text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50 ${
                isPending ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-700 hover:bg-green-800'
              }`}>
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
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setActiveTab('users')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors relative ${
            activeTab === 'users' ? 'bg-green-700 text-yellow-400' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}>
          👥 Usuários ({localUsers.length})
          {pendingUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('results')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors relative ${
            activeTab === 'results' ? 'bg-green-700 text-yellow-400' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}>
          ⚽ Resultados Grupos
          {pendingTotal > 0 && (
            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {pendingTotal}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('knockout')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${
            activeTab === 'knockout' ? 'bg-green-700 text-yellow-400' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}>
          🏆 Fase Eliminatória ({knockoutGamesLocal.length})
        </button>
      </div>

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {pendingUsers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-orange-700 mb-3">⏳ Aguardando aprovação ({pendingUsers.length})</h2>
              <div className="space-y-2">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">{user.nome}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400">Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {userMsg[user.id] && <span className="text-xs text-gray-500">{userMsg[user.id]}</span>}
                      <button onClick={() => handleUserStatus(user.id, 'approved')} disabled={savingUser[user.id]}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                        ✓ Aprovar
                      </button>
                      <button onClick={() => handleUserStatus(user.id, 'rejected')} disabled={savingUser[user.id]}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                        ✗ Rejeitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold text-green-700 mb-3">✅ Aprovados ({approvedUsers.length})</h2>
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
                        {userMsg[user.id] && <span className="text-xs text-gray-500 mr-2">{userMsg[user.id]}</span>}
                        <button onClick={() => handleUserStatus(user.id, 'rejected')}
                          disabled={savingUser[user.id] || user.is_admin}
                          className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-30">
                          Rejeitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {rejectedUsers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-red-700 mb-3">❌ Rejeitados ({rejectedUsers.length})</h2>
              <div className="space-y-2">
                {rejectedUsers.map((user) => (
                  <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-400 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{user.nome}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {userMsg[user.id] && <span className="text-xs text-gray-500">{userMsg[user.id]}</span>}
                      <button onClick={() => handleUserStatus(user.id, 'approved')} disabled={savingUser[user.id]}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
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

      {/* RESULTS TAB */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          {pendingGroup.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-orange-600 mb-3">
                ⚡ Pendentes — aguardando resultado ({pendingGroup.length})
              </h2>
              <div className="space-y-3">{pendingGroup.map(renderResultRow)}</div>
            </div>
          )}
          {upcomingGroup.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-gray-700 mb-3">📅 Próximos jogos ({upcomingGroup.length})</h2>
              <div className="space-y-3">{upcomingGroup.map(renderResultRow)}</div>
            </div>
          )}
          {completedGroup.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-green-700 mb-3">✅ Resultados lançados ({completedGroup.length})</h2>
              <div className="space-y-3">{completedGroup.map(renderResultRow)}</div>
            </div>
          )}
        </div>
      )}

      {/* KNOCKOUT TAB */}
      {activeTab === 'knockout' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-sm">
              Adicione os jogos da fase eliminatória conforme os confrontos forem definidos.
              Os participantes poderão palpitar até o início de cada jogo.
            </p>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="bg-green-700 hover:bg-green-800 text-yellow-400 font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0 ml-4">
              + Adicionar Jogo
            </button>
          </div>

          {showAddForm && (
            <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-green-300">
              <h3 className="font-bold text-gray-800 mb-4">Novo Jogo Eliminatório</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Fase</label>
                  <select value={newGame.fase} onChange={(e) => setNewGame((p) => ({ ...p, fase: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {KNOCKOUT_FASES.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Data e Hora (horário de Brasília)</label>
                  <input type="datetime-local" value={newGame.data_hora}
                    onChange={(e) => setNewGame((p) => ({ ...p, data_hora: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Time Casa</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="🇧🇷" value={newGame.bandeira_casa}
                      onChange={(e) => setNewGame((p) => ({ ...p, bandeira_casa: e.target.value }))}
                      className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                    />
                    <input type="text" placeholder="Brasil" value={newGame.time_casa}
                      onChange={(e) => setNewGame((p) => ({ ...p, time_casa: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Time Fora</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="🇦🇷" value={newGame.bandeira_fora}
                      onChange={(e) => setNewGame((p) => ({ ...p, bandeira_fora: e.target.value }))}
                      className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                    />
                    <input type="text" placeholder="Argentina" value={newGame.time_fora}
                      onChange={(e) => setNewGame((p) => ({ ...p, time_fora: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleAddGame} disabled={addingGame}
                  className="bg-green-700 hover:bg-green-800 text-white font-bold px-6 py-2 rounded-lg text-sm disabled:opacity-50">
                  {addingGame ? 'Adicionando...' : 'Adicionar Jogo'}
                </button>
                <button onClick={() => setShowAddForm(false)}
                  className="text-gray-500 hover:text-gray-700 text-sm">
                  Cancelar
                </button>
                {addGameMsg && <span className={`text-sm ${addGameMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{addGameMsg}</span>}
              </div>
            </div>
          )}

          {knockoutGamesLocal.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
              Nenhum jogo eliminatório adicionado ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {sortGames(knockoutGamesLocal).pending.map(renderResultRow)}
              {sortGames(knockoutGamesLocal).upcoming.map(renderResultRow)}
              {sortGames(knockoutGamesLocal).completed.map(renderResultRow)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
