'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Tema vive no DOM (classe em <html>). A fonte de verdade e
 * `UserSettings.theme`; o localStorage do next-themes e so uma copia para
 * pintar a primeira tela antes de o banco abrir. Ver `ThemeSync`.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
