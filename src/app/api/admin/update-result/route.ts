import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { calcularPontos } from '@/lib/scoring'

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

  const { game_id, gols_casa_real, gols_fora_real, penaltis_casa, penaltis_fora } = await request.json()

  if (!game_id || gols_casa_real === undefined || gols_fora_real === undefined) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  if (gols_casa_real < 0 || gols_fora_real < 0) {
    return NextResponse.json({ error: 'Gols não podem ser negativos' }, { status: 400 })
  }

  // Use admin client to bypass RLS
  const adminSupabase = createAdminClient()

  const gameUpdate: Record<string, unknown> = { gols_casa_real, gols_fora_real, resultado_lancado: true }

  // Penalty scores are optional and only apply to knockout draws
  if (penaltis_casa !== undefined && penaltis_fora !== undefined && penaltis_casa !== null && penaltis_fora !== null) {
    gameUpdate.penaltis_casa = penaltis_casa
    gameUpdate.penaltis_fora = penaltis_fora
  } else {
    // Clear penalty data if not provided (e.g., result was edited and no longer a draw)
    gameUpdate.penaltis_casa = null
    gameUpdate.penaltis_fora = null
  }

  const { error: gameError } = await adminSupabase
    .from('games')
    .update(gameUpdate)
    .eq('id', game_id)

  if (gameError) return NextResponse.json({ error: gameError.message }, { status: 500 })

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
