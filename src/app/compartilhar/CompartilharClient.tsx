'use client'

import ShareCardButton from '@/components/ShareCardButton'

interface Props {
  nome: string
  posicao: number
  totalParticipantes: number
  pontos: number
  exatos: number
  resultado: number
  parciais: number
  totalPalpites: number
  selecaoCampeao: string | null
  bandeiraCampeao: string | null
}

export default function CompartilharClient({
  nome,
  posicao,
  totalParticipantes,
  pontos,
  exatos,
  resultado,
  parciais,
  totalPalpites,
  selecaoCampeao,
  bandeiraCampeao,
}: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-1">📲 Cards para Compartilhar</h1>
      <p className="text-gray-500 text-sm mb-6">
        Gere uma imagem estilizada e mande na zoeira do grupo. Tudo é criado no seu navegador —
        nada é publicado automaticamente.
      </p>

      <div className="space-y-4">
        {/* Ranking */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">🪖 Meu posto no bolão</h2>
          <p className="text-sm text-gray-500 mb-3">
            {posicao > 0
              ? `Você está em ${posicao}º de ${totalParticipantes} com ${pontos} pts.`
              : 'Sua posição aparece assim que houver pontuação.'}
          </p>
          <ShareCardButton
            label="📲 Gerar card do ranking"
            filename="vargonha-ranking.png"
            spec={{
              type: 'ranking',
              nome,
              posicao: posicao > 0 ? posicao : totalParticipantes,
              total: totalParticipantes,
              pontos,
            }}
          />
        </div>

        {/* Retrospecto */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">🔥 Meu retrospecto</h2>
          <p className="text-sm text-gray-500 mb-3">
            {exatos} exatos • {resultado} resultados • {parciais} parciais • {totalPalpites} palpites.
          </p>
          <ShareCardButton
            label="📲 Gerar card do retrospecto"
            filename="vargonha-retrospecto.png"
            spec={{
              type: 'retrospecto',
              nome,
              exatos,
              resultado,
              parciais,
              totalPalpites,
              pontos,
            }}
          />
        </div>

        {/* Campeão */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">🏆 Minha aposta de campeão</h2>
          {selecaoCampeao ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Você apostou em <strong>{selecaoCampeao}</strong> {bandeiraCampeao || ''}.
              </p>
              <ShareCardButton
                label="📲 Gerar card do campeão"
                filename="vargonha-campeao.png"
                spec={{
                  type: 'campeao',
                  nome,
                  selecao: selecaoCampeao,
                  bandeira: bandeiraCampeao,
                }}
              />
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Você ainda não escolheu seu campeão. Faça isso na aba 🥇 Campeão.
            </p>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          💡 Quer compartilhar um <strong>palpite de um jogo específico</strong>? Vá em{' '}
          <span className="font-semibold">🗓️ Hoje</span> e toque em “Compartilhar meu palpite” no
          card do jogo.
        </div>
      </div>
    </div>
  )
}
