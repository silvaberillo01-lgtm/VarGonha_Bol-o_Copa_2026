import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { tipo, resultado, pontos, jogadores_lista } = await request.json()

  const adminSupabase = createAdminClient()

  // Save player list if provided
  if (jogadores_lista !== undefined) {
    await adminSupabase.from('copa_config').upsert({
      key: 'jogadores_lista',
      value: JSON.stringify(jogadores_lista),
      updated_at: new Date().toISOString(),
    })
  }

  if (!tipo || !resultado) {
    return NextResponse.json({ success: true })
  }

  const validTipos = ['artilheiro', 'melhor_jogador']
  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const pontosNum = parseInt(pontos) || 50

  // Save result in copa_config
  await adminSupabase.from('copa_config').upsert({
    key: tipo,
    value: resultado,
    updated_at: new Date().toISOString(),
  })

  await adminSupabase.from('copa_config').upsert({
    key: `${tipo}_pontos`,
    value: pontosNum.toString(),
    updated_at: new Date().toISOString(),
  })

  // Auto-calculate points for matching predictions
  const { data: predictions } = await adminSupabase
    .from('special_predictions')
    .select('id, palpite')
    .eq('tipo', tipo)

  if (predictions && predictions.length > 0) {
    for (const pred of predictions) {
      const earned = pred.palpite.toLowerCase().trim() === resultado.toLowerCase().trim() ? pontosNum : 0
      await adminSupabase
        .from('special_predictions')
        .update({ pontos: earned })
        .eq('id', pred.id)
    }
  }

  return NextResponse.json({ success: true })
}
