import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { normalizeTeam } from '@/lib/teams'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json()
  const { bandeira_casa, bandeira_fora, data_hora, fase, rodada } = body
  const time_casa = normalizeTeam(body.time_casa)
  const time_fora = normalizeTeam(body.time_fora)

  if (!time_casa || !time_fora || !data_hora || !fase) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const validFases = ['fase32', 'oitavas', 'quartas', 'semis', 'terceiro', 'final']
  if (!validFases.includes(fase)) {
    return NextResponse.json({ error: 'Fase inválida' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('games')
    .insert({
      time_casa,
      time_fora,
      bandeira_casa: bandeira_casa || '',
      bandeira_fora: bandeira_fora || '',
      data_hora,
      fase,
      grupo: fase,
      rodada: rodada || 1,
      resultado_lancado: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, game: data })
}
