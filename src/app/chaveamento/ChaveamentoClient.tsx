'use client'

import { Fragment, useMemo, useState } from 'react'
import { Game, Prediction } from '@/types'
import { normalizeTeam } from '@/lib/teams'
import {
  computeUserBracket,
  computeOfficialBracket,
  GroupGameResult,
  KnockoutPick,
  OfficialGameInput,
} from '@/lib/bracket'
import {
  getBracketRounds,
  friendlySlot,
  BRACKET_TEMPLATE,
} from '@/lib/bracket-layout'

interface Props {
  games: Game[]
  predictions: Prediction[]
  champion: string | null
}

type View = 'oficial' | 'meu'

const numFromCode = (code?: string | null) => (code ? parseInt(code.replace(/^M/, '')) : NaN)

const TPL_BY_NUM = new Map(BRACKET_TEMPLATE.map((m) => [m.num, m]))

// Altura de cada "linha" da primeira coluna (16 avos). O bracket inteiro tem
// altura fixa e as colunas seguintes se espalham proporcionalmente.
const ROW_H = 60
const THIRD_PLACE = 103
const FINAL = 104

interface Side {
  team: string | null
  label: string // placeholder amigável quando team é nulo
  score: number | null
  advanced: boolean
  isChampion: boolean
}
interface NodeView {
  num: number
  decided: boolean
  home: Side
  away: Side
  pen: { casa: number; fora: number } | null
}

