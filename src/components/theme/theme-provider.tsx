'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * Tema vive no DOM (classe em <html>) e no localStorage do next-themes.
 * Quando existir UserSettings.theme (lote 2+), a preferencia persistida passa
 * a ser a fonte de verdade e este provider apenas a reflete.
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
