-- Adiciona colunas para o placar dos pênaltis no mata-mata.
-- gols_casa_real / gols_fora_real continuam sendo o placar do tempo normal (90 min + prorrogação).
-- Quando o jogo vai a pênaltis, o resultado da disputa fica aqui.
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS gols_penaltis_casa INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gols_penaltis_fora INTEGER DEFAULT NULL;
