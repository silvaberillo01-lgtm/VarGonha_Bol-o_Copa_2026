-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users profile table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE public.games (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fase TEXT NOT NULL DEFAULT 'grupos' CHECK (fase IN ('grupos', 'fase32', 'oitavas', 'quartas', 'semis', 'terceiro', 'final')),
  grupo TEXT,
  rodada INTEGER,
  data_hora TIMESTAMPTZ NOT NULL,
  time_casa TEXT NOT NULL,
  time_fora TEXT NOT NULL,
  bandeira_casa TEXT,
  bandeira_fora TEXT,
  gols_casa_real INTEGER,
  gols_fora_real INTEGER,
  resultado_lancado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions table
CREATE TABLE public.predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  gols_casa INTEGER NOT NULL CHECK (gols_casa >= 0),
  gols_fora INTEGER NOT NULL CHECK (gols_fora >= 0),
  pontos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Champion prediction table
CREATE TABLE public.champion_predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  selecao TEXT NOT NULL,
  pontos INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Special predictions table (artilheiro / melhor jogador)
-- Avaliação MANUAL pelo admin: a coluna "acertou" guarda a decisão (NULL = ainda não avaliado).
CREATE TABLE public.special_predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('artilheiro', 'melhor_jogador')),
  palpite TEXT NOT NULL,
  pontos INTEGER DEFAULT 0,
  acertou BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tipo)
);