export default function ChaveamentoClient({ games, predictions, champion }: Props) {
  const [view, setView] = useState<View>('oficial')

  const rounds = useMemo(() => getBracketRounds(), [])
  const groupGames = useMemo(() => games.filter((g) => g.fase === 'grupos'), [games])
  const knockoutGames = useMemo(() => games.filter((g) => g.fase !== 'grupos'), [games])

  const champ = normalizeTeam(champion)

  // Bandeira por seleção (derivada de todos os jogos que já têm bandeira).
  const teamFlag = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of games) {
      const tc = normalizeTeam(g.time_casa)
      const tf = normalizeTeam(g.time_fora)
      if (tc && g.bandeira_casa && !m.has(tc)) m.set(tc, g.bandeira_casa)
      if (tf && g.bandeira_fora && !m.has(tf)) m.set(tf, g.bandeira_fora)
    }
    return m
  }, [games])

  const flagOf = (team: string | null) => (team ? teamFlag.get(team) || '' : '')

  // Placar palpitado do usuário por número de jogo do mata-mata.
  const predByNum = useMemo(() => {
    const predByGame = new Map(predictions.map((p) => [p.game_id, p]))
    const m = new Map<number, { casa: number; fora: number }>()
    knockoutGames.forEach((g) => {
      const n = numFromCode(g.match_code)
      const p = predByGame.get(g.id)
      if (!isNaN(n) && p) m.set(n, { casa: p.gols_casa, fora: p.gols_fora })
    })
    return m
  }, [predictions, knockoutGames])

  // Chaveamento OFICIAL (resultados reais).
  const oficial = useMemo(() => {
    const inputs: OfficialGameInput[] = knockoutGames.map((g) => ({
      num: numFromCode(g.match_code),
      resultado_lancado: g.resultado_lancado,
      time_casa: g.time_casa,
      time_fora: g.time_fora,
      classificado_real: g.classificado_real ?? null,
      gols_casa_real: g.gols_casa_real,
      gols_fora_real: g.gols_fora_real,
      gols_penaltis_casa: g.gols_penaltis_casa ?? null,
      gols_penaltis_fora: g.gols_penaltis_fora ?? null,
    }))
    return computeOfficialBracket(inputs)
  }, [knockoutGames])

  // Chaveamento DO USUÁRIO (projeção a partir dos palpites de grupos + campeão).
  const meu = useMemo(() => {
    const predByGame = new Map(predictions.map((p) => [p.game_id, p]))
    const groupResults: GroupGameResult[] = []
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
    const knockoutPicks: Record<number, KnockoutPick> = {}
    const fase32Teams: Record<number, { time_casa: string | null; time_fora: string | null }> = {}
    knockoutGames.forEach((g) => {
      const n = numFromCode(g.match_code)
      if (isNaN(n)) return
      const p = predByGame.get(g.id)
      knockoutPicks[n] = {
        classificado_palpite: p?.classificado_palpite ?? null,
        gols_casa: p?.gols_casa ?? null,
        gols_fora: p?.gols_fora ?? null,
      }
      if (g.fase === 'fase32') {
        fase32Teams[n] = { time_casa: g.time_casa || null, time_fora: g.time_fora || null }
      }
    })
    return computeUserBracket(groupResults, knockoutPicks, champion, fase32Teams)
  }, [predictions, groupGames, knockoutGames, champion])

  // Monta o NodeView de um jogo para a visão atual.
  const nodeFor = (num: number): NodeView => {
    const tpl = TPL_BY_NUM.get(num)
    const slotCasa = tpl?.slot_casa ?? ''
    const slotFora = tpl?.slot_fora ?? ''

    let tc: string | null
    let tf: string | null
    let classificado: string | null
    let decided: boolean
    let sc: number | null
    let sf: number | null
    let pen: { casa: number; fora: number } | null = null

    if (view === 'oficial') {
      const r = oficial[num]
      tc = r?.time_casa ?? null
      tf = r?.time_fora ?? null
      classificado = r?.classificado ?? null
      decided = !!r?.resultado_lancado
      sc = r?.gols_casa ?? null
      sf = r?.gols_fora ?? null
      if (r && r.pen_casa != null && r.pen_fora != null) {
        pen = { casa: r.pen_casa, fora: r.pen_fora }
      }
    } else {
      const r = meu[num]
      tc = r?.time_casa ?? null
      tf = r?.time_fora ?? null
      classificado = r?.classificado ?? null
      decided = classificado != null
      const s = predByNum.get(num)
      sc = s?.casa ?? null
      sf = s?.fora ?? null
    }

    const mkSide = (team: string | null, slot: string, score: number | null): Side => ({
      team,
      label: team || friendlySlot(slot),
      score: team ? score : null,
      advanced: classificado != null && team != null && team === classificado,
      isChampion: !!champ && team === champ,
    })

    return {
      num,
      decided,
      home: mkSide(tc, slotCasa, sc),
      away: mkSide(tf, slotFora, sf),
      pen,
    }
  }

  const finalNode = nodeFor(FINAL)
  const champTeam = finalNode.home.advanced
    ? finalNode.home.team
    : finalNode.away.advanced
    ? finalNode.away.team
    : view === 'meu'
    ? champ
    : null

  const bracketHeight = (rounds[0]?.nums.length || 16) * ROW_H

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-green-800 mb-1">🗺️ Chaveamento</h1>
        <p className="text-gray-500 text-sm">
          {view === 'oficial'
            ? 'Caminho real até o título — atualiza conforme os resultados saem.'
            : 'Sua projeção do mata-mata, montada a partir dos seus palpites de grupos e do seu campeão.'}
        </p>
      </div>

      {/* Toggle de visão */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="inline-flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setView('oficial')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              view === 'oficial' ? 'bg-green-700 text-yellow-400 shadow' : 'text-gray-600 hover:bg-green-50'
            }`}
          >
            🏆 Oficial
          </button>
          <button
            onClick={() => setView('meu')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              view === 'meu' ? 'bg-green-700 text-yellow-400 shadow' : 'text-gray-600 hover:bg-green-50'
            }`}
          >
            👤 Meu palpite
          </button>
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <span className="hidden sm:inline">deslize para os lados</span>
          <span className="sm:hidden">← deslize →</span>
        </span>
      </div>

      {/* Bracket com scroll horizontal */}
      <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 shadow-sm overflow-x-auto">
        <div className="flex items-stretch p-4" style={{ height: bracketHeight, minWidth: 'max-content' }}>
          {rounds.map((round, ri) => (
            <Fragment key={round.fase}>
              {/* Coluna da fase */}
              <div className="flex flex-col" style={{ minWidth: 178 }}>
                <div className="text-center text-[11px] font-bold uppercase tracking-wide text-green-700/70 mb-1">
                  {round.label}
                </div>
                <div className="flex flex-col flex-1">
                  {round.nums.map((num) => (
                    <div key={num} className="flex-1 flex flex-col justify-center px-1.5">
                      <MatchCard node={nodeFor(num)} flagOf={flagOf} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Conectores até a próxima coluna */}
              {ri < rounds.length - 1 && (
                <Connector count={rounds[ri + 1].nums.length} />
              )}
            </Fragment>
          ))}

          {/* Coluna do campeão */}
          <div className="flex flex-col" style={{ minWidth: 150 }}>
            <div className="text-center text-[11px] font-bold uppercase tracking-wide text-yellow-600/80 mb-1">
              Campeão
            </div>
            <div className="flex-1 flex flex-col justify-center px-1.5">
              <ChampionCard team={champTeam} flag={flagOf(champTeam)} />
            </div>
          </div>
        </div>
      </div>

      {/* Disputa de 3º lugar */}
      <div className="mt-5 max-w-sm">
        <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600/80 mb-1">
          🥉 Disputa de 3º lugar
        </div>
        <MatchCard node={nodeFor(THIRD_PLACE)} flagOf={flagOf} />
      </div>

      {/* Legenda */}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
          avança / classificado
        </span>
        <span className="flex items-center gap-1.5">👑 seu campeão</span>
        <span className="flex items-center gap-1.5">
          <span className="text-blue-600 font-semibold">pên</span> decisão por pênaltis
        </span>
      </div>
    </div>
  )
}

