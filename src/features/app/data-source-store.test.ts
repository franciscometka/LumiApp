import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalStack } from '@/data/adapters/local/local-data-source';
import { createMemoryStorageDriver } from '@/data/adapters/local/storage-driver';
import { setLocalStack } from '@/data/provider';

import {
  getBootState,
  resetInitialization,
  startInitialization,
  subscribe,
} from './data-source-store';

afterEach(() => {
  resetInitialization();
  vi.unstubAllGlobals();
});

/** Faz o provider enxergar um ambiente de cliente com storage em memoria. */
function simulateClient(): void {
  vi.stubGlobal('window', {});
  setLocalStack(createLocalStack({ driver: createMemoryStorageDriver(), key: 'finan:test' }));
}

describe('estados de inicializacao', () => {
  it('comeca inicializando', () => {
    expect(getBootState().status).toBe('initializing');
  });

  it('chega a pronto quando o storage abre', () => {
    simulateClient();
    startInitialization();

    expect(getBootState().status).toBe('ready');
  });

  it('erro de storage vira estado controlado, nao excecao', () => {
    // Sem `window`: e exatamente o que acontece no servidor.
    startInitialization();

    const state = getBootState();
    expect(state.status).toBe('error');
    if (state.status !== 'error') return;
    expect(state.error.code).toBe('storage_unavailable');
  });
});

describe('inicializacao unica', () => {
  it('nao reinicializa em chamadas repetidas', () => {
    simulateClient();

    startInitialization();
    const primeiro = getBootState();

    startInitialization();
    startInitialization();

    // Mesma instancia: nenhuma reinicializacao aconteceu.
    expect(getBootState()).toBe(primeiro);
  });

  it('notifica os assinantes uma unica vez', () => {
    simulateClient();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    startInitialization();
    startInitialization();
    startInitialization();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('sobrevive ao duplo efeito do StrictMode', () => {
    simulateClient();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    // StrictMode monta, desmonta e monta de novo em desenvolvimento.
    startInitialization();
    unsubscribe();
    const segundo = subscribe(listener);
    startInitialization();

    expect(listener).toHaveBeenCalledTimes(1);
    segundo();
  });

  it('para de notificar apos cancelar a assinatura', () => {
    simulateClient();
    const listener = vi.fn();
    subscribe(listener)();

    startInitialization();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('snapshot estavel', () => {
  it('devolve a mesma referencia enquanto nada muda', () => {
    // `useSyncExternalStore` compara por identidade: um objeto novo a cada
    // chamada causaria re-render infinito.
    expect(getBootState()).toBe(getBootState());

    simulateClient();
    startInitialization();
    expect(getBootState()).toBe(getBootState());
  });
});
