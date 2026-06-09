-- ============================================================================
-- Migração de correção — Bolão Copa 2026 (VarGonha)
-- Pode ser executada com segurança mais de uma vez (idempotente).
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Corrige as fases permitidas em games (32-avos e semifinal)
--    Código usa: grupos, fase32, oitavas, quartas, semis, terceiro, final
-- ----------------------------------------------------------------------------
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_fase_check;
ALTER TABLE public.games
  ADD CONSTRAINT games_fase_check
  CHECK (fase IN ('grupos', 'fase32', 'oitavas', 'quartas', 'semis', 'terceiro', 'final'));

-- ----------------------------------------------------------------------------
-- 2) Tabela de palpites especiais (artilheiro / melhor jogador)
--    Avaliação MANUAL: coluna "acertou" (NULL = ainda não avaliado).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.special_predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('artilheiro', 'melhor_jogador')),
  palpite TEXT NOT NULL,
  pontos INTEGER DEFAULT 0,
  acertou BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garante a coluna "acertou" caso a tabela já existisse sem ela
ALTER TABLE public.special_predictions ADD COLUMN IF NOT EXISTS acertou BOOLEAN;

-- Garante a constraint UNIQUE(user_id, tipo) usada pelo upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'special_predictions_user_id_tipo_key'
  ) THEN
    ALTER TABLE public.special_predictions
      ADD CONSTRAINT special_predictions_user_id_tipo_key UNIQUE (user_id, tipo);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3) Tabela de configuração (campeão oficial, pontuação dos especiais, lista)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.copa_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copa_config ENABLE ROW LEVEL SECURITY;

-- 4a) CORREÇÃO PRINCIPAL DO RANKING:
-- antes, cada usuário só conseguia LER os próprios palpites de placar,
-- então o ranking somava só os pontos de quem estava olhando.
DROP POLICY IF EXISTS
  "Users can view own predictions and approved users can view all after deadline"
  ON public.predictions;
DROP POLICY IF EXISTS "Approved users can view all predictions" ON public.predictions;
CREATE POLICY "Approved users can view all predictions"
  ON public.predictions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS(SELECT 1 FROM public.profiles
           WHERE id = auth.uid() AND (status = 'approved' OR is_admin = TRUE))
  );

-- 4b) Políticas de special_predictions
DROP POLICY IF EXISTS "Authenticated users can view all special predictions" ON public.special_predictions;
CREATE POLICY "Authenticated users can view all special predictions"
  ON public.special_predictions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own special prediction" ON public.special_predictions;
CREATE POLICY "Users can insert own special prediction"
  ON public.special_predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

DROP POLICY IF EXISTS "Users can update own special prediction" ON public.special_predictions;
CREATE POLICY "Users can update own special prediction"
  ON public.special_predictions FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- 4c) Política de leitura da config
DROP POLICY IF EXISTS "Authenticated users can view config" ON public.copa_config;
CREATE POLICY "Authenticated users can view config"
  ON public.copa_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- Fim. As escritas em copa_config e a marcação manual usam o service role
-- (rotas /api/admin/*), que ignora RLS — nenhuma política extra é necessária.
-- ============================================================================