// ---- Conector SVG entre duas colunas ----------------------------------------
// `count` = nº de confrontos da PRÓXIMA coluna (cada um recebe 2 alimentadores).
// O SVG usa preserveAspectRatio="none" + vector-effect para escalar com a altura
// sem distorcer a espessura da linha. Cada célula cobre o par de alimentadores.
function Connector({ count }: { count: number }) {
  return (
    <div className="flex flex-col self-stretch" style={{ width: 26 }}>
      {/* Espaçador invisível com a mesma altura do cabeçalho da coluna, para
          que os conectores comecem exatamente onde começam os cards. */}
      <div className="text-[11px] uppercase tracking-wide mb-1" aria-hidden>
        &nbsp;
      </div>
      <div className="flex flex-col flex-1">
        {Array.from({ length: count }).map((_, j) => (
          <div key={j} className="flex-1">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d="M0 25 H50 M0 75 H50 M50 25 V75 M50 50 H100"
                fill="none"
                stroke="#86efac"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Card de um confronto ---------------------------------------------------
function MatchCard({ node, flagOf }: { node: NodeView; flagOf: (t: string | null) => string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <TeamRow side={node.home} decided={node.decided} flag={flagOf(node.home.team)} />
      <div className="h-px bg-gray-100" />
      <TeamRow side={node.away} decided={node.decided} flag={flagOf(node.away.team)} />
      {node.pen && (
        <div className="text-[9px] font-bold text-blue-700 bg-blue-50 border-t border-blue-100 text-center py-0.5">
          pênaltis {node.pen.casa}–{node.pen.fora}
        </div>
      )}
    </div>
  )
}

function TeamRow({ side, decided, flag }: { side: Side; decided: boolean; flag: string }) {
  const dimmed = decided && !side.advanced && !!side.team
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 ${
        side.advanced ? 'bg-emerald-50' : ''
      }`}
    >
      <span className="w-4 text-center text-sm leading-none shrink-0">{flag || '·'}</span>
      <span
        className={`flex-1 truncate text-[11px] leading-tight ${
          side.advanced
            ? 'font-bold text-emerald-800'
            : !side.team
            ? 'italic text-gray-400'
            : dimmed
            ? 'text-gray-400'
            : 'text-gray-700 font-medium'
        }`}
      >
        {side.isChampion && <span className="mr-0.5">👑</span>}
        {side.label}
      </span>
      {side.advanced && <span className="text-emerald-600 text-[10px] shrink-0">✓</span>}
      <span
        className={`w-3.5 text-right text-[11px] tabular-nums shrink-0 ${
          side.advanced ? 'font-bold text-emerald-800' : 'text-gray-500'
        }`}
      >
        {side.score ?? ''}
      </span>
    </div>
  )
}

function ChampionCard({ team, flag }: { team: string | null; flag: string }) {
  return (
    <div
      className={`rounded-xl border-2 p-3 text-center shadow-sm ${
        team ? 'border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50' : 'border-dashed border-gray-200 bg-white'
      }`}
    >
      <div className="text-2xl leading-none mb-1">{team ? '🏆' : '🏆'}</div>
      {team ? (
        <>
          <div className="text-xl leading-none mb-0.5">{flag}</div>
          <div className="font-extrabold text-green-800 text-sm leading-tight">{team}</div>
        </>
      ) : (
        <div className="text-xs italic text-gray-400 leading-tight">a definir</div>
      )}
    </div>
  )
}
