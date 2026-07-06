-- ============================================================================
-- Migração — Nova fase de mata-mata (1/16 → final) com pontuação por confronto
--
-- SEGURANÇA: o bolão está EM ANDAMENTO. Esta migração é:
--   • ADITIVA      — só adiciona colunas/linhas, nunca altera/apaga dados.
--   • IDEMPOTENTE  — pode rodar mais de uma vez sem efeito colateral
--                    (ADD COLUMN IF NOT EXISTS, INSERT ... WHERE NOT EXISTS).
--   • REVERSÍVEL   — ver supabase/rollback_mata_mata.sql para desfazer.
--
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
--
-- ATENÇÃO: se você JÁ tinha adicionado jogos de mata-mata manualmente (sem
-- match_code), remova-os antes para não duplicar com o template seedado abaixo.
--   -> conferir: select id, fase, time_casa, time_fora from public.games
--               where fase <> 'grupos' and match_code is null;
-- ============================================================================

-- 1) Novas colunas em games (estrutura/real do confronto)
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS match_code TEXT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS slot_casa TEXT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS slot_fora TEXT;
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS classificado_real TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS games_match_code_key
  ON public.games (match_code) WHERE match_code IS NOT NULL;

-- 2) Novas colunas em predictions (times derivados + quem o usuário faz avançar)
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS time_casa_palpite TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS time_fora_palpite TEXT;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS classificado_palpite TEXT;

-- 3) Seed do template do chaveamento (FIFA v17). Times = placeholder do slot até
--    o admin lançar o confronto real. Datas da 1/16 confirmadas; oitavas→final
--    provisórias (admin pode editar a data/hora depois).
INSERT INTO public.games
  (fase, grupo, rodada, data_hora, time_casa, time_fora, bandeira_casa, bandeira_fora, match_code, slot_casa, slot_fora, resultado_lancado)
SELECT v.fase, v.fase, 1, v.data_hora::timestamptz, v.slot_casa, v.slot_fora, '', '', v.match_code, v.slot_casa, v.slot_fora, FALSE
FROM (VALUES
  -- 1/16 avos (datas confirmadas — BRT)
  ('fase32',  '2026-06-28 16:00:00-03', '2A',  '2B',     'M73'),
  ('fase32',  '2026-06-29 17:30:00-03', '1E',  '3ABCDF', 'M74'),
  ('fase32',  '2026-06-29 22:00:00-03', '1F',  '2C',     'M75'),
  ('fase32',  '2026-06-29 14:00:00-03', '1C',  '2F',     'M76'),
  ('fase32',  '2026-06-30 18:00:00-03', '1I',  '3CDFGH', 'M77'),
  ('fase32',  '2026-06-30 14:00:00-03', '2E',  '2I',     'M78'),
  ('fase32',  '2026-06-30 22:00:00-03', '1A',  '3CEFHI', 'M79'),
  ('fase32',  '2026-07-01 13:00:00-03', '1L',  '3EHIJK', 'M80'),
  ('fase32',  '2026-07-01 21:00:00-03', '1D',  '3BEFIJ', 'M81'),
  ('fase32',  '2026-07-01 17:00:00-03', '1G',  '3AEHIJ', 'M82'),
  ('fase32',  '2026-07-02 20:00:00-03', '2K',  '2L',     'M83'),
  ('fase32',  '2026-07-02 16:00:00-03', '1H',  '2J',     'M84'),
  ('fase32',  '2026-07-03 00:00:00-03', '1B',  '3EFGIJ', 'M85'),
  ('fase32',  '2026-07-03 19:00:00-03', '1J',  '2H',     'M86'),
  ('fase32',  '2026-07-03 22:30:00-03', '1K',  '3DEIJL', 'M87'),
  ('fase32',  '2026-07-03 15:00:00-03', '2D',  '2G',     'M88'),
  -- oitavas (provisório)
  ('oitavas', '2026-07-04 18:00:00-03', 'W74', 'W77',    'M89'),
  ('oitavas', '2026-07-04 14:00:00-03', 'W73', 'W75',    'M90'),
  ('oitavas', '2026-07-05 17:00:00-03', 'W76', 'W78',    'M91'),
  ('oitavas', '2026-07-05 21:00:00-03', 'W79', 'W80',    'M92'),
  ('oitavas', '2026-07-06 16:00:00-03', 'W83', 'W84',    'M93'),
  ('oitavas', '2026-07-06 21:00:00-03', 'W81', 'W82',    'M94'),
  ('oitavas', '2026-07-07 13:00:00-03', 'W86', 'W88',    'M95'),
  ('oitavas', '2026-07-07 17:00:00-03', 'W85', 'W87',    'M96'),
  -- quartas (provisório)
  ('quartas', '2026-07-09 17:00:00-03', 'W89', 'W90',    'M97'),
  ('quartas', '2026-07-10 16:00:00-03', 'W93', 'W94',    'M98'),
  ('quartas', '2026-07-11 18:00:00-03', 'W91', 'W92',    'M99'),
  ('quartas', '2026-07-11 22:00:00-03', 'W95', 'W96',    'M100'),
  -- semis (provisório)
  ('semis',   '2026-07-14 16:00:00-03', 'W97', 'W98',    'M101'),
  ('semis',   '2026-07-15 16:00:00-03', 'W99', 'W100',   'M102'),
  -- terceiro e final (provisório)
  ('terceiro','2026-07-18 16:00:00-03', 'L101','L102',   'M103'),
  ('final',   '2026-07-19 16:00:00-03', 'W101','W102',   'M104')
) AS v(fase, data_hora, slot_casa, slot_fora, match_code)
WHERE NOT EXISTS (
  SELECT 1 FROM public.games g WHERE g.match_code = v.match_code
);

