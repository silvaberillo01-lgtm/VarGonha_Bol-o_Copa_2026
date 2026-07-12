import { createServerClient } from '@/lib/supabase-server'
import { getChances } from '@/lib/getChances'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Recalcula a coluna Chance sob demanda — chamada pelo botão "Atualizar" e
// pelo auto-refresh da página de ranking, já que aquele cálculo roda no
// servidor e não acompanha sozinho o refresh client-side do resto da tabela.
export async function GET() {
  const supabase = createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single()
  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: 'Usuário não aprovado' }, { status: 403 })
  }

  const chances = await getChances(supabase)
  return NextResponse.json({ chances })
}
