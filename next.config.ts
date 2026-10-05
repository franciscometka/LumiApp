import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera tipos para as rotas: links quebrados viram erro de typecheck.
  typedRoutes: true,
};

export default nextConfig;
