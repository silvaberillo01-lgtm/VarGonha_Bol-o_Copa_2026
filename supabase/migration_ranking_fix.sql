-- ============================================================================
-- Migração — Ranking agregado no banco (corrige contagem errada de palpites)
--
-- Problema: a página de ranking puxava TODAS as linhas de "predictions" via
-- PostgREST, que tem teto padrão de 1000 linhas. Com muitos participantes o
-- total passa de 1000, a API trunca e alguns usuários aparecem com menos
-- palpites/pontos do que realmente têm (ex.: Pedro aparecia com 6 de 71).
--
-- Solução: agregar no banco e devolver 1 linha por participante.
-- Pode rodar mais de uma vez sem problema.
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- ============================================================================

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

-- Conferência rápida: deve listar todos os participantes com a contagem REAL.
-- select * from public.get_ranking();
