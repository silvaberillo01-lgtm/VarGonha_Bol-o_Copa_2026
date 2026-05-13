import { createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { DEADLINE_FASE1, DEADLINE_CAMPEAO } from '@/lib/scoring'

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
    const { selecao } = body
    if (!selecao) {
      return NextResponse.json({ error: 'Selecione uma seleção' }, { status: 400 })
    }
    const { error } = await supabase
      .from('champion_predictions')
      .upsert({ user_id: user.id, selecao, pontos: 0 }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const { game_id, gols_casa, gols_fora } = body

  if (!game_id || gols_casa === undefined || gols_fora === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  if (gols_casa < 0 || gols_fora < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  const { data: game } = await supabase
    .from('games')
    .select('resultado_lancado, data_hora, fase')
    .eq('id', game_id)
    .single()

  if (!game) return NextResponse.json({ error: 'Jogo não encontrado' }, { status: 404 })
  if (game.resultado_lancado) {
    return NextResponse.json({ error: 'Resultado já lançado para este jogo' }, { status: 400 })
  }

  // Group stage: global deadline. Knockout: per-game deadline (game start time)
  if (game.fase === 'grupos') {
    if (new Date() > DEADLINE_FASE1) {
      return NextResponse.json({ error: 'Prazo para palpites da fase de grupos encerrado' }, { status: 400 })
    }
  } else {
    if (new Date() > new Date(game.data_hora)) {
      return NextResponse.json({ error: 'Este jogo já começou' }, { status: 400 })
    }
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
