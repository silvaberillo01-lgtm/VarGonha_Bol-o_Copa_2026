import { createServerClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ParticipanteClient from './ParticipanteClient'
import { Profile } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ParticipantePage({ params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.status !== 'approved') {
    redirect('/dashboard')
  }

  // Participante alvo (precisa estar aprovado para ser visível)
  const { data: target } = await supabase
    .from('profiles')
    .select('id, nome, status')
    .eq('id', params.id)
    .single()

  if (!target || target.status !== 'approved') {
    notFound()
  }

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('data_hora', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', params.id)

  const { data: championPrediction } = await supabase
    .from('champion_predictions')
    .select('selecao, pontos')
    .eq('user_id', params.id)
    .single()

  const { data: specialPredictions } = await supabase
    .from('special_predictions')
    .select('*')
    .eq('user_id', params.id)

  const artilheiro = specialPredictions?.find((p) => p.tipo === 'artilheiro') || null
  const melhorJogador = specialPredictions?.find((p) => p.tipo === 'melhor_jogador') || null

  const isMe = params.id === user.id

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/ranking" className="text-sm text-green-700 hover:underline">← Voltar ao ranking</Link>
          <h1 className="text-2xl font-bold text-green-800 mt-2">
            👁️ Palpites de {target.nome}
            {isMe && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full align-middle">você</span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Os palpites de cada jogo ficam visíveis para todos somente após o bloqueio (prazo encerrado ou jogo iniciado).
          </p>
        </div>

        <ParticipanteClient
          nome={target.nome}
          games={games || []}
          predictions={predictions || []}
          championPrediction={championPrediction || null}
          artilheiro={artilheiro}
          melhorJogador={melhorJogador}
        />
      </main>
    </div>
  )
}
