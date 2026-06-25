-- Atualização automática de placares via API (Football-Data.org)
-- Adiciona suporte a placar AO VIVO (parcial) e mapeamento com a API externa.
--
-- Rodar este arquivo no SQL Editor do Supabase (uma única vez).

-- 1) Novas colunas em games -------------------------------------------------
-- status: ciclo de vida do jogo segundo a API ('SCHEDULED' | 'LIVE' | 'FINISHED').
--         'resultado_lancado' continua sendo a finalização DEFINITIVA (lança pontos
--         finais e trava o jogo contra novas sincronizações).
-- external_match_id: id do jogo na Football-Data.org (mapeamento estável após o 1º casamento).
-- last_synced_at: instante da última sincronização bem-sucedida (exibido no /admin).
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED')),
  ADD COLUMN IF NOT EXISTS external_match_id BIGINT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_games_external_match_id
  ON public.games (external_match_id);

-- 2) Flag global de atualização automática (kill-switch) --------------------
-- Lida por autenticados (policy de leitura já existe em copa_config); escrita
-- feita só via service role no backend (rota admin/toggle-sync).
INSERT INTO public.copa_config (key, value)
VALUES ('auto_sync_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- AGENDAMENTO (opcional, via Supabase pg_cron + pg_net)
-- ---------------------------------------------------------------------------
-- Dispara a rota de sync de minuto em minuto. A PRÓPRIA ROTA decide se há jogo
-- na janela e se o kill-switch está ligado — então só gasta a API durante os
-- jogos. Habilite as extensões e ajuste URL/segredo antes de rodar:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--
--   select cron.schedule('sync-scores', '* * * * *', $$
--     select net.http_post(
--       url     := 'https://SEU-APP.vercel.app/api/cron/sync-scores',
--       headers := jsonb_build_object('x-cron-secret', 'SEU_CRON_SECRET')
--     );
--   $$);
--
-- Para desagendar: select cron.unschedule('sync-scores');
--
-- Alternativa sem SQL: usar cron-job.org chamando a mesma URL a cada 1-2 min
-- com o header x-cron-secret.
