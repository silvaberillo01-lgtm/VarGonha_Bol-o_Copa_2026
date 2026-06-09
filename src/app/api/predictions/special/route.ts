import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { DEADLINE_CAMPEAO } from '@/lib/scoring'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('status').eq('id', user.id).single()
  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Conta não aprovada' }, { status: 403 })
  }

  if (new Date() > DEADLINE_CAMPEAO) {
    return NextResponse.json({ error: 'Prazo encerrado' }, { status: 400 })
  }

  const { tipo, palpite } = await request.json()

  const validTipos = ['artilheiro', 'melhor_jogador']
  if (!validTipos.includes(tipo) || !palpite?.trim()) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('special_predictions')
    .upsert(
      { user_id: user.id, tipo, palpite: palpite.trim(), pontos: 0, acertou: null },
      { onConflict: 'user_id,tipo' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
