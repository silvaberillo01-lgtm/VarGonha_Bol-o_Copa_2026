import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DEADLINE_FASE1, DEADLINE_CAMPEAO } from '@/lib/scoring'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Check if user is approved
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Usuário não aprovado' }, { status: 403 })
  }

  const body = await request.json()

  // Champion prediction
  if (body.type === 'champion') {
    if (new Date() > DEADLINE_CAMPEAO) {
      return NextResponse.json({ error: 'Prazo para palpite do campeão encerrado' }, { status: 400 })
    }

    const { selecao } = body

    if (!selecao) {
      return NextResponse.json({ error: 'Selecione uma seleção' }, { status: 400 })
    }

    const { error } = await supabase
      .from('champion_predictions')
      .upsert(
        { user_id: session.user.id, selecao, pontos: 0 },
        { onConflict: 'user_id' }
      )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  // Game prediction
  if (new Date() > DEADLINE_FASE1) {
    return NextResponse.json({ error: 'Prazo para palpites encerrado' }, { status: 400 })
  }

  const { game_id, gols_casa, gols_fora } = body

  if (!game_id || gols_casa === undefined || gols_fora === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (gols_casa < 0 || gols_fora < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  // Check if game already has result
  const { data: game } = await supabase
    .from('games')
    .select('resultado_lancado')
    .eq('id', game_id)
    .single()

  if (game?.resultado_lancado) {
    return NextResponse.json({ error: 'Resultado já lançado para este jogo' }, { status: 400 })
  }

  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: session.user.id,
        game_id,
        gols_casa,
        gols_fora,
        pontos: 0,
      },
      { onConflict: 'user_id,game_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
