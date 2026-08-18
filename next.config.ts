import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Cada slide pode ter até 8 MB no validador da aplicação. O limite de
      // 10 MB deixa folga para o multipart/FormData sem liberar requests
      // gigantes. O editor envia uploads múltiplos uma imagem por requisição.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
