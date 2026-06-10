/**
 * Script: pendencias.mjs
 * Uso: node scripts/pendencias.mjs
 *
 * Gera um relatório de pendências de palpites para o grupo do WhatsApp.
 * Requer variáveis de ambiente:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Como rodar:
 *   NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=yyy node scripts/pendencias.mjs
 * Ou com .env.local:
 *   node --env-file=.env.local scripts/pendencias.mjs  (Node 20.6+)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas.')
  console.error('   NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const DEADLINE_FASE1 = new Date('2026-06-11T15:00:00-03:00')
const agora = new Date()

async function main() {
  // 1. Buscar usuários aprovados
  const { data: usuarios, error: errUsers } = await supabase
    .from('profiles')
    .select('id, nome, email')
    .eq('status', 'approved')
    .order('nome')

  if (errUsers) throw errUsers

  // 2. Buscar jogos ainda abertos para palpite (fase grupos antes do deadline)
  const { data: jogos, error: errJogos } = await supabase
    .from('games')
    .select('id, fase, grupo, rodada, data_hora, time_casa, time_fora')
    .order('data_hora')

  if (errJogos) throw errJogos

  // Jogos que ainda aceitam palpite
  const jogosAbertos = jogos.filter(j => {
    if (j.fase === 'grupos') {
      return agora < DEADLINE_FASE1
    }
    // Knockout: deadline é o horário do próprio jogo
    return agora < new Date(j.data_hora)
  })

  if (jogosAbertos.length === 0) {
    console.log('⚠️  Nenhum jogo com prazo aberto encontrado.')
  }

  // 3. Buscar todos os palpites existentes
  const { data: palpites, error: errPalpites } = await supabase
    .from('predictions')
    .select('user_id, game_id')

  if (errPalpites) throw errPalpites

  // 4. Buscar palpites de campeão
  const { data: campeoes, error: errCamp } = await supabase
    .from('champion_predictions')
    .select('user_id')

  if (errCamp) throw errCamp

  // 5. Buscar palpites especiais (artilheiro e melhor jogador)
  const { data: especiais, error: errEsp } = await supabase
    .from('special_predictions')
    .select('user_id, tipo')

  if (errEsp) throw errEsp

  const prazoEspecialAberto = agora < DEADLINE_FASE1

  // 6. Montar relatório por usuário
  const linhas = []

  for (const user of usuarios) {
    const palpitesDoUser = new Set(
      palpites.filter(p => p.user_id === user.id).map(p => p.game_id)
    )

    const jogosFaltando = jogosAbertos.filter(j => !palpitesDoUser.has(j.id))

    const temCampeao = campeoes.some(c => c.user_id === user.id)
    const temArtilheiro = especiais.some(e => e.user_id === user.id && e.tipo === 'artilheiro')
    const temMelhorJogador = especiais.some(e => e.user_id === user.id && e.tipo === 'melhor_jogador')

    const especiaisFaltando = []
    if (prazoEspecialAberto) {
      if (!temCampeao) especiaisFaltando.push('Campeão')
      if (!temArtilheiro) especiaisFaltando.push('Artilheiro')
      if (!temMelhorJogador) especiaisFaltando.push('Melhor Jogador')
    }

    const totalPendencias = jogosFaltando.length + especiaisFaltando.length

    if (totalPendencias === 0) continue // sem pendências

    let bloco = `👤 *${user.nome}* — ${totalPendencias} pendência(s)\n`

    if (jogosFaltando.length > 0) {
      bloco += `  ⚽ Jogos sem palpite (${jogosFaltando.length}):\n`
      for (const j of jogosFaltando) {
        const dataJogo = new Date(j.data_hora).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
        const label = j.fase === 'grupos'
          ? `Grupo ${j.grupo} R${j.rodada}`
          : j.fase.toUpperCase()
        bloco += `     • ${j.time_casa} x ${j.time_fora} (${label} - ${dataJogo})\n`
      }
    }

    if (especiaisFaltando.length > 0) {
      bloco += `  🏆 Palpites especiais faltando:\n`
      for (const e of especiaisFaltando) {
        bloco += `     • ${e}\n`
      }
    }

    linhas.push(bloco)
  }

  // 7. Montar mensagem final
  console.log('\n' + '='.repeat(60))
  console.log('📋  PENDÊNCIAS DE PALPITES — BOLÃO COPA 2026')
  console.log('='.repeat(60) + '\n')

  if (linhas.length === 0) {
    console.log('✅ Todos os participantes estão em dia com os palpites!')
  } else {
    const dataAgora = agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    console.log(`🕐 Gerado em: ${dataAgora}\n`)

    if (prazoEspecialAberto) {
      const deadlineStr = DEADLINE_FASE1.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      console.log(`⚠️  Prazo para palpites da fase de grupos e especiais: ${deadlineStr}\n`)
    }

    console.log(linhas.join('\n'))
    console.log(`\n📊 Total de participantes com pendências: ${linhas.length} de ${usuarios.length}`)
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

main().catch(err => {
  console.error('Erro ao executar script:', err)
  process.exit(1)
})
