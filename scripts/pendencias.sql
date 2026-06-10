-- Pendências de palpites por participante
-- Cole e execute no SQL Editor do Supabase

WITH deadline AS (
  SELECT '2026-06-11T15:00:00-03:00'::timestamptz AS fase1
),

-- Jogos que ainda aceitam palpite
jogos_abertos AS (
  SELECT g.id, g.fase, g.grupo, g.rodada, g.time_casa, g.time_fora, g.data_hora
  FROM games g, deadline d
  WHERE
    (g.fase = 'grupos' AND NOW() < d.fase1)
    OR
    (g.fase <> 'grupos' AND NOW() < g.data_hora)
),

-- Jogos faltando por usuário
jogos_faltando AS (
  SELECT
    p.id AS user_id,
    p.nome,
    COUNT(ja.id) AS qtd_jogos_faltando,
    STRING_AGG(
      ja.time_casa || ' x ' || ja.time_fora
      || ' (' || COALESCE('Grupo ' || ja.grupo || ' R' || ja.rodada::text, UPPER(ja.fase)) || ')',
      E'\n      • ' ORDER BY ja.data_hora
    ) AS jogos
  FROM profiles p
  CROSS JOIN jogos_abertos ja
  LEFT JOIN predictions pr ON pr.user_id = p.id AND pr.game_id = ja.id
  WHERE p.status = 'approved'
    AND pr.id IS NULL
  GROUP BY p.id, p.nome
),

-- Especiais faltando (só antes do deadline)
especiais_faltando AS (
  SELECT
    p.id AS user_id,
    p.nome,
    (CASE WHEN cp.id IS NULL THEN 1 ELSE 0 END
     + CASE WHEN sp_art.id IS NULL THEN 1 ELSE 0 END
     + CASE WHEN sp_mv.id IS NULL THEN 1 ELSE 0 END) AS qtd_especiais_faltando,
    TRIM(BOTH ', ' FROM
      CONCAT_WS(', ',
        CASE WHEN cp.id IS NULL THEN 'Campeão' END,
        CASE WHEN sp_art.id IS NULL THEN 'Artilheiro' END,
        CASE WHEN sp_mv.id IS NULL THEN 'Melhor Jogador' END
      )
    ) AS especiais
  FROM profiles p
  CROSS JOIN deadline d
  LEFT JOIN champion_predictions cp ON cp.user_id = p.id
  LEFT JOIN special_predictions sp_art ON sp_art.user_id = p.id AND sp_art.tipo = 'artilheiro'
  LEFT JOIN special_predictions sp_mv  ON sp_mv.user_id  = p.id AND sp_mv.tipo  = 'melhor_jogador'
  WHERE p.status = 'approved'
    AND NOW() < d.fase1
)

SELECT
  u.nome                                              AS "Participante",
  COALESCE(jf.qtd_jogos_faltando, 0)                 AS "Jogos faltando",
  COALESCE(ef.qtd_especiais_faltando, 0)             AS "Especiais faltando",
  COALESCE(jf.qtd_jogos_faltando, 0)
    + COALESCE(ef.qtd_especiais_faltando, 0)          AS "Total pendências",
  COALESCE(ef.especiais, '—')                         AS "Especiais",
  COALESCE('• ' || jf.jogos, '—')                    AS "Jogos"
FROM profiles u
LEFT JOIN jogos_faltando  jf ON jf.user_id = u.id
LEFT JOIN especiais_faltando ef ON ef.user_id = u.id
WHERE u.status = 'approved'
  AND (
    COALESCE(jf.qtd_jogos_faltando, 0) > 0
    OR COALESCE(ef.qtd_especiais_faltando, 0) > 0
  )
ORDER BY "Total pendências" DESC, u.nome;
