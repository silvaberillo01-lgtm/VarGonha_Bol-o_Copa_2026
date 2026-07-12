import { createServerClient } from '@/lib/supabase-server'
import { getChances } from '@/lib/getChances'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  // Sem isso, um proxy/CDN no meio do caminho (ou o próprio navegador) pode
  // guardar a resposta e servir de novo em "Atualizar" seguintes.
  return NextResponse.json(
    { chances },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  )
}
