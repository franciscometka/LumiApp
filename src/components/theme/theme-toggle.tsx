'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { useUpdateSettings } from '@/features/settings/use-settings';

/**
 * Atalho de tema. A preferencia de verdade mora em Ajustes (\`UserSettings\`);
 * este botao grava no mesmo lugar, entao os dois nunca discordam.
 *
 * O tema muda na hora (\`setTheme\`) e a gravacao vem em seguida: esperar o
 * banco para trocar a cor deixaria o clique com cara de travado.
 *
 * Qual icone aparece e decidido por CSS a partir da classe \`dark\` no <html>,
 * nao por estado do React. Isso evita divergencia de hidratacao sem precisar
 * de um guard \`mounted\` (que renderiza um frame vazio e custa um re-render).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const updateSettings = useUpdateSettings();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar entre tema claro e escuro"
      onClick={() => {
        const next = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        updateSettings.mutate({ theme: next });
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
