'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';

/**
 * Qual icone aparece e decidido por CSS a partir da classe `dark` no <html>,
 * nao por estado do React. Isso evita divergencia de hidratacao sem precisar
 * de um guard `mounted` (que renderiza um frame vazio e custa um re-render).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar entre tema claro e escuro"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="text-muted-foreground hover:text-foreground"
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
