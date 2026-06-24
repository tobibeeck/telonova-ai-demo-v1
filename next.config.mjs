

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'better-sqlite3', '@google-cloud/vertexai'],
  },
}

export default nextConfig
