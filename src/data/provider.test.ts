import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalStack } from './adapters/local/local-data-source';
import { createMemoryStorageDriver } from './adapters/local/storage-driver';
import { DataError } from './ports/errors';
import {
  initializeDataSource,
  isServerEnvironment,
  peekDataSource,
  resetDataSource,
  setLocalStack,
} from './provider';

afterEach(() => {
  resetDataSource();
  vi.unstubAllGlobals();
});

describe('seguranca em SSR', () => {
  it('reconhece o ambiente de servidor', () => {
    expect(isServerEnvironment()).toBe(true);
  });

  it('inicializar no servidor falha com erro claro, nao com crash obscuro', () => {
    try {
      initializeDataSource();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect((error as DataError).code).toBe('storage_unavailable');
      expect((error as DataError).message).toContain('Client Component');
    }
  });

  it('peekDataSource nao cria nada e nao lanca no servidor', () => {
    expect(peekDataSource()).toBeNull();
  });
});

describe('ciclo de vida', () => {
  it('reaproveita a mesma instancia entre chamadas', () => {
    const stack = createLocalStack({
      driver: createMemoryStorageDriver(),
      key: 'finan:test',
    });
    setLocalStack(stack);

    expect(peekDataSource()).toBe(stack.dataSource);

    vi.stubGlobal('window', {});
    expect(initializeDataSource()).toBe(stack.dataSource);
    expect(initializeDataSource()).toBe(stack.dataSource);
  });

  it('reset esquece a instancia', () => {
    setLocalStack(
      createLocalStack({ driver: createMemoryStorageDriver(), key: 'finan:test' }),
    );
    expect(peekDataSource()).not.toBeNull();

    resetDataSource();
    expect(peekDataSource()).toBeNull();
  });
});
