import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { calcularPontos, calcularPontosMataMata } from '@/lib/scoring'
import { normalizeTeam } from '@/lib/teams'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const {
    game_id,
    gols_casa_real,
    gols_fora_real,
    time_casa_real,
    time_fora_real,
    classificado_real,
  } = await request.json()

  if (!game_id || gols_casa_real === undefined || gols_fora_real === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (gols_casa_real < 0 || gols_fora_real < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { data: game } = await adminSupabase
    .from('games')
    .select('fase, time_casa, time_fora, classificado_real')
    .eq('id', game_id)
    .single()

  if (!game) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })

  const isKnockout = game.fase !== 'grupos'

  // Em mata-mata, exige saber quem avança (especialmente em empate).
  const empate = gols_casa_real === gols_fora_real
  let classificadoReal: string | null = normalizeTeam(classificado_real ?? game.classificado_real)
  const timeCasaReal = normalizeTeam(time_casa_real ?? game.time_casa) as string
  const timeForaReal = normalizeTeam(time_fora_real ?? game.time_fora) as string

  if (isKnockout) {
    if (classificadoReal && ![timeCasaReal, timeForaReal].includes(classificadoReal)) {
      return NextResponse.json({ error: 'Classificado inválido para este confronto' }, { status: 400 })
    }
    if (!classificadoReal) {
      if (empate) {
        return NextResponse.json({ error: 'Empate: informe quem se classificou (pênaltis)' }, { status: 400 })
      }
      classificadoReal = gols_casa_real > gols_fora_real ? timeCasaReal : timeForaReal
    }
  }

  const gameUpdate: Record<string, unknown> = {
    gols_casa_real,
    gols_fora_real,
    resultado_lancado: true,
  }
  if (isKnockout) {
    gameUpdate.time_casa = timeCasaReal
    gameUpdate.time_fora = timeForaReal
    gameUpdate.classificado_real = classificadoReal
  }

  const { error: gameError } = await adminSupabase
    .from('games')
    .update(gameUpdate)
    .eq('id', game_id)

  if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 })

  if (isKnockout) {
    const { data: predictions, error: predError } = await adminSupabase
      .from('predictions')
      .select('id, gols_casa, gols_fora, time_casa_palpite, time_fora_palpite, classificado_palpite')
      .eq('game_id', game_id)

    if (predError) return NextResponse.json({ error: predError.message }, { status: 500 })

    const updates = (predictions || []).map((pred) => {
      const pontos = calcularPontosMataMata(
        {
          time_casa_palpite: pred.time_casa_palpite,
          time_fora_palpite: pred.time_fora_palpite,
          classificado_palpite: pred.classificado_palpite,
          gols_casa: pred.gols_casa,
          gols_fora: pred.gols_fora,
        },
        {
          time_casa_real: timeCasaReal,
          time_fora_real: timeForaReal,
          classificado_real: classificadoReal,
          gols_casa_real,
          gols_fora_real,
        },
      )
      return adminSupabase.from('predictions').update({ pontos }).eq('id', pred.id)
    })

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      message: `Resultado lançado. ${predictions?.length || 0} palpites pontuados.`,
    })
  }

  // Fase de grupos: pontuação clássica.
  const { data: predictions, error: predError } = await adminSupabase
    .from('predictions')
    .select('id, gols_casa, gols_fora')
    .eq('game_id', game_id)

  if (predError) return NextResponse.json({ error: predError.message }, { status: 500 })

  const updates = (predictions || []).map((pred) => {
    const pontos = calcularPontos(pred.gols_casa, pred.gols_fora, gols_casa_real, gols_fora_real)
    return adminSupabase.from('predictions').update({ pontos }).eq('id', pred.id)
  })

  await Promise.all(updates)

  return NextResponse.json({
    success: true,
    message: `Resultado lançado. ${predictions?.length || 0} palpites atualizados.`,
  })
}
