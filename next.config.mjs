/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['postgres', 'yaml'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
