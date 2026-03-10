/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['postgres'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
