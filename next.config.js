/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "@sparticuz/chromium-min"],
  },
}

module.exports = nextConfig

