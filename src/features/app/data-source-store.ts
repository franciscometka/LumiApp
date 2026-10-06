'use client';

import { useEffect, useSyncExternalStore } from 'react';

import type { DataSource } from '@/data/ports/data-source';
import { DataError, isDataError } from '@/data/ports/errors';
import { initializeDataSource, resetDataSource } from '@/data/provider';

/**
 * Estados de inicializacao da persistencia.
 *
 * O AppShell precisa distinguir os tres, e cada um tem uma tela propria:
 * `initializing` segura a renderizacao, `ready` libera as queries, `error`
 * mostra um estado controlado em vez de uma tela branca.
 */
export type BootState =
  | { readonly status: 'initializing' }
  | { readonly status: 'ready'; readonly dataSource: DataSource }
  | { readonly status: 'error'; readonly error: DataError };

/**
 * Referencia estavel.
 *
 * `useSyncExternalStore` compara snapshots por identidade: devolver um objeto
 * novo a cada chamada causaria re-render infinito. Esta constante serve de
 * estado inicial E de snapshot do servidor, o que tambem garante que o HTML
 * do SSR e o primeiro render do cliente sejam identicos.
 */
const INITIALIZING: BootState = { status: 'initializing' };

let state: BootState = INITIALIZING;
let hasStarted = false;
const listeners = new Set<() => void>();

function emit(next: BootState): void {
  state = next;
  for (const listener of listeners) listener();
}

/**
 * Inicializa a persistencia uma unica vez.
 *
 * A guarda `hasStarted` vive no modulo, nao no componente: sobrevive ao duplo
 * efeito do StrictMode, a remontagens e a dois componentes chamando ao mesmo
 * tempo. Chamadas seguintes retornam sem fazer nada.
 */
export function startInitialization(): void {
  if (hasStarted) return;
  hasStarted = true;

  try {
    emit({ status: 'ready', dataSource: initializeDataSource({ seed: true }) });
  } catch (cause) {
    emit({
      status: 'error',
      error: isDataError(cause)
        ? cause
        : new DataError('storage_unavailable', 'Falha ao iniciar o armazenamento local.', {
            cause,
          }),
    });
  }
}

/** Nova tentativa apos erro. Descarta a instancia anterior e reinicia do zero. */
export function retryInitialization(): void {
  resetDataSource();
  hasStarted = false;
  emit(INITIALIZING);
  startInitialization();
}

/** Volta ao estado de fabrica. Usado pelos testes. */
export function resetInitialization(): void {
  resetDataSource();
  hasStarted = false;
  emit(INITIALIZING);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBootState(): BootState {
  return state;
}

function getServerBootState(): BootState {
  return INITIALIZING;
}

/**
 * Estado atual da persistencia.
 *
 * A inicializacao e disparada por efeito, nunca durante o render: o render
 * precisa ser puro, e no servidor nao existe `localStorage`. Como o estado
 * vive fora do React, o efeito nao chama `setState` — apenas notifica a loja,
 * e o `useSyncExternalStore` cuida do re-render.
 */
export function useBootState(): BootState {
  const bootState = useSyncExternalStore(subscribe, getBootState, getServerBootState);

  useEffect(() => {
    startInitialization();
  }, []);

  return bootState;
}
