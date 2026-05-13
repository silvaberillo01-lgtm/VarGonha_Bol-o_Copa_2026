'use client'

import { useState } from 'react'
import { DEADLINE_CAMPEAO, BONUS_CAMPEAO } from '@/lib/scoring'
import { SpecialPrediction } from '@/types'

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
  myArtilheiro: SpecialPrediction | null
  myMelhorJogador: SpecialPrediction | null
  copaConfig: Record<string, string>
}

export default function ChampionClient({
  myPrediction,
  allPredictions,
  userId,
  myArtilheiro,
  myMelhorJogador,
  copaConfig,
}: Props) {
  const [selected, setSelected] = useState(myPrediction?.selecao || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [artilheiroInput, setArtilheiroInput] = useState(myArtilheiro?.palpite || '')
  const [savingArt, setSavingArt] = useState(false)
  const [savedArt, setSavedArt] = useState(false)
  const [errorArt, setErrorArt] = useState('')

  const [melhorInput, setMelhorInput] = useState(myMelhorJogador?.palpite || '')
  const [savingMelhor, setSavingMelhor] = useState(false)
  const [savedMelhor, setSavedMelhor] = useState(false)
  const [errorMelhor, setErrorMelhor] = useState('')

  const isPastDeadline = new Date() > DEADLINE_CAMPEAO

  const jogadoresList: string[] = copaConfig['jogadores_lista']
    ? JSON.parse(copaConfig['jogadores_lista'])
    : []

  const artilheiroPontos = parseInt(copaConfig['artilheiro_pontos'] || '50')
  const melhorJogadorPontos = parseInt(copaConfig['melhor_jogador_pontos'] || '50')

  const handleSaveChampion = async () => {
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

  const handleSaveSpecial = async (tipo: 'artilheiro' | 'melhor_jogador') => {
    const palpite = tipo === 'artilheiro' ? artilheiroInput : melhorInput
    const setSaving2 = tipo === 'artilheiro' ? setSavingArt : setSavingMelhor
    const setSaved2 = tipo === 'artilheiro' ? setSavedArt : setSavedMelhor
    const setError2 = tipo === 'artilheiro' ? setErrorArt : setErrorMelhor

    if (!palpite.trim()) {
      setError2('Preencha o campo.')
      return
    }
    setSaving2(true)
    setError2('')
    const response = await fetch('/api/predictions/special', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, palpite }),
    })
    setSaving2(false)
    if (response.ok) {
      setSaved2(true)
    } else {
      const data = await response.json()
      setError2(data.error || 'Erro ao salvar.')
    }
  }

  const deadlineStr = DEADLINE_CAMPEAO.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-green-800 mb-1">🏆 Palpites Especiais</h1>
        <p className="text-gray-500 text-sm">Palpites sobre o campeão, artilheiro e melhor jogador da Copa 2026.</p>
      </div>

      {/* Deadline Notice */}
      {isPastDeadline ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <p className="font-semibold">🔒 Prazo encerrado!</p>
          <p className="text-sm mt-1">O prazo para palpites especiais era {deadlineStr}.</p>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4">
          <p className="font-semibold">⏰ Prazo: {deadlineStr}</p>
          <p className="text-sm mt-1">Após o prazo, não será possível alterar seus palpites.</p>
        </div>
      )}

      {/* CAMPEÃO */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">🏆 Campeão da Copa</h2>
        <p className="text-sm text-gray-500 mb-4">
          Acerte o campeão e ganhe <strong className="text-green-700">{BONUS_CAMPEAO} pontos bônus!</strong>
        </p>

        {myPrediction && isPastDeadline && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 font-semibold">Seu palpite: {myPrediction.selecao}</p>
            {myPrediction.pontos > 0 && (
              <p className="text-green-600 mt-1">🎉 Você ganhou {myPrediction.pontos} pontos!</p>
            )}
          </div>
        )}

        {!isPastDeadline && (
          <div className="space-y-3">
            {myPrediction && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Palpite atual: <strong>{myPrediction.selecao}</strong>
              </div>
            )}
            <select value={selected} onChange={(e) => { setSelected(e.target.value); setSaved(false) }}
              className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 font-medium">
              <option value="">-- Escolha uma seleção --</option>
              {SELECOES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {saved && <p className="text-green-600 text-sm">✓ Palpite salvo com sucesso!</p>}
            <button onClick={handleSaveChampion} disabled={saving || !selected}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-green-900 font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : myPrediction ? 'Atualizar palpite' : 'Salvar palpite'}
            </button>
          </div>
        )}
      </div>

      {/* ARTILHEIRO */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">⚽ Artilheiro da Copa</h2>
        <p className="text-sm text-gray-500 mb-4">
          Acerte o artilheiro e ganhe <strong className="text-green-700">{artilheiroPontos} pontos bônus!</strong>
          {' '}(pontos definidos pelo administrador)
        </p>

        {myArtilheiro && isPastDeadline && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 font-semibold">Seu palpite: {myArtilheiro.palpite}</p>
            {myArtilheiro.pontos > 0 && (
              <p className="text-green-600 mt-1">🎉 Você ganhou {myArtilheiro.pontos} pontos!</p>
            )}
          </div>
        )}

        {!isPastDeadline && (
          <div className="space-y-3">
            {myArtilheiro && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Palpite atual: <strong>{myArtilheiro.palpite}</strong>
              </div>
            )}
            {jogadoresList.length > 0 ? (
              <select
                value={artilheiroInput}
                onChange={(e) => { setArtilheiroInput(e.target.value); setSavedArt(false) }}
                className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              >
                <option value="">-- Escolha o artilheiro --</option>
                {jogadoresList.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={artilheiroInput}
                onChange={(e) => { setArtilheiroInput(e.target.value); setSavedArt(false) }}
                placeholder="Digite o nome do jogador..."
                className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              />
            )}
            {errorArt && <p className="text-red-500 text-sm">{errorArt}</p>}
            {savedArt && <p className="text-green-600 text-sm">✓ Palpite salvo com sucesso!</p>}
            <button onClick={() => handleSaveSpecial('artilheiro')} disabled={savingArt || !artilheiroInput.trim()}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-green-900 font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
              {savingArt ? 'Salvando...' : myArtilheiro ? 'Atualizar palpite' : 'Salvar palpite'}
            </button>
          </div>
        )}
      </div>

      {/* MELHOR JOGADOR */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">🌟 Melhor Jogador da Copa</h2>
        <p className="text-sm text-gray-500 mb-4">
          Acerte o melhor jogador e ganhe <strong className="text-green-700">{melhorJogadorPontos} pontos bônus!</strong>
          {' '}(pontos definidos pelo administrador)
        </p>

        {myMelhorJogador && isPastDeadline && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700 font-semibold">Seu palpite: {myMelhorJogador.palpite}</p>
            {myMelhorJogador.pontos > 0 && (
              <p className="text-green-600 mt-1">🎉 Você ganhou {myMelhorJogador.pontos} pontos!</p>
            )}
          </div>
        )}

        {!isPastDeadline && (
          <div className="space-y-3">
            {myMelhorJogador && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                ✓ Palpite atual: <strong>{myMelhorJogador.palpite}</strong>
              </div>
            )}
            {jogadoresList.length > 0 ? (
              <select
                value={melhorInput}
                onChange={(e) => { setMelhorInput(e.target.value); setSavedMelhor(false) }}
                className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              >
                <option value="">-- Escolha o melhor jogador --</option>
                {jogadoresList.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={melhorInput}
                onChange={(e) => { setMelhorInput(e.target.value); setSavedMelhor(false) }}
                placeholder="Digite o nome do jogador..."
                className="w-full border-2 border-green-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
              />
            )}
            {errorMelhor && <p className="text-red-500 text-sm">{errorMelhor}</p>}
            {savedMelhor && <p className="text-green-600 text-sm">✓ Palpite salvo com sucesso!</p>}
            <button onClick={() => handleSaveSpecial('melhor_jogador')} disabled={savingMelhor || !melhorInput.trim()}
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-green-900 font-bold py-3 rounded-lg transition-colors disabled:opacity-50">
              {savingMelhor ? 'Salvando...' : myMelhorJogador ? 'Atualizar palpite' : 'Salvar palpite'}
            </button>
          </div>
        )}
      </div>

      {/* All champion predictions (after deadline) */}
      {isPastDeadline && allPredictions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Palpites de campeão de todos</h2>
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
