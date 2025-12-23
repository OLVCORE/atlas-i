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
            value: [
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://connect.pluggy.ai https://*.pluggy.ai",
              "frame-src 'self' https://connect.pluggy.ai https://*.pluggy.ai",
              "connect-src 'self' https://connect.pluggy.ai https://*.pluggy.ai https://api.pluggy.ai",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

