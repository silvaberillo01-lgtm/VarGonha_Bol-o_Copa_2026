import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Marcação MANUAL de um palpite especial (artilheiro / melhor jogador) como acerto ou erro.
export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { prediction_id, acertou } = await request.json()

  if (!prediction_id || typeof acertou !== 'boolean') {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Descobre o tipo do palpite para buscar a pontuação configurada
  const { data: pred, error: predError } = await adminSupabase
    .from('special_predictions')
    .select('id, tipo')
    .eq('id', prediction_id)
    .single()

  if (predError || !pred) {
    return NextResponse.json({ error: 'Palpite não encontrado' }, { status: 404 })
  }

  const { data: config } = await adminSupabase
    .from('copa_config')
    .select('value')
    .eq('key', `${pred.tipo}_pontos`)
    .single()

  const pontosNum = parseInt(config?.value ?? '') || 50

  const { error } = await adminSupabase
    .from('special_predictions')
    .update({ acertou, pontos: acertou ? pontosNum : 0 })
    .eq('id', prediction_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, pontos: acertou ? pontosNum : 0 })
}
