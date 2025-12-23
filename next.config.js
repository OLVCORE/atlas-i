/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.pluggy.ai https://*.pluggy.ai https://vercel.live; script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' https://connect.pluggy.ai https://*.pluggy.ai https://vercel.live; frame-src 'self' https://connect.pluggy.ai https://*.pluggy.ai; connect-src 'self' https://connect.pluggy.ai https://*.pluggy.ai https://api.pluggy.ai https://vydsayvhovuqfdelxtko.supabase.co https://*.supabase.co https://vercel.live; font-src 'self' data: https:;",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

