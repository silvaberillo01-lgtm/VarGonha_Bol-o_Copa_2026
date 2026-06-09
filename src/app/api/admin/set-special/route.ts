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

  if (!tipo) {
    return NextResponse.json({ success: true })
  }

  const validTipos = ['artilheiro', 'melhor_jogador']
  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  const pontosNum = parseInt(pontos) || 50

  // Save points value for this tipo
  await adminSupabase.from('copa_config').upsert({
    key: `${tipo}_pontos`,
    value: pontosNum.toString(),
    updated_at: new Date().toISOString(),
  })

  // Save official result name (informativo — a avaliação é manual)
  if (resultado !== undefined && resultado !== null) {
    await adminSupabase.from('copa_config').upsert({
      key: tipo,
      value: resultado,
      updated_at: new Date().toISOString(),
    })
  }

  // Recalcula a pontuação SEM auto-validar: respeita a marcação manual (acertou).
  // Quem foi marcado como acerto recebe a pontuação atual; os demais ficam com 0.
  await adminSupabase
    .from('special_predictions')
    .update({ pontos: pontosNum })
    .eq('tipo', tipo)
    .eq('acertou', true)

  await adminSupabase
    .from('special_predictions')
    .update({ pontos: 0 })
    .eq('tipo', tipo)
    .or('acertou.is.null,acertou.eq.false')

  return NextResponse.json({ success: true })
}
