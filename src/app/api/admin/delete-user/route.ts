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

  const { user_id } = await request.json()
  if (!user_id) return NextResponse.json({ error: 'user_id obrigatório' }, { status: 400 })

  if (user_id === user.id) {
    return NextResponse.json({ error: 'Não é possível excluir a própria conta' }, { status: 400 })
  }

  const adminSupabase = createAdminClient()

  // Delete from auth (cascades to profiles via trigger or FK)
  const { error: authError } = await adminSupabase.auth.admin.deleteUser(user_id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // Delete profile (in case there's no cascade)
  await adminSupabase.from('profiles').delete().eq('id', user_id)

  return NextResponse.json({ success: true })
}
