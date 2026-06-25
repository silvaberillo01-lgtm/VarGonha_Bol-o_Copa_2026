import { createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Liga/desliga a atualização automática de placares (kill-switch).
// Quando desligado, a rota /api/cron/sync-scores não faz nenhuma chamada à API.
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

  const { enabled } = await request.json()
  const value = enabled ? 'true' : 'false'

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('copa_config')
    .upsert({ key: 'auto_sync_enabled', value }, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, enabled: value === 'true' })
}
