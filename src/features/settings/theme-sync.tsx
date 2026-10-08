'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import { useSettings } from './use-settings';

/**
 * Alinha o tema exibido com a preferencia GRAVADA no banco.
 *
 * Uma fonte de verdade: \`UserSettings.theme\`. O \`next-themes\` guarda uma
 * copia no proprio localStorage so para pintar a primeira tela sem piscar,
 * antes de o banco abrir; quando as preferencias chegam, elas mandam. Assim
 * importar um backup traz o tema junto, e o atalho do cabecalho e a tela de
 * Ajustes nunca discordam.
 */
export function ThemeSync() {
  const { data } = useSettings();
  const { setTheme } = useTheme();
  const preferred = data?.theme;

  useEffect(() => {
    if (preferred !== undefined) setTheme(preferred);
  }, [preferred, setTheme]);

  return null;
}
