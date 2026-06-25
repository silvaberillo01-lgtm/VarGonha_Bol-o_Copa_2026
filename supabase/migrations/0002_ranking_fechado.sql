-- Ranking: posição relativa à última classificação FECHADA (setinhas ao vivo)
--
-- Recria get_ranking() adicionando a coluna total_pontos_fechado: a soma de
-- pontos considerando SOMENTE jogos já encerrados (resultado_lancado = true),
-- mais campeão e especiais (que não mudam durante uma partida).
--
-- O front compara a posição atual (com parciais ao vivo, total_pontos) com a
-- posição "fechada" (total_pontos_fechado) para desenhar as setas ↑/↓. Quando
-- não há jogo em andamento, os dois valores coincidem e nenhuma seta aparece.
--
-- Rodar no SQL Editor do Supabase (uma única vez).

-- A assinatura muda (coluna nova), então é preciso dropar antes de recriar.
DROP FUNCTION IF EXISTS public.get_ranking();

CREATE FUNCTION public.get_ranking()
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  total_pontos BIGINT,
  total_pontos_fechado BIGINT,
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
    (COALESCE(p.total_pontos_fechado, 0) + COALESCE(cp.pontos, 0) + COALESCE(sp.total_pontos, 0))::BIGINT AS total_pontos_fechado,
    COALESCE(p.exatos, 0)::BIGINT AS acertos_exatos,
    COALESCE(p.resultado, 0)::BIGINT AS acertos_resultado,
    COALESCE(p.parciais, 0)::BIGINT AS acertos_parciais,
    COALESCE(p.total_palpites, 0)::BIGINT AS total_palpites
  FROM public.profiles pr
  LEFT JOIN (
    SELECT pred.user_id,
      SUM(pred.pontos) AS total_pontos,
      SUM(pred.pontos) FILTER (WHERE g.resultado_lancado) AS total_pontos_fechado,
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
