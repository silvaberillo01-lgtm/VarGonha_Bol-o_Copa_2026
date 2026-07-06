-- ============================================================================
-- Migração — Corrige datas erradas do mata-mata (oitavas e quartas)
--
-- Problema: no seed de supabase/migration_mata_mata.sql, o horário (hora:min)
-- de cada confronto está certo, mas o DIA de 6 jogos foi digitado errado
-- (provável erro de transcrição). Conferido contra o calendário oficial FIFA:
--
--   M93  (Portugal x Espanha)        07/07 16:00 -> deveria ser 06/07 16:00
--   M95  (Argentina x Egito)         06/07 13:00 -> deveria ser 07/07 13:00
--   M97  (quartas, vencedor M89/M90) 10/07 17:00 -> deveria ser 09/07 17:00
--   M98  (quartas, vencedor M93/M94) 11/07 16:00 -> deveria ser 10/07 16:00
--   M99  (quartas, vencedor M91/M92) 09/07 18:00 -> deveria ser 11/07 18:00
--   M100 (quartas, vencedor M95/M96) 10/07 22:00 -> deveria ser 11/07 22:00
--
-- Os demais jogos (M89, M90, M91, M92, M94, M96, semis, terceiro e final)
-- já conferem com o calendário oficial e não são alterados.
--
-- SEGURANÇA:
--   • IDEMPOTENTE — cada UPDATE só roda se a data ainda estiver com o valor
--     errado original; se o admin já corrigiu manualmente (ou rodar de novo),
--     não faz nada.
--   • Não mexe em resultado_lancado nem em nenhum outro dado do confronto.
--
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- ============================================================================

UPDATE public.games SET data_hora = '2026-07-06 16:00:00-03'::timestamptz
  WHERE match_code = 'M93' AND data_hora = '2026-07-07 16:00:00-03'::timestamptz;

UPDATE public.games SET data_hora = '2026-07-07 13:00:00-03'::timestamptz
  WHERE match_code = 'M95' AND data_hora = '2026-07-06 13:00:00-03'::timestamptz;

UPDATE public.games SET data_hora = '2026-07-09 17:00:00-03'::timestamptz
  WHERE match_code = 'M97' AND data_hora = '2026-07-10 17:00:00-03'::timestamptz;

UPDATE public.games SET data_hora = '2026-07-10 16:00:00-03'::timestamptz
  WHERE match_code = 'M98' AND data_hora = '2026-07-11 16:00:00-03'::timestamptz;

UPDATE public.games SET data_hora = '2026-07-11 18:00:00-03'::timestamptz
  WHERE match_code = 'M99' AND data_hora = '2026-07-09 18:00:00-03'::timestamptz;

UPDATE public.games SET data_hora = '2026-07-11 22:00:00-03'::timestamptz
  WHERE match_code = 'M100' AND data_hora = '2026-07-10 22:00:00-03'::timestamptz;
