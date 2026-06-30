'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Game } from '@/types'
import { SELECOES, normalizeTeam } from '@/lib/teams'

const KNOCKOUT_FASES = [
  { key: 'fase32', label: '1/16 avos de Final' },
  { key: 'oitavas', label: 'Oitavas de Final' },
  { key: 'quartas', label: 'Quartas de Final' },
  { key: 'semis', label: 'Semifinal' },
  { key: 'terceiro', label: '3º e 4º Lugar' },
  { key: 'final', label: 'Final' },
]

const numFromCode = (code?: string | null) => (code ? parseInt(code.replace(/^M/, '')) : NaN)

interface SpecialEntry {
  id: string
  user_id: string
  tipo: 'artilheiro' | 'melhor_jogador'
  palpite: string
  pontos: number
  acertou: boolean | null
  nome: string
}

interface Props {
  users: Profile[]
  games: Game[]
  copaConfig: Record<string, string>
  specialPredictions: SpecialEntry[]
}

type Tab = 'users' | 'results' | 'knockout' | 'especiais'

export default function AdminClient({ users, games, copaConfig, specialPredictions }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [localUsers, setLocalUsers] = useState<Profile[]>(users)
  const [localGames, setLocalGames] = useState<Game[]>(games)
  const [results, setResults] = useState<Record<string, { casa: string; fora: string }>>({})
  const [savingUser, setSavingUser] = useState<Record<string, boolean>>({})
  const [savingGame, setSavingGame] = useState<Record<string, boolean>>({})
  const [savedGame, setSavedGame] = useState<Record<string, boolean>>({})
  const [userMsg, setUserMsg] = useState<Record<string, string>>({})
  const [gameMsg, setGameMsg] = useState<Record<string, string>>({})
  const [deletingUser, setDeletingUser] = useState<Record<string, boolean>>({})

  // Edição dos jogos de mata-mata (times reais, placar, classificado, data)
  const [koEdits, setKoEdits] = useState<Record<string, {
    time_casa: string; time_fora: string; casa: string; fora: string; classificado: string; data_hora: string
    penCasa: string; penFora: string
  }>>({})
  const [savingKo, setSavingKo] = useState<Record<string, boolean>>({})
  const [koMsg, setKoMsg] = useState<Record<string, string>>({})

  // Add game form
  const [newGame, setNewGame] = useState({
    time_casa: '', bandeira_casa: '', time_fora: '', bandeira_fora: '',
    data_hora: '', fase: 'fase32',
  })
  const [addingGame, setAddingGame] = useState(false)
  const [addGameMsg, setAddGameMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // Especiais state
  const [campeaoSelect, setCampeaoSelect] = useState(copaConfig['campeao'] || '')
  const [savingCampeao, setSavingCampeao] = useState(false)
  const [campeaoMsg, setCampeaoMsg] = useState('')

  const [artilheiroResult, setArtilheiroResult] = useState(copaConfig['artilheiro'] || '')
  const [artilheiroPontos, setArtilheiroPontos] = useState(copaConfig['artilheiro_pontos'] || '50')
  const [savingArtilheiro, setSavingArtilheiro] = useState(false)
  const [artilheiroMsg, setArtilheiroMsg] = useState('')

  const [melhorJogadorResult, setMelhorJogadorResult] = useState(copaConfig['melhor_jogador'] || '')
  const [melhorJogadorPontos, setMelhorJogadorPontos] = useState(copaConfig['melhor_jogador_pontos'] || '50')
  const [savingMelhorJogador, setSavingMelhorJogador] = useState(false)
  const [melhorJogadorMsg, setMelhorJogadorMsg] = useState('')

  const [jogadoresLista, setJogadoresLista] = useState<string[]>(
    copaConfig['jogadores_lista'] ? JSON.parse(copaConfig['jogadores_lista']) : []
  )
  const [jogadoresText, setJogadoresText] = useState(
    copaConfig['jogadores_lista'] ? JSON.parse(copaConfig['jogadores_lista']).join('\n') : ''
  )
  const [savingLista, setSavingLista] = useState(false)
  const [listaMsg, setListaMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Marcação manual dos especiais
  const [localSpecials, setLocalSpecials] = useState<SpecialEntry[]>(specialPredictions)
  const [markingSpecial, setMarkingSpecial] = useState<Record<string, boolean>>({})

  // Kill-switch da atualização automática de placares via API.
  const [autoSync, setAutoSync] = useState(copaConfig['auto_sync_enabled'] !== 'false')
  const [togglingSync, setTogglingSync] = useState(false)
  const lastSync = games
    .map((g) => g.last_synced_at)
    .filter(Boolean)
    .sort()
    .pop()

  const now = new Date()

  const handleToggleSync = async () => {
    const next = !autoSync
    setTogglingSync(true)
    const res = await fetch('/api/admin/toggle-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    setTogglingSync(false)
    if (res.ok) {
      setAutoSync(next)
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Erro ao alternar atualização automática.')
    }
  }

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
      setUserMsg((prev) => ({ ...prev, [userId]: status === 'approved' ? '✓ Aprovado!' : '✓ Rejeitado!' }))
      router.refresh()
    } else {
      setUserMsg((prev) => ({ ...prev, [userId]: 'Erro ao atualizar.' }))
    }
  }

  const handleDeleteUser = async (userId: string, nome: string) => {
    if (!confirm(`Excluir o usuário "${nome}" permanentemente? Esta ação não pode ser desfeita.`)) return
    setDeletingUser((prev) => ({ ...prev, [userId]: true }))
    const response = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setDeletingUser((prev) => ({ ...prev, [userId]: false }))
    if (response.ok) {
      setLocalUsers((prev) => prev.filter((u) => u.id !== userId))
    } else {
      const data = await response.json()
      alert(data.error || 'Erro ao excluir usuário.')
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

  const handleSaveCampeao = async () => {
    if (!campeaoSelect) { setCampeaoMsg('Selecione o campeão.'); return }
    setSavingCampeao(true)
    setCampeaoMsg('')
    const response = await fetch('/api/admin/set-champion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campeao: campeaoSelect }),
    })
    setSavingCampeao(false)
    if (response.ok) {
      setCampeaoMsg('✓ Campeão salvo e pontos calculados!')
    } else {
      const data = await response.json()
      setCampeaoMsg(data.error || 'Erro ao salvar.')
    }
  }

  const handleSaveSpecial = async (tipo: 'artilheiro' | 'melhor_jogador') => {
    const resultado = tipo === 'artilheiro' ? artilheiroResult : melhorJogadorResult
    const pontos = tipo === 'artilheiro' ? artilheiroPontos : melhorJogadorPontos
    const setSaving = tipo === 'artilheiro' ? setSavingArtilheiro : setSavingMelhorJogador
    const setMsg = tipo === 'artilheiro' ? setArtilheiroMsg : setMelhorJogadorMsg

    setSaving(true)
    setMsg('')
    const response = await fetch('/api/admin/set-special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, resultado: resultado.trim(), pontos: parseInt(pontos) || 50 }),
    })
    setSaving(false)
    if (response.ok) {
      setMsg('✓ Pontuação salva! Marque os acertos manualmente abaixo.')
    } else {
      const data = await response.json()
      setMsg(data.error || 'Erro ao salvar.')
    }
  }

  const handleSaveLista = async () => {
    const lista = jogadoresText.split('\n').map((l: string) => l.trim()).filter(Boolean)
    setSavingLista(true)
    setListaMsg('')
    const response = await fetch('/api/admin/set-special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jogadores_lista: lista }),
    })
    setSavingLista(false)
    if (response.ok) {
      setJogadoresLista(lista)
      setListaMsg(`✓ Lista salva com ${lista.length} jogadores!`)
    } else {
      setListaMsg('Erro ao salvar lista.')
    }
  }

  const handleMarkSpecial = async (id: string, acertou: boolean) => {
    setMarkingSpecial((prev) => ({ ...prev, [id]: true }))
    const response = await fetch('/api/admin/mark-special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prediction_id: id, acertou }),
    })
    setMarkingSpecial((prev) => ({ ...prev, [id]: false }))
    if (response.ok) {
      const { pontos } = await response.json()
      setLocalSpecials((prev) =>
        prev.map((s) => (s.id === id ? { ...s, acertou, pontos } : s))
      )
    } else {
      const data = await response.json()
      alert(data.error || 'Erro ao marcar palpite.')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      // Parse CSV — column A (first column)
      const lines = text.split(/\r?\n/).map((line) => line.split(',')[0].replace(/^"|"$/g, '').trim()).filter(Boolean)
      setJogadoresText(lines.join('\n'))
    }
    reader.readAsText(file)
  }

  const koEdit = (game: Game) => {
    if (koEdits[game.id]) return koEdits[game.id]
    const toLocal = (iso: string) => {
      const d = new Date(iso)
      const off = d.getTimezoneOffset() * 60000
      return new Date(d.getTime() - off).toISOString().slice(0, 16)
    }
    return {
      time_casa: normalizeTeam(game.time_casa) || '',
      time_fora: normalizeTeam(game.time_fora) || '',
      casa: game.gols_casa_real != null ? String(game.gols_casa_real) : '',
      fora: game.gols_fora_real != null ? String(game.gols_fora_real) : '',
      classificado: normalizeTeam(game.classificado_real) || '',
      data_hora: toLocal(game.data_hora),
      penCasa: game.gols_penaltis_casa != null ? String(game.gols_penaltis_casa) : '',
      penFora: game.gols_penaltis_fora != null ? String(game.gols_penaltis_fora) : '',
    }
  }

  const setKo = (gameId: string, patch: Partial<ReturnType<typeof koEdit>>, game: Game) => {
    setKoEdits((prev) => ({ ...prev, [gameId]: { ...koEdit(game), ...prev[gameId], ...patch } }))
    setKoMsg((prev) => ({ ...prev, [gameId]: '' }))
  }

  const handleSaveKoData = async (game: Game) => {
    const e = koEdit(game)
    setSavingKo((prev) => ({ ...prev, [game.id]: true }))
    const res = await fetch('/api/admin/update-game', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: game.id, time_casa: e.time_casa, time_fora: e.time_fora,
        data_hora: e.data_hora ? new Date(e.data_hora).toISOString() : undefined,
      }),
    })
    setSavingKo((prev) => ({ ...prev, [game.id]: false }))
    if (res.ok) {
      const { game: g } = await res.json()
      setLocalGames((prev) => prev.map((x) => (x.id === game.id ? { ...x, ...g } : x)))
      setKoMsg((prev) => ({ ...prev, [game.id]: '✓ Dados salvos!' }))
    } else {
      const d = await res.json()
      setKoMsg((prev) => ({ ...prev, [game.id]: d.error || 'Erro ao salvar.' }))
    }
  }

  const handleLaunchKo = async (game: Game) => {
    const e = koEdit(game)
    if (e.casa === '' || e.fora === '') { setKoMsg((p) => ({ ...p, [game.id]: 'Preencha o placar.' })); return }
    if (!e.time_casa || !e.time_fora) { setKoMsg((p) => ({ ...p, [game.id]: 'Informe os dois times reais.' })); return }
    const casa = parseInt(e.casa), fora = parseInt(e.fora)
    let classificado = e.classificado
    if (casa !== fora) classificado = casa > fora ? e.time_casa : e.time_fora
    if (!classificado) { setKoMsg((p) => ({ ...p, [game.id]: 'Empate: escolha quem se classificou (pênaltis).' })); return }
    setSavingKo((prev) => ({ ...prev, [game.id]: true }))
    const penCasa = e.penCasa !== '' ? parseInt(e.penCasa) : undefined
    const penFora = e.penFora !== '' ? parseInt(e.penFora) : undefined
    const res = await fetch('/api/admin/update-result', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: game.id, gols_casa_real: casa, gols_fora_real: fora,
        time_casa_real: e.time_casa, time_fora_real: e.time_fora, classificado_real: classificado,
        gols_penaltis_casa: !isNaN(penCasa as number) ? penCasa : null,
        gols_penaltis_fora: !isNaN(penFora as number) ? penFora : null,
      }),
    })
    setSavingKo((prev) => ({ ...prev, [game.id]: false }))
    if (res.ok) {
      const d = await res.json()
      setLocalGames((prev) => prev.map((x) => (x.id === game.id
        ? { ...x, resultado_lancado: true, gols_casa_real: casa, gols_fora_real: fora, time_casa: e.time_casa, time_fora: e.time_fora, classificado_real: classificado }
        : x)))
      setKoMsg((prev) => ({ ...prev, [game.id]: d.message || '✓ Resultado lançado!' }))
    } else {
      const d = await res.json()
      setKoMsg((prev) => ({ ...prev, [game.id]: d.error || 'Erro ao lançar.' }))
    }
  }

  const renderKnockoutAdminRow = (game: Game) => {
    const e = koEdit(game)
    const casa = parseInt(e.casa), fora = parseInt(e.fora)
    const isDraw = !isNaN(casa) && !isNaN(fora) && casa === fora
    const faseLabel = KNOCKOUT_FASES.find((f) => f.key === game.fase)?.label
    return (
      <div key={game.id} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${game.resultado_lancado ? 'border-green-400' : 'border-gray-200'}`}>
        <div className="text-xs text-gray-400 mb-2">
          {faseLabel} • Jogo {numFromCode(game.match_code)} • slots {game.slot_casa} × {game.slot_fora}
          {game.resultado_lancado && <span className="ml-2 text-green-600 font-medium">✓ Lançado</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select value={e.time_casa}
            onChange={(ev) => setKo(game.id, { time_casa: ev.target.value }, game)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">-- time casa (real) --</option>
            {SELECOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={e.time_fora}
            onChange={(ev) => setKo(game.id, { time_fora: ev.target.value }, game)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">-- time fora (real) --</option>
            {SELECOES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <input type="datetime-local" value={e.data_hora}
            onChange={(ev) => setKo(game.id, { data_hora: ev.target.value }, game)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-xs" />
          <input type="number" min="0" max="99" placeholder="-" value={e.casa}
            onChange={(ev) => setKo(game.id, { casa: ev.target.value }, game)}
            className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg" />
          <span className="font-bold text-gray-400">×</span>
          <input type="number" min="0" max="99" placeholder="-" value={e.fora}
            onChange={(ev) => setKo(game.id, { fora: ev.target.value }, game)}
            className="w-14 h-10 text-center text-lg font-bold border-2 border-green-300 rounded-lg" />
        </div>
        {isDraw && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pênaltis — passa:</span>
              {[e.time_casa, e.time_fora].filter(Boolean).map((t) => (
                <button key={t} type="button" onClick={() => setKo(game.id, { classificado: t }, game)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 ${e.classificado === t ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Placar pênaltis:</span>
              <input type="number" min="0" max="30" placeholder="-" value={e.penCasa}
                onChange={(ev) => setKo(game.id, { penCasa: ev.target.value }, game)}
                className="w-12 h-8 text-center text-sm font-bold border border-gray-300 rounded-lg" />
              <span className="text-xs text-gray-400">×</span>
              <input type="number" min="0" max="30" placeholder="-" value={e.penFora}
                onChange={(ev) => setKo(game.id, { penFora: ev.target.value }, game)}
                className="w-12 h-8 text-center text-sm font-bold border border-gray-300 rounded-lg" />
              <span className="text-xs text-gray-400">(opcional)</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => handleSaveKoData(game)} disabled={savingKo[game.id]}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            Salvar dados
          </button>
          <button onClick={() => handleLaunchKo(game)} disabled={savingKo[game.id]}
            className="bg-green-700 hover:bg-green-800 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            {game.resultado_lancado ? 'Atualizar resultado' : 'Lançar resultado'}
          </button>
          {koMsg[game.id] && <span className={`text-xs ${koMsg[game.id].startsWith('✓') || koMsg[game.id].startsWith('Resultado') ? 'text-green-600' : 'text-red-500'}`}>{koMsg[game.id]}</span>}
        </div>
      </div>
    )
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

  const renderSpecialMarking = (tipo: 'artilheiro' | 'melhor_jogador') => {
    const entries = localSpecials
      .filter((s) => s.tipo === tipo)
      .sort((a, b) => a.nome.localeCompare(b.nome))

    if (entries.length === 0) {
      return <p className="text-sm text-gray-400 mt-4">Nenhum palpite enviado ainda.</p>
    }

    const avaliados = entries.filter((e) => e.acertou !== null).length

    return (
      <div className="mt-4 border-t pt-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Conferência manual — {avaliados}/{entries.length} avaliados
        </p>
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 flex-wrap bg-gray-50 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-800">{e.nome}</span>
                <span className="text-sm text-gray-500"> — palpitou: </span>
                <span className="text-sm font-semibold text-gray-700">{e.palpite}</span>
              </div>
              <div className="flex items-center gap-2">
                {e.acertou === true && (
                  <span className="text-xs font-bold text-green-700">✓ acerto (+{e.pontos})</span>
                )}
                {e.acertou === false && (
                  <span className="text-xs font-bold text-red-600">✗ errou</span>
                )}
                {e.acertou === null && (
                  <span className="text-xs text-gray-400">não avaliado</span>
                )}
                <button
                  onClick={() => handleMarkSpecial(e.id, true)}
                  disabled={markingSpecial[e.id]}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                    e.acertou === true ? 'bg-green-600 text-white' : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                  }`}>
                  Acerto
                </button>
                <button
                  onClick={() => handleMarkSpecial(e.id, false)}
                  disabled={markingSpecial[e.id]}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                    e.acertou === false ? 'bg-red-500 text-white' : 'bg-white border border-red-300 text-red-600 hover:bg-red-50'
                  }`}>
                  Errou
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const pendingUsers = localUsers.filter((u) => u.status === 'pending')
  const approvedUsers = localUsers.filter((u) => u.status === 'approved')
  const rejectedUsers = localUsers.filter((u) => u.status === 'rejected')

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
      {/* Atualização automática de placares (kill-switch) */}
      <div className={`rounded-xl p-4 mb-6 flex items-center justify-between gap-4 flex-wrap border ${
        autoSync ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div>
          <p className="font-bold text-gray-800">
            {autoSync ? '🟢 Atualização automática LIGADA' : '🔴 Atualização automática DESLIGADA'}
          </p>
          <p className="text-xs text-gray-500">
            {autoSync
              ? 'Os placares dos jogos ao vivo são buscados na API e o ranking se atualiza sozinho.'
              : 'A API não está sendo chamada. Lance os resultados manualmente nas abas abaixo.'}
            {lastSync && (
              <> {' • '}Última sincronização:{' '}
                {new Date(lastSync).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                })}
              </>
            )}
          </p>
        </div>
        <button onClick={handleToggleSync} disabled={togglingSync}
          className={`text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50 ${
            autoSync ? 'bg-red-500 hover:bg-red-600' : 'bg-green-700 hover:bg-green-800'
          }`}>
          {togglingSync ? '...' : autoSync ? 'Desligar' : 'Ligar'}
        </button>
      </div>

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
        <button onClick={() => setActiveTab('especiais')}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${
            activeTab === 'especiais' ? 'bg-green-700 text-yellow-400' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}>
          ⭐ Palpites Especiais
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {userMsg[user.id] && <span className="text-xs text-gray-500">{userMsg[user.id]}</span>}
                      <button onClick={() => handleUserStatus(user.id, 'approved')} disabled={savingUser[user.id]}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                        ✓ Aprovar
                      </button>
                      <button onClick={() => handleUserStatus(user.id, 'rejected')} disabled={savingUser[user.id]}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
                        ✗ Rejeitar
                      </button>
                      <button onClick={() => handleDeleteUser(user.id, user.nome)} disabled={deletingUser[user.id]}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-50">
                        🗑
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
                    <th className="px-4 py-3 text-center">Ações</th>
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
                          className="text-red-500 hover:text-red-700 text-xs font-medium disabled:opacity-30 mr-3">
                          Rejeitar
                        </button>
                        {!user.is_admin && (
                          <button onClick={() => handleDeleteUser(user.id, user.nome)}
                            disabled={deletingUser[user.id]}
                            className="text-gray-400 hover:text-red-600 text-xs font-medium disabled:opacity-30">
                            🗑 Excluir
                          </button>
                        )}
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
                      <button onClick={() => handleDeleteUser(user.id, user.nome)} disabled={deletingUser[user.id]}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-3 py-2 rounded-lg disabled:opacity-50">
                        🗑 Excluir
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
                    <select value={newGame.time_casa}
                      onChange={(e) => setNewGame((p) => ({ ...p, time_casa: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="">-- time --</option>
                      {SELECOES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Time Fora</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="🇦🇷" value={newGame.bandeira_fora}
                      onChange={(e) => setNewGame((p) => ({ ...p, bandeira_fora: e.target.value }))}
                      className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"
                    />
                    <select value={newGame.time_fora}
                      onChange={(e) => setNewGame((p) => ({ ...p, time_fora: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm">
                      <option value="">-- time --</option>
                      {SELECOES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
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
              Nenhum jogo eliminatório. Rode a migração <code>migration_mata_mata.sql</code> para
              semear o chaveamento, ou adicione manualmente.
            </div>
          ) : (
            <div className="space-y-6">
              {KNOCKOUT_FASES.filter((f) => knockoutGamesLocal.some((g) => g.fase === f.key)).map((f) => (
                <div key={f.key}>
                  <h3 className="text-sm font-bold text-gray-700 mb-2">{f.label}</h3>
                  <div className="space-y-3">
                    {knockoutGamesLocal
                      .filter((g) => g.fase === f.key)
                      .sort((a, b) => numFromCode(a.match_code) - numFromCode(b.match_code))
                      .map(renderKnockoutAdminRow)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESPECIAIS TAB */}
      {activeTab === 'especiais' && (
        <div className="space-y-6">
          {/* Champion */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-green-800 mb-1">🏆 Campeão da Copa</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ao salvar, todos os palpites de campeão serão pontuados automaticamente (200 pts para acertos).
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={campeaoSelect} onChange={(e) => setCampeaoSelect(e.target.value)}
                className="flex-1 min-w-48 border-2 border-green-300 rounded-lg px-3 py-2 text-sm font-medium">
                <option value="">-- Selecione o campeão --</option>
                {SELECOES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={handleSaveCampeao} disabled={savingCampeao}
                className="bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {savingCampeao ? 'Salvando...' : 'Salvar Campeão'}
              </button>
            </div>
            {campeaoMsg && (
              <p className={`text-sm mt-2 ${campeaoMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{campeaoMsg}</p>
            )}
          </div>

          {/* Artilheiro */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-green-800 mb-1">⚽ Artilheiro da Copa</h2>
            <p className="text-sm text-gray-500 mb-4">
              Defina a pontuação para quem acertar. A conferência é <strong>manual</strong>:
              marque cada palpite abaixo como acerto ou erro. (O nome oficial é opcional, só para referência.)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Nome do artilheiro" value={artilheiroResult}
                onChange={(e) => setArtilheiroResult(e.target.value)}
                className="flex-1 min-w-48 border-2 border-green-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Pontos para acerto:</label>
                <input type="number" min="0" value={artilheiroPontos}
                  onChange={(e) => setArtilheiroPontos(e.target.value)}
                  className="w-20 border-2 border-green-300 rounded-lg px-2 py-2 text-sm text-center font-bold"
                />
              </div>
              <button onClick={() => handleSaveSpecial('artilheiro')} disabled={savingArtilheiro}
                className="bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {savingArtilheiro ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            {artilheiroMsg && (
              <p className={`text-sm mt-2 ${artilheiroMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{artilheiroMsg}</p>
            )}
            {renderSpecialMarking('artilheiro')}
          </div>

          {/* Melhor Jogador */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-green-800 mb-1">🌟 Melhor Jogador da Copa</h2>
            <p className="text-sm text-gray-500 mb-4">
              Defina a pontuação para quem acertar. A conferência é <strong>manual</strong>:
              marque cada palpite abaixo como acerto ou erro. (O nome oficial é opcional, só para referência.)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Nome do melhor jogador" value={melhorJogadorResult}
                onChange={(e) => setMelhorJogadorResult(e.target.value)}
                className="flex-1 min-w-48 border-2 border-green-300 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Pontos para acerto:</label>
                <input type="number" min="0" value={melhorJogadorPontos}
                  onChange={(e) => setMelhorJogadorPontos(e.target.value)}
                  className="w-20 border-2 border-green-300 rounded-lg px-2 py-2 text-sm text-center font-bold"
                />
              </div>
              <button onClick={() => handleSaveSpecial('melhor_jogador')} disabled={savingMelhorJogador}
                className="bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {savingMelhorJogador ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            {melhorJogadorMsg && (
              <p className={`text-sm mt-2 ${melhorJogadorMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{melhorJogadorMsg}</p>
            )}
            {renderSpecialMarking('melhor_jogador')}
          </div>

          {/* Lista de Jogadores */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-green-800 mb-1">📋 Lista de Jogadores</h2>
            <p className="text-sm text-gray-500 mb-1">
              Esta lista é usada como sugestão de autocompletar para palpites de artilheiro e melhor jogador.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Cole um jogador por linha, ou envie um arquivo CSV/TXT com os nomes na coluna A (primeiro campo de cada linha).
            </p>
            <div className="mb-3 flex gap-3">
              <button onClick={() => fileInputRef.current?.click()}
                className="border border-green-300 text-green-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-50">
                📂 Importar CSV/TXT
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
              {jogadoresLista.length > 0 && (
                <span className="text-xs text-gray-500 flex items-center">{jogadoresLista.length} jogadores na lista atual</span>
              )}
            </div>
            <textarea
              value={jogadoresText}
              onChange={(e) => setJogadoresText(e.target.value)}
              rows={8}
              placeholder="Vinicius Junior&#10;Rodri&#10;Erling Haaland&#10;..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="flex items-center gap-3 mt-3">
              <button onClick={handleSaveLista} disabled={savingLista}
                className="bg-green-700 hover:bg-green-800 text-white font-bold px-5 py-2 rounded-lg text-sm disabled:opacity-50">
                {savingLista ? 'Salvando...' : 'Salvar Lista'}
              </button>
              {listaMsg && (
                <span className={`text-sm ${listaMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{listaMsg}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