-- 4) get_ranking() — total soma TODOS os pontos (grupos + mata-mata); os
--    contadores ⭐/✅/🟡 passam a refletir SÓ a fase de grupos (para não serem
--    poluídos pelos novos valores de pontuação do mata-mata). CREATE OR REPLACE
--    é reversível (rollback recria a versão anterior).
CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  total_pontos BIGINT,
  acertos_exatos BIGINT,
  acertos_resultado BIGINT,
  acertos_parciais BIGINT,
  total_palpites BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pr.id AS user_id,
    pr.nome,
    (COALESCE(p.total_pontos, 0) + COALESCE(cp.pontos, 0) + COALESCE(sp.total_pontos, 0))::BIGINT AS total_pontos,
    COALESCE(p.exatos, 0)::BIGINT AS acertos_exatos,
    COALESCE(p.resultado, 0)::BIGINT AS acertos_resultado,
    COALESCE(p.parciais, 0)::BIGINT AS acertos_parciais,
    COALESCE(p.total_palpites, 0)::BIGINT AS total_palpites
  FROM public.profiles pr
  LEFT JOIN (
    SELECT pred.user_id,
      SUM(pred.pontos) AS total_pontos,
      COUNT(*) AS total_palpites,
      COUNT(*) FILTER (WHERE g.fase = 'grupos' AND pred.pontos = 15) AS exatos,
      COUNT(*) FILTER (WHERE g.fase = 'grupos' AND pred.pontos = 10) AS resultado,
      COUNT(*) FILTER (WHERE g.fase = 'grupos' AND pred.pontos = 5) AS parciais
    FROM public.predictions pred
    JOIN public.games g ON g.id = pred.game_id
    GROUP BY pred.user_id
  ) p ON p.user_id = pr.id
  LEFT JOIN public.champion_predictions cp ON cp.user_id = pr.id
  LEFT JOIN (
    SELECT user_id, SUM(pontos) AS total_pontos
    FROM public.special_predictions
    GROUP BY user_id
  ) sp ON sp.user_id = pr.id
  WHERE pr.status = 'approved'
  ORDER BY total_pontos DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking() TO authenticated;
