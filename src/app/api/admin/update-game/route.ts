import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { normalizeTeam } from '@/lib/teams'

export const dynamic = 'force-dynamic'

// Edita dados de um jogo do mata-mata (times reais, bandeiras, data/hora) SEM
// lançar resultado. Útil para preencher confrontos conforme são definidos e
// ajustar datas provisórias das fases posteriores.
export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { game_id, time_casa, time_fora, bandeira_casa, bandeira_fora, data_hora } = await request.json()
  if (!game_id) return NextResponse.json({ error: 'Jogo não informado' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (time_casa !== undefined) update.time_casa = normalizeTeam(time_casa)
  if (time_fora !== undefined) update.time_fora = normalizeTeam(time_fora)
  if (bandeira_casa !== undefined) update.bandeira_casa = bandeira_casa
  if (bandeira_fora !== undefined) update.bandeira_fora = bandeira_fora
  if (data_hora !== undefined && data_hora !== '') update.data_hora = data_hora

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('games').update(update).eq('id', game_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, game: data })
}
