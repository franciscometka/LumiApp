'use client';

import { Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import type { ThemePreference, UserSettings } from '@/domain/entities/user-settings';
import { cn } from '@/lib/utils';

import { parseSalaryDay } from '../settings-form';
import { useUpdateSettings } from '../use-settings';

const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

/**
 * Preferencias: dia do salario e tema.
 *
 * O tema grava no ato (e uma escolha visual, sem "salvar"). O dia do salario
 * tem botao proprio: e um numero digitado, e gravar a cada tecla salvaria
 * valores intermediarios como "3" a caminho de "30".
 */
export function PreferencesSection({ settings }: { settings: UserSettings }) {
  const fieldId = useId();
  const { setTheme } = useTheme();
  const updateSettings = useUpdateSettings();

  const [salaryDay, setSalaryDay] = useState(String(settings.salaryDay));
  const [salaryError, setSalaryError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  // O valor gravado pode mudar por fora — importar um backup, por exemplo.
  // Quando muda, o campo acompanha. Ajuste durante o render, sem efeito.
  const [seenDay, setSeenDay] = useState(settings.salaryDay);
  if (settings.salaryDay !== seenDay) {
    setSeenDay(settings.salaryDay);
    setSalaryDay(String(settings.salaryDay));
  }

  const parsedDay = parseSalaryDay(salaryDay);
  const dayChanged = parsedDay !== settings.salaryDay;

  const saveSalaryDay = (event: React.FormEvent) => {
    event.preventDefault();
    if (parsedDay === null) {
      setSalaryError('Use um dia entre 1 e 31.');
      return;
    }
    updateSettings.mutate(
      { salaryDay: parsedDay },
      {
        onSuccess: () => {
          setSaved(true);
        },
      },
    );
  };

  const chooseTheme = (theme: ThemePreference) => {
    setTheme(theme);
    updateSettings.mutate({ theme });
  };

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Preferências
      </h2>

      <form onSubmit={saveSalaryDay} className="mt-4" noValidate>
        <Field
          label="Dia do salário"
          htmlFor={`${fieldId}-salary`}
          error={salaryError}
          hint="Dia do mês em que o salário costuma cair. Dia 31 vira o último dia nos meses curtos."
        >
          <div className="flex gap-2">
            <Input
              id={`${fieldId}-salary`}
              inputMode="numeric"
              value={salaryDay}
              aria-invalid={salaryError === undefined ? undefined : true}
              onChange={(event) => {
                setSalaryDay(event.target.value);
                setSalaryError(undefined);
                setSaved(false);
              }}
              className="w-24"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!dayChanged || updateSettings.isPending}
              className="shrink-0"
            >
              {updateSettings.isPending && updateSettings.variables?.salaryDay !== undefined ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Salvar
            </Button>
          </div>
        </Field>
        {saved && !dayChanged ? (
          <p role="status" className="text-muted-foreground mt-1.5 text-xs">
            Dia do salário salvo.
          </p>
        ) : null}
      </form>

      <div className="mt-5">
        <p id={`${fieldId}-theme`} className="text-sm font-medium">
          Tema
        </p>
        <div
          role="group"
          aria-labelledby={`${fieldId}-theme`}
          className="bg-muted/60 mt-1.5 grid grid-cols-3 gap-1 rounded-lg p-1 sm:w-80"
        >
          {THEME_OPTIONS.map((option) => {
            const selected = settings.theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  chooseTheme(option.value);
                }}
                className={cn(
                  'min-h-9 rounded-md text-sm transition-colors',
                  selected
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">
          O botão de tema no topo é um atalho para esta mesma preferência.
        </p>
      </div>

      {updateSettings.isError ? (
        <p
          role="alert"
          className="bg-expense-surface text-expense mt-4 rounded-lg px-3 py-2.5 text-sm"
        >
          Não foi possível salvar a preferência. Nada foi alterado.
        </p>
      ) : null}
    </section>
  );
}
