import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { BONUS_CAMPEAO } from '@/lib/scoring'
import { normalizeTeam, isSelecao } from '@/lib/teams'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const campeao = normalizeTeam((await request.json()).campeao)
  if (!campeao) return NextResponse.json({ error: 'Selecione o campeão' }, { status: 400 })
  if (!isSelecao(campeao)) return NextResponse.json({ error: 'Seleção inválida' }, { status: 400 })

  const adminSupabase = createAdminClient()

  // Save champion in copa_config
  const { error: configError } = await adminSupabase
    .from('copa_config')
    .upsert({ key: 'campeao', value: campeao, updated_at: new Date().toISOString() })
  if (configError) return NextResponse.json({ error: configError.message }, { status: 500 })

  // Auto-calculate champion_predictions points
  const { data: predictions } = await adminSupabase
    .from('champion_predictions')
    .select('id, selecao')

  if (predictions && predictions.length > 0) {
    for (const pred of predictions) {
      const pontos = normalizeTeam(pred.selecao) === campeao ? BONUS_CAMPEAO : 0
      await adminSupabase
        .from('champion_predictions')
        .update({ pontos })
        .eq('id', pred.id)
    }
  }

  return NextResponse.json({ success: true })
}
