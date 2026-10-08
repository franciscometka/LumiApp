'use client';

import { DataSection } from './components/data-section';
import { PreferencesSection } from './components/preferences-section';
import { useSettings } from './use-settings';

/** Ajustes: preferencias e dados. Nada alem disso na v1. */
export function SettingsView() {
  const { data, isPending, isError, refetch } = useSettings();

  return (
    <div className="grid gap-4">
      {isPending ? (
        <div className="bg-card h-56 animate-pulse rounded-xl border" aria-busy="true" />
      ) : isError ? (
        <div className="bg-card rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar as preferências.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-primary mt-2 font-medium hover:underline"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <PreferencesSection settings={data} />
      )}

      <DataSection />
    </div>
  );
}
