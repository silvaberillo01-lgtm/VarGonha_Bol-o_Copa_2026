-- ============================================================================
-- ROLLBACK — desfaz supabase/migration_mata_mata.sql
--
-- Use SOMENTE se precisar reverter a feature de mata-mata. É seguro: remove
-- apenas o que a migração adicionou. Os palpites/resultados da fase de grupos
-- NÃO são tocados.
--
-- ⚠️ Remove os jogos do template (match_code 'M73'..'M104') e, em cascata, os
-- palpites feitos nesses jogos (ON DELETE CASCADE). Se já houver palpites de
-- mata-mata que você queira preservar, NÃO rode a etapa 1.
-- ============================================================================

-- 1) Remove os jogos do template do mata-mata (e seus palpites, via cascade).
DELETE FROM public.games WHERE match_code LIKE 'M%';

-- 2) Restaura get_ranking() para a versão anterior (contadores por valor de pontos).
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
    SELECT user_id,
      SUM(pontos) AS total_pontos,
      COUNT(*) AS total_palpites,
      COUNT(*) FILTER (WHERE pontos = 15) AS exatos,
      COUNT(*) FILTER (WHERE pontos = 10) AS resultado,
      COUNT(*) FILTER (WHERE pontos = 5) AS parciais
    FROM public.predictions
    GROUP BY user_id
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

-- 3) (Opcional) Remover as colunas adicionadas. Deixe comentado a menos que
--    queira realmente descartar os dados de mata-mata gravados.
-- ALTER TABLE public.predictions DROP COLUMN IF EXISTS time_casa_palpite;
-- ALTER TABLE public.predictions DROP COLUMN IF EXISTS time_fora_palpite;
-- ALTER TABLE public.predictions DROP COLUMN IF EXISTS classificado_palpite;
-- DROP INDEX IF EXISTS public.games_match_code_key;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS match_code;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS slot_casa;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS slot_fora;
-- ALTER TABLE public.games DROP COLUMN IF EXISTS classificado_real;