-- Generic config store (campeão oficial, pontuação dos especiais, lista de jogadores, etc.)
CREATE TABLE public.copa_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.champion_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copa_config ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view approved profiles and own profile"
  ON public.profiles FOR SELECT
  USING (status = 'approved' OR auth.uid() = id OR EXISTS(
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (EXISTS(
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Games policies
CREATE POLICY "Anyone authenticated can view games"
  ON public.games FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can insert/update games"
  ON public.games FOR ALL
  USING (EXISTS(
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ));

-- Predictions policies
CREATE POLICY "Approved users can view all predictions"
  ON public.predictions FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (status = 'approved' OR is_admin = TRUE))
  );

CREATE POLICY "Users can insert own predictions"
  ON public.predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Users can update own predictions"
  ON public.predictions FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Champion predictions policies
CREATE POLICY "Users can view all champion predictions"
  ON public.champion_predictions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own champion prediction"
  ON public.champion_predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Users can update own champion prediction"
  ON public.champion_predictions FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Special predictions policies
CREATE POLICY "Authenticated users can view all special predictions"
  ON public.special_predictions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own special prediction"
  ON public.special_predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

CREATE POLICY "Users can update own special prediction"
  ON public.special_predictions FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS(SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'approved')
  );

-- Copa config policies (leitura para autenticados; escrita feita via service role no backend)
CREATE POLICY "Authenticated users can view config"
  ON public.copa_config FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed Copa 2026 group stage games
-- Groups: A through L (12 groups, 4 teams each, 6 games per group = 72 games total)
-- Copa 2026 starts June 11, 2026

INSERT INTO public.games (fase, grupo, rodada, data_hora, time_casa, time_fora, bandeira_casa, bandeira_fora) VALUES
-- GROUP A: Mexico, Jamaica, Venezuela, Ecuador
('grupos', 'A', 1, '2026-06-11 20:00:00-03', 'México', 'Jamaica', '🇲🇽', '🇯🇲'),
('grupos', 'A', 1, '2026-06-12 17:00:00-03', 'Venezuela', 'Equador', '🇻🇪', '🇪🇨'),
('grupos', 'A', 2, '2026-06-16 20:00:00-03', 'México', 'Venezuela', '🇲🇽', '🇻🇪'),
('grupos', 'A', 2, '2026-06-16 17:00:00-03', 'Jamaica', 'Equador', '🇯🇲', '🇪🇨'),
('grupos', 'A', 3, '2026-06-20 20:00:00-03', 'México', 'Equador', '🇲🇽', '🇪🇨'),
('grupos', 'A', 3, '2026-06-20 20:00:00-03', 'Jamaica', 'Venezuela', '🇯🇲', '🇻🇪'),

-- GROUP B: USA, Panama, Costa Rica, Honduras
('grupos', 'B', 1, '2026-06-12 21:00:00-03', 'EUA', 'Panamá', '🇺🇸', '🇵🇦'),
('grupos', 'B', 1, '2026-06-12 14:00:00-03', 'Costa Rica', 'Honduras', '🇨🇷', '🇭🇳'),
('grupos', 'B', 2, '2026-06-17 21:00:00-03', 'EUA', 'Costa Rica', '🇺🇸', '🇨🇷'),
('grupos', 'B', 2, '2026-06-17 18:00:00-03', 'Panamá', 'Honduras', '🇵🇦', '🇭🇳'),
('grupos', 'B', 3, '2026-06-21 21:00:00-03', 'EUA', 'Honduras', '🇺🇸', '🇭🇳'),
('grupos', 'B', 3, '2026-06-21 21:00:00-03', 'Panamá', 'Costa Rica', '🇵🇦', '🇨🇷'),

-- GROUP C: Canada, Uruguay, Algeria, Trinidad e Tobago
('grupos', 'C', 1, '2026-06-13 18:00:00-03', 'Canadá', 'Uruguai', '🇨🇦', '🇺🇾'),
('grupos', 'C', 1, '2026-06-13 15:00:00-03', 'Argélia', 'Trinidad e Tobago', '🇩🇿', '🇹🇹'),
('grupos', 'C', 2, '2026-06-18 18:00:00-03', 'Canadá', 'Argélia', '🇨🇦', '🇩🇿'),
('grupos', 'C', 2, '2026-06-18 15:00:00-03', 'Uruguai', 'Trinidad e Tobago', '🇺🇾', '🇹🇹'),
('grupos', 'C', 3, '2026-06-22 18:00:00-03', 'Canadá', 'Trinidad e Tobago', '🇨🇦', '🇹🇹'),
('grupos', 'C', 3, '2026-06-22 18:00:00-03', 'Uruguai', 'Argélia', '🇺🇾', '🇩🇿'),

-- GROUP D: Argentina, Chile, Japan, South Africa
('grupos', 'D', 1, '2026-06-14 21:00:00-03', 'Argentina', 'Chile', '🇦🇷', '🇨🇱'),
('grupos', 'D', 1, '2026-06-14 18:00:00-03', 'Japão', 'África do Sul', '🇯🇵', '🇿🇦'),
('grupos', 'D', 2, '2026-06-19 21:00:00-03', 'Argentina', 'Japão', '🇦🇷', '🇯🇵'),
('grupos', 'D', 2, '2026-06-19 18:00:00-03', 'Chile', 'África do Sul', '🇨🇱', '🇿🇦'),
('grupos', 'D', 3, '2026-06-23 21:00:00-03', 'Argentina', 'África do Sul', '🇦🇷', '🇿🇦'),
('grupos', 'D', 3, '2026-06-23 21:00:00-03', 'Chile', 'Japão', '🇨🇱', '🇯🇵'),

-- GROUP E: Brazil, Colombia, Serbia, New Zealand
('grupos', 'E', 1, '2026-06-13 21:00:00-03', 'Brasil', 'Colômbia', '🇧🇷', '🇨🇴'),
('grupos', 'E', 1, '2026-06-13 12:00:00-03', 'Sérvia', 'Nova Zelândia', '🇷🇸', '🇳🇿'),
('grupos', 'E', 2, '2026-06-18 21:00:00-03', 'Brasil', 'Sérvia', '🇧🇷', '🇷🇸'),
('grupos', 'E', 2, '2026-06-18 12:00:00-03', 'Colômbia', 'Nova Zelândia', '🇨🇴', '🇳🇿'),
('grupos', 'E', 3, '2026-06-22 21:00:00-03', 'Brasil', 'Nova Zelândia', '🇧🇷', '🇳🇿'),
('grupos', 'E', 3, '2026-06-22 21:00:00-03', 'Colômbia', 'Sérvia', '🇨🇴', '🇷🇸'),

-- GROUP F: England, Morocco, Turkey, Iran
('grupos', 'F', 1, '2026-06-14 12:00:00-03', 'Inglaterra', 'Marrocos', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇲🇦'),
('grupos', 'F', 1, '2026-06-14 15:00:00-03', 'Turquia', 'Irã', '🇹🇷', '🇮🇷'),
('grupos', 'F', 2, '2026-06-19 12:00:00-03', 'Inglaterra', 'Turquia', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇹🇷'),
('grupos', 'F', 2, '2026-06-19 15:00:00-03', 'Marrocos', 'Irã', '🇲🇦', '🇮🇷'),
('grupos', 'F', 3, '2026-06-23 15:00:00-03', 'Inglaterra', 'Irã', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇮🇷'),
('grupos', 'F', 3, '2026-06-23 15:00:00-03', 'Marrocos', 'Turquia', '🇲🇦', '🇹🇷'),

-- GROUP G: France, Nigeria, Australia, Ivory Coast
('grupos', 'G', 1, '2026-06-15 18:00:00-03', 'França', 'Nigéria', '🇫🇷', '🇳🇬'),
('grupos', 'G', 1, '2026-06-15 15:00:00-03', 'Austrália', 'Costa do Marfim', '🇦🇺', '🇨🇮'),
('grupos', 'G', 2, '2026-06-20 18:00:00-03', 'França', 'Austrália', '🇫🇷', '🇦🇺'),
('grupos', 'G', 2, '2026-06-20 15:00:00-03', 'Nigéria', 'Costa do Marfim', '🇳🇬', '🇨🇮'),
('grupos', 'G', 3, '2026-06-24 18:00:00-03', 'França', 'Costa do Marfim', '🇫🇷', '🇨🇮'),
('grupos', 'G', 3, '2026-06-24 18:00:00-03', 'Nigéria', 'Austrália', '🇳🇬', '🇦🇺'),

-- GROUP H: Germany, Portugal, Saudi Arabia, Ukraine
('grupos', 'H', 1, '2026-06-15 21:00:00-03', 'Alemanha', 'Portugal', '🇩🇪', '🇵🇹'),
('grupos', 'H', 1, '2026-06-15 12:00:00-03', 'Arábia Saudita', 'Ucrânia', '🇸🇦', '🇺🇦'),
('grupos', 'H', 2, '2026-06-20 21:00:00-03', 'Alemanha', 'Arábia Saudita', '🇩🇪', '🇸🇦'),
('grupos', 'H', 2, '2026-06-20 12:00:00-03', 'Portugal', 'Ucrânia', '🇵🇹', '🇺🇦'),
('grupos', 'H', 3, '2026-06-24 21:00:00-03', 'Alemanha', 'Ucrânia', '🇩🇪', '🇺🇦'),
('grupos', 'H', 3, '2026-06-24 21:00:00-03', 'Portugal', 'Arábia Saudita', '🇵🇹', '🇸🇦'),

-- GROUP I: Spain, Netherlands, South Korea, Egypt
('grupos', 'I', 1, '2026-06-16 21:00:00-03', 'Espanha', 'Países Baixos', '🇪🇸', '🇳🇱'),
('grupos', 'I', 1, '2026-06-16 18:00:00-03', 'Coreia do Sul', 'Egito', '🇰🇷', '🇪🇬'),
('grupos', 'I', 2, '2026-06-21 21:00:00-03', 'Espanha', 'Coreia do Sul', '🇪🇸', '🇰🇷'),
('grupos', 'I', 2, '2026-06-21 18:00:00-03', 'Países Baixos', 'Egito', '🇳🇱', '🇪🇬'),
('grupos', 'I', 3, '2026-06-25 21:00:00-03', 'Espanha', 'Egito', '🇪🇸', '🇪🇬'),
('grupos', 'I', 3, '2026-06-25 21:00:00-03', 'Países Baixos', 'Coreia do Sul', '🇳🇱', '🇰🇷'),

-- GROUP J: Belgium, Italy, Cameroon, Tunisia
('grupos', 'J', 1, '2026-06-17 21:00:00-03', 'Bélgica', 'Itália', '🇧🇪', '🇮🇹'),
('grupos', 'J', 1, '2026-06-17 12:00:00-03', 'Camarões', 'Tunísia', '🇨🇲', '🇹🇳'),
('grupos', 'J', 2, '2026-06-22 21:00:00-03', 'Bélgica', 'Camarões', '🇧🇪', '🇨🇲'),
('grupos', 'J', 2, '2026-06-22 12:00:00-03', 'Itália', 'Tunísia', '🇮🇹', '🇹🇳'),
('grupos', 'J', 3, '2026-06-26 21:00:00-03', 'Bélgica', 'Tunísia', '🇧🇪', '🇹🇳'),
('grupos', 'J', 3, '2026-06-26 21:00:00-03', 'Itália', 'Camarões', '🇮🇹', '🇨🇲'),

-- GROUP K: Croatia, Denmark, Iraq, Bolivia
('grupos', 'K', 1, '2026-06-16 12:00:00-03', 'Croácia', 'Dinamarca', '🇭🇷', '🇩🇰'),
('grupos', 'K', 1, '2026-06-16 15:00:00-03', 'Iraque', 'Bolívia', '🇮🇶', '🇧🇴'),
('grupos', 'K', 2, '2026-06-21 12:00:00-03', 'Croácia', 'Iraque', '🇭🇷', '🇮🇶'),
('grupos', 'K', 2, '2026-06-21 15:00:00-03', 'Dinamarca', 'Bolívia', '🇩🇰', '🇧🇴'),
('grupos', 'K', 3, '2026-06-25 15:00:00-03', 'Croácia', 'Bolívia', '🇭🇷', '🇧🇴'),
('grupos', 'K', 3, '2026-06-25 15:00:00-03', 'Dinamarca', 'Iraque', '🇩🇰', '🇮🇶'),

-- GROUP L: Switzerland, Austria, Paraguay, Indonesia
('grupos', 'L', 1, '2026-06-17 15:00:00-03', 'Suíça', 'Áustria', '🇨🇭', '🇦🇹'),
('grupos', 'L', 1, '2026-06-17 18:00:00-03', 'Paraguai', 'Indonésia', '🇵🇾', '🇮🇩'),
('grupos', 'L', 2, '2026-06-22 15:00:00-03', 'Suíça', 'Paraguai', '🇨🇭', '🇵🇾'),
('grupos', 'L', 2, '2026-06-22 18:00:00-03', 'Áustria', 'Indonésia', '🇦🇹', '🇮🇩'),
('grupos', 'L', 3, '2026-06-26 18:00:00-03', 'Suíça', 'Indonésia', '🇨🇭', '🇮🇩'),
('grupos', 'L', 3, '2026-06-26 18:00:00-03', 'Áustria', 'Paraguai', '🇦🇹', '🇵🇾');
