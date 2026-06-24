import { createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { DEADLINE_FASE1, DEADLINE_CAMPEAO } from '@/lib/scoring'
import { knockoutLockTime } from '@/lib/match-utils'
import {
  computeUserBracket,
  GroupGameResult,
  KnockoutPick,
} from '@/lib/bracket'
import { normalizeTeam, isSelecao } from '@/lib/teams'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Usuário não aprovado' }, { status: 403 })
  }

  const body = await request.json()

  if (body.type === 'champion') {
    if (new Date() > DEADLINE_CAMPEAO) {
      return NextResponse.json({ error: 'Prazo para palpite do campeão encerrado' }, { status: 400 })
    }
    const selecao = normalizeTeam(body.selecao)
    if (!selecao) {
      return NextResponse.json({ error: 'Selecione uma seleção' }, { status: 400 })
    }
    if (!isSelecao(selecao)) {
      return NextResponse.json({ error: 'Seleção inválida' }, { status: 400 })
    }
    const { error } = await supabase
      .from('champion_predictions')
      .upsert({ user_id: user.id, selecao, pontos: 0 }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { game_id, gols_casa, gols_fora, classificado_palpite } = body

  if (!game_id || gols_casa === undefined || gols_fora === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  if (gols_casa < 0 || gols_fora < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  const { data: game } = await supabase
    .from('games')
    .select('resultado_lancado, data_hora, fase, match_code')
    .eq('id', game_id)
    .single()

  if (!game) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (game.resultado_lancado) {
    return NextResponse.json({ error: 'Resultado já lançado para este jogo' }, { status: 400 })
  }

  // Fase de grupos: prazo global. Mata-mata: fecha 30 min antes do jogo.
  if (game.fase === 'grupos') {
    if (new Date() > DEADLINE_FASE1) {
      return NextResponse.json({ error: 'Prazo para palpites da fase de grupos encerrado' }, { status: 400 })
    }
    const { error } = await supabase
      .from('predictions')
      .upsert(
        { user_id: user.id, game_id, gols_casa, gols_fora, pontos: 0 },
        { onConflict: 'user_id,game_id' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ---- Mata-mata ----
  if (new Date() > knockoutLockTime(game.data_hora)) {
    return NextResponse.json({ error: 'Palpite encerrado (fecha 30 min antes do jogo)' }, { status: 400 })
  }

  // Deriva os times do confronto a partir do chaveamento do próprio usuário.
  let time_casa_palpite: string | null = null
  let time_fora_palpite: string | null = null
  let championSelecao: string | null = null

  if (game.match_code) {
    const num = parseInt(game.match_code.replace(/^M/, ''))

    // Resultados de grupos palpitados pelo usuário.
    const { data: groupRows } = await supabase
      .from('games')
      .select('id, grupo, time_casa, time_fora, fase')
      .eq('fase', 'grupos')
    const groupGameById = new Map((groupRows || []).map((g) => [g.id, g]))

    const { data: myPreds } = await supabase
      .from('predictions')
      .select('game_id, gols_casa, gols_fora, classificado_palpite, time_casa_palpite, time_fora_palpite')
      .eq('user_id', user.id)

    const groupResults: GroupGameResult[] = []
    const knockoutPicks: Record<number, KnockoutPick> = {}

    // Mapa game_id -> match_code e confrontos REAIS dos 16 avos (lançados pelo
    // admin), usados para montar o chaveamento.
    const { data: koGames } = await supabase
      .from('games')
      .select('id, match_code, time_casa, time_fora, fase')
      .neq('fase', 'grupos')
    const koCodeById = new Map((koGames || []).map((g) => [g.id, g.match_code as string | null]))
    const fase32Teams: Record<number, { time_casa: string | null; time_fora: string | null }> = {}
    for (const g of koGames || []) {
      if (g.fase === 'fase32' && g.match_code) {
        fase32Teams[parseInt((g.match_code as string).replace(/^M/, ''))] = {
          time_casa: (g.time_casa as string) ?? null,
          time_fora: (g.time_fora as string) ?? null,
        }
      }
    }

    for (const p of myPreds || []) {
      const gg = groupGameById.get(p.game_id)
      if (gg) {
        groupResults.push({
          grupo: gg.grupo as string,
          time_casa: gg.time_casa as string,
          time_fora: gg.time_fora as string,
          gols_casa: p.gols_casa,
          gols_fora: p.gols_fora,
        })
        continue
      }
      const code = koCodeById.get(p.game_id)
      if (code) {
        knockoutPicks[parseInt(code.replace(/^M/, ''))] = {
          classificado_palpite: p.classificado_palpite,
          gols_casa: p.gols_casa,
          gols_fora: p.gols_fora,
        }
      }
    }

    const { data: champ } = await supabase
      .from('champion_predictions')
      .select('selecao')
      .eq('user_id', user.id)
      .maybeSingle()

    championSelecao = champ?.selecao || null
    const bracket = computeUserBracket(groupResults, knockoutPicks, championSelecao, fase32Teams)
    const resolved = bracket[num]
    if (resolved) {
      time_casa_palpite = resolved.time_casa
      time_fora_palpite = resolved.time_fora
    }

    // Mantém os times derivados de TODOS os palpites de mata-mata do usuário
    // sincronizados (uma mudança numa fase anterior altera os confrontos das
    // seguintes). Atualiza só os que ficaram defasados.
    const refresh = (myPreds || [])
      .filter((p) => koCodeById.has(p.game_id) && p.game_id !== game_id)
      .map((p) => {
        const n = parseInt((koCodeById.get(p.game_id) as string).replace(/^M/, ''))
        const r = bracket[n]
        if (!r) return null
        if (p.time_casa_palpite === r.time_casa && p.time_fora_palpite === r.time_fora) return null
        return supabase
          .from('predictions')
          .update({ time_casa_palpite: r.time_casa, time_fora_palpite: r.time_fora })
          .eq('user_id', user.id)
          .eq('game_id', p.game_id)
      })
      .filter(Boolean)
    if (refresh.length) await Promise.all(refresh)
  }

  // Valida quem avança. Em caso de empate, é obrigatório escolher.
  let classificadoFinal: string | null = normalizeTeam(classificado_palpite)
  const empate = gols_casa === gols_fora

  // Campeão sempre avança (todas as fases, 16 avos incluído): se o campeão
  // palpitado está no confronto, ele é o classificado e sobrepõe o palpite.
  const champNorm = normalizeTeam(championSelecao)
  if (champNorm && (champNorm === time_casa_palpite || champNorm === time_fora_palpite)) {
    classificadoFinal = champNorm
  }

  if (time_casa_palpite && time_fora_palpite) {
    if (classificadoFinal && ![time_casa_palpite, time_fora_palpite].includes(classificadoFinal)) {
      return NextResponse.json({ error: 'Classificado inválido para este confronto' }, { status: 400 })
    }
    if (!classificadoFinal) {
      if (empate) {
        return NextResponse.json({ error: 'Empate: escolha quem se classifica nos pênaltis' }, { status: 400 })
      }
      classificadoFinal = gols_casa > gols_fora ? time_casa_palpite : time_fora_palpite
    }
  }

  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: user.id,
        game_id,
        gols_casa,
        gols_fora,
        pontos: 0,
        time_casa_palpite,
        time_fora_palpite,
        classificado_palpite: classificadoFinal,
      },
      { onConflict: 'user_id,game_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
