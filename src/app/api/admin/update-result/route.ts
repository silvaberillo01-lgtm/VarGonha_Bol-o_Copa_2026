import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { calcularPontos } from '@/lib/scoring'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { game_id, gols_casa_real, gols_fora_real } = await request.json()

  if (!game_id || gols_casa_real === undefined || gols_fora_real === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (gols_casa_real < 0 || gols_fora_real < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  // Update game result
  const { error: gameError } = await supabase
    .from('games')
    .update({
      gols_casa_real,
      gols_fora_real,
      resultado_lancado: true,
    })
    .eq('id', game_id)

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 })
  }

  // Fetch all predictions for this game
  const { data: predictions, error: predError } = await supabase
    .from('predictions')
    .select('id, gols_casa, gols_fora')
    .eq('game_id', game_id)

  if (predError) {
    return NextResponse.json({ error: predError.message }, { status: 500 })
  }

  // Calculate and update points for each prediction
  const updates = (predictions || []).map((pred) => {
    const pontos = calcularPontos(
      pred.gols_casa,
      pred.gols_fora,
      gols_casa_real,
      gols_fora_real
    )
    return supabase
      .from('predictions')
      .update({ pontos })
      .eq('id', pred.id)
  })

  await Promise.all(updates)

  return NextResponse.json({
    success: true,
    message: `Resultado lançado. ${predictions?.length || 0} palpites atualizados.`,
  })
}
