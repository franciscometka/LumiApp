'use client';

import { useDatabaseStatus } from './use-database-status';

const STATE_LABELS: Record<string, string> = {
  empty: 'Sem dados ainda',
  ready: 'Tudo certo',
  corrupted: 'Dados com problema',
  unsupported_version: 'Versão incompatível',
};

/**
 * Cartao de diagnostico da persistencia.
 *
 * Primeira consulta real do app passando por TanStack Query. Fica aqui, em
 * "Mais", porque e informacao de manutencao — nao disputa espaco com o saldo
 * na tela inicial.
 *
 * Tambem cobre o terceiro caso que o AppShell nao alcanca: dados que abriram,
 * mas com registros recusados. O shell so distingue inicializando / pronto /
 * erro; "pronto com ressalvas" aparece aqui.
 */
export function PersistenceStatusCard() {
  const { data, isPending, isError } = useDatabaseStatus();

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Seus dados
      </h2>

      {isPending ? (
        <div className="bg-muted mt-3 h-5 w-32 animate-pulse rounded" />
      ) : isError || data === undefined ? (
        <p className="text-expense mt-3 text-sm">Não foi possível verificar.</p>
      ) : (
        <>
          <p className="mt-3 text-[15px] font-medium">
            {STATE_LABELS[data.state] ?? data.state}
          </p>

          <dl className="text-muted-foreground mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Registros</dt>
              <dd className="text-foreground tabular-nums">{data.recordCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Formato</dt>
              <dd className="text-foreground tabular-nums">
                v{data.schemaVersion ?? data.currentSchemaVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Armazenamento</dt>
              <dd className="text-foreground">Neste dispositivo</dd>
            </div>
          </dl>

          {data.issues.length > 0 ? (
            <p className="text-expense mt-4 text-sm">
              {data.issues.length} registro(s) não puderam ser lidos. Nada foi apagado.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
