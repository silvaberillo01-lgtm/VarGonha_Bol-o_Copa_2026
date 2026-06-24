// Fonte única de verdade das seleções da Copa 2026 + normalização de nomes.
//
// PROBLEMA: nomes de seleção são comparados como texto em vários pontos
// (pontuação do mata-mata, motor de chaveamento, palpite de campeão). Se a
// grafia divergir entre o que o admin lança e o que vem dos grupos (ex.:
// "Curaçao"/"Curaçau", "Holanda"/"Países Baixos", "EUA"/"Estados Unidos"),
// a comparação falha SILENCIOSAMENTE e o palpite deixa de pontuar.
//
// SOLUÇÃO: `SELECOES` é a lista canônica (usada nos dropdowns) e
// `normalizeTeam()` converte qualquer variante/alias/acentuação para a forma
// canônica. Use na ESCRITA (trava: grava sempre canônico) e na COMPARAÇÃO
// (defende dados já gravados com grafia antiga).

// 48 seleções — grafia canônica (rótulos exibidos nos dropdowns).
export const SELECOES: string[] = [
  'África do Sul', 'Alemanha', 'Arábia Saudita', 'Argentina', 'Argélia',
  'Austrália', 'Áustria', 'Bélgica', 'Bósnia e Herzegovina', 'Brasil',
  'Cabo Verde', 'Canadá', 'Catar', 'Colômbia', 'Coreia do Sul',
  'Costa do Marfim', 'Croácia', 'Curaçao', 'Egito', 'Equador',
  'Escócia', 'Espanha', 'Estados Unidos', 'França', 'Gana',
  'Haiti', 'Holanda', 'Inglaterra', 'Irã', 'Iraque',
  'Japão', 'Jordânia', 'Marrocos', 'México', 'Noruega',
  'Nova Zelândia', 'Panamá', 'Paraguai', 'Portugal', 'RD do Congo',
  'República Tcheca', 'Senegal', 'Suécia', 'Suíça', 'Tunísia',
  'Turquia', 'Uruguai', 'Uzbequistão',
].slice().sort((a, b) => a.localeCompare(b, 'pt-BR'))

// Aliases conhecidos -> nome canônico. A comparação é feita por "fold"
// (minúsculas, sem acentos, só alfanumérico), então NÃO é preciso listar
// variações de acento/maiúscula aqui — apenas grafias realmente diferentes.
const ALIASES: Record<string, string> = {
  'Curaçau': 'Curaçao',
  'Países Baixos': 'Holanda',
  'Netherlands': 'Holanda',
  'EUA': 'Estados Unidos',
  'USA': 'Estados Unidos',
  'Estados Unidos da América': 'Estados Unidos',
  'Tchéquia': 'República Tcheca',
  'Chéquia': 'República Tcheca',
  'República Checa': 'República Tcheca',
  'Czechia': 'República Tcheca',
  'Czech Republic': 'República Tcheca',
  'RD Congo': 'RD do Congo',
  'República Democrática do Congo': 'RD do Congo',
  'Congo': 'RD do Congo',
  'DR Congo': 'RD do Congo',
  'República da Coreia': 'Coreia do Sul',
  'Coreia': 'Coreia do Sul',
  'Korea Republic': 'Coreia do Sul',
  'South Korea': 'Coreia do Sul',
  'RI do Irã': 'Irã',
  'Iran': 'Irã',
  'Bósnia': 'Bósnia e Herzegovina',
  'Bosnia': 'Bósnia e Herzegovina',
}

// "fold": remove acentos, baixa caixa e tira tudo que não for alfanumérico.
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Índice fold -> canônico (canônicos + aliases). Construído uma vez.
const CANON_BY_FOLD: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const t of SELECOES) m.set(fold(t), t)
  for (const [alias, canon] of Object.entries(ALIASES)) m.set(fold(alias), canon)
  return m
})()

// Converte um nome para a forma canônica. Se não reconhecer, devolve o texto
// "trimado" (preserva placeholders de slot como "1A"/"3ABCDF"/"W74"). Vazio/nulo -> null.
export function normalizeTeam(raw?: string | null): string | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  return CANON_BY_FOLD.get(fold(trimmed)) ?? trimmed
}

// True se o texto corresponde a uma das 48 seleções oficiais (após normalizar).
export function isSelecao(raw?: string | null): boolean {
  if (raw == null) return false
  return CANON_BY_FOLD.has(fold(String(raw)))
}
