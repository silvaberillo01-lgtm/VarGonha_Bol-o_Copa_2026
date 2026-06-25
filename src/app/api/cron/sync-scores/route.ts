import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'
import { calcularPontos, calcularPontosMataMata } from '@/lib/scoring'
import { normalizeTeam } from '@/lib/teams'
import { fetchMatchesByDate, mapStatus, type FdMatch } from '@/lib/football-api'

export const dynamic = 'force-dynamic'

// Janela em que um jogo é considerado "ao vivo" e elegível para sync.
// Generosa (210 min) para cobrir prorrogação + pênaltis no mata-mata.
const LIVE_WINDOW_MIN = 210
// Tolerância antes do horário marcado (a API pode marcar IN_PLAY um pouco antes).
const PRE_KICKOFF_MIN = 5

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

// Autoriza via CRON_SECRET no header x-cron-secret ou na query ?secret=.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('x-cron-secret')
  const fromQuery = new URL(request.url).searchParams.get('secret')
  return header === secret || fromQuery === secret
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 1) Kill-switch global.
  const { data: cfg } = await admin
    .from('copa_config')
    .select('value')
    .eq('key', 'auto_sync_enabled')
    .single()

  if (cfg?.value !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'auto_sync_disabled', apiCalls: 0 })
  }

  // 2) Jogos na janela ao vivo e ainda não finalizados (gatekeeper).
  const now = Date.now()
  const lowerBound = new Date(now - LIVE_WINDOW_MIN * 60_000).toISOString()
  const upperBound = new Date(now + PRE_KICKOFF_MIN * 60_000).toISOString()

  const { data: candidates } = await admin
    .from('games')
    .select('*')
    .eq('resultado_lancado', false)
    .gte('data_hora', lowerBound)
    .lte('data_hora', upperBound)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_live_games', apiCalls: 0 })
  }

  // 3) Uma única chamada à API cobrindo as datas dos candidatos (±1 dia por fuso).
  const days = candidates.map((g) => utcDay(g.data_hora as string)).sort()
  const dateFrom = days[0]
  const dateTo = days[days.length - 1]

  const result = await fetchMatchesByDate(dateFrom, dateTo)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, apiCalls: 1 }, { status: 502 })
  }

  const byExtId = new Map<number, FdMatch>(result.matches.map((m) => [m.id, m]))
  const nowIso = new Date().toISOString()
  const summary: { updated: number; finished: number; matched: number } = {
    updated: 0,
    finished: 0,
    matched: 0,
  }

  for (const game of candidates) {
    // Casa por external_match_id; senão, pelo par de seleções (normalizado).
    let match: FdMatch | undefined = game.external_match_id
      ? byExtId.get(game.external_match_id as number)
      : undefined

    if (!match) {
      const nc = normalizeTeam(game.time_casa as string)
      const nf = normalizeTeam(game.time_fora as string)
      match = result.matches.find((m) => {
        const ah = normalizeTeam(m.homeTeam.name)
        const aa = normalizeTeam(m.awayTeam.name)
        return (ah === nc && aa === nf) || (ah === nf && aa === nc)
      })
    }

    if (!match) continue
    summary.matched++

    const status = mapStatus(match.status)

    // Orienta os gols conforme casa/fora do nosso banco (a API pode inverter).
    const homeIsCasa = normalizeTeam(match.homeTeam.name) === normalizeTeam(game.time_casa as string)
    const golsCasa = homeIsCasa ? match.score.fullTime.home : match.score.fullTime.away
    const golsFora = homeIsCasa ? match.score.fullTime.away : match.score.fullTime.home

    // Ainda sem placar (não começou): só registra mapeamento/status.
    if (golsCasa == null || golsFora == null) {
      await admin
        .from('games')
        .update({ external_match_id: match.id, status, last_synced_at: nowIso })
        .eq('id', game.id)
      continue
    }

    const isKnockout = game.fase !== 'grupos'
    const empate = golsCasa === golsFora
    // No mata-mata, empate no fim = pênaltis (a API free não fornece) → NÃO
    // finaliza automaticamente; deixa o admin confirmar quem avançou.
    const finished = status === 'FINISHED' && !(isKnockout && empate)
    const resultadoLancado = finished ? true : (game.resultado_lancado as boolean)

    // Classificado (mata-mata): em placar decidido, quem está/ficou na frente.
    let classificadoReal = (game.classificado_real as string | null) ?? null
    if (isKnockout && !empate) {
      classificadoReal = normalizeTeam(golsCasa > golsFora ? game.time_casa : game.time_fora)
    }

    const scoreChanged =
      game.gols_casa_real !== golsCasa || game.gols_fora_real !== golsFora
    const finishingNow = finished && !game.resultado_lancado

    // Atualiza o jogo sempre (placar/status/last_synced_at).
    await admin
      .from('games')
      .update({
        gols_casa_real: golsCasa,
        gols_fora_real: golsFora,
        status,
        resultado_lancado: resultadoLancado,
        classificado_real: classificadoReal,
        external_match_id: match.id,
        last_synced_at: nowIso,
      })
      .eq('id', game.id)

    if (status === 'FINISHED') summary.finished++

    // Recalcula pontos só quando o placar mudou ou estamos finalizando.
    if (!scoreChanged && !finishingNow) continue
    summary.updated++

    if (isKnockout) {
      const isFase32 = game.fase === 'fase32'
      const timeCasaReal = normalizeTeam(game.time_casa as string) as string
      const timeForaReal = normalizeTeam(game.time_fora as string) as string

      const { data: predictions } = await admin
        .from('predictions')
        .select('id, gols_casa, gols_fora, time_casa_palpite, time_fora_palpite, classificado_palpite')
        .eq('game_id', game.id)

      const updates = (predictions || []).map((pred) => {
        const pontos = calcularPontosMataMata(
          {
            time_casa_palpite: isFase32 ? timeCasaReal : pred.time_casa_palpite,
            time_fora_palpite: isFase32 ? timeForaReal : pred.time_fora_palpite,
            classificado_palpite: pred.classificado_palpite,
            gols_casa: pred.gols_casa,
            gols_fora: pred.gols_fora,
          },
          {
            time_casa_real: timeCasaReal,
            time_fora_real: timeForaReal,
            classificado_real: classificadoReal,
            gols_casa_real: golsCasa,
            gols_fora_real: golsFora,
          },
        )
        return admin.from('predictions').update({ pontos }).eq('id', pred.id)
      })
      await Promise.all(updates)
    } else {
      const { data: predictions } = await admin
        .from('predictions')
        .select('id, gols_casa, gols_fora')
        .eq('game_id', game.id)

      const updates = (predictions || []).map((pred) =>
        admin
          .from('predictions')
          .update({ pontos: calcularPontos(pred.gols_casa, pred.gols_fora, golsCasa, golsFora) })
          .eq('id', pred.id),
      )
      await Promise.all(updates)
    }
  }

  return NextResponse.json({ ok: true, apiCalls: 1, ...summary })
}

// pg_cron/pg_net e cron-job.org normalmente usam POST; GET ajuda a testar no navegador.
export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}
