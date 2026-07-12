/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // O ranking (pontos ao vivo + chance de título/pódio) precisa refletir o
    // banco a cada carregamento. `dynamic = 'force-dynamic'` já evita cache
    // de rota no Next, mas isso reforça explicitamente pro Vercel/CDN nunca
    // guardar essa resposta em cache de borda — sem isso, um deploy novo
    // pode não aparecer na hora pra quem já tinha essa página em cache.
    return [
      {
        source: '/ranking',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
      {
        source: '/api/chances',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }],
      },
    ]
  },
}
module.exports = nextConfig
