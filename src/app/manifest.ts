import type { MetadataRoute } from 'next';

import { BRAND_DESCRIPTION, BRAND_NAME } from '@/components/brand/brand';

/**
 * Manifest do PWA. As cores sao o fundo do icone (o fundo do tema escuro), para
 * que a tela de abertura no celular emende no icone sem flash. Os PNGs saem de
 * scripts/brand/render-icons.mjs.
 */
const NIGHT = '#0e0e12';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: NIGHT,
    theme_color: NIGHT,
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
