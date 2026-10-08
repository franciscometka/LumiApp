import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { BRAND_DESCRIPTION, BRAND_NAME } from '@/components/brand/brand';
import { ThemeProvider } from '@/components/theme/theme-provider';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  // Favicon, icon.svg, apple-icon.png e o manifest vem das convencoes de
  // arquivo de src/app/ (gerados por scripts/brand/).
  appleWebApp: { capable: true, title: BRAND_NAME },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Impede o zoom automatico do iOS ao focar inputs e libera a area segura
  // para a tab bar do lote 3.
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfdfe' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1d' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
