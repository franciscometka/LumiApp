import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DataError } from '../../ports/errors';
import {
  createBrowserStorageDriver,
  createMemoryStorageDriver,
  isBrowserStorageAvailable,
} from './storage-driver';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seguranca em SSR', () => {
  it('o ambiente de teste nao tem window — como o servidor', () => {
    expect(typeof window).toBe('undefined');
  });

  it('importar o modulo no servidor nao faz nada', () => {
    // Se houvesse acesso a `localStorage` no corpo do modulo, o import acima
    // ja teria quebrado esta suite inteira.
    expect(isBrowserStorageAvailable()).toBe(false);
  });

  it('criar o driver de navegador no servidor falha com erro claro', () => {
    try {
      createBrowserStorageDriver();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('storage_unavailable');
      expect((error as DataError).message).toContain('cliente');
    }
  });

  it('a verificacao acontece na chamada, nao no import', () => {
    // Mesmo com `window` presente, so e avaliado quando a funcao roda.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });

    expect(isBrowserStorageAvailable()).toBe(true);
    expect(createBrowserStorageDriver().id).toBe('browser-local-storage');
  });
});

describe('falhas do navegador', () => {
  it('modo privado: localStorage existe mas recusa escrever', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => undefined,
      },
    });

    expect(isBrowserStorageAvailable()).toBe(false);

    try {
      createBrowserStorageDriver();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('storage_unavailable');
      expect((error as DataError).message).toContain('bloqueado');
    }
  });

  it('cota estourada durante a gravacao vira storage_write_failed', () => {
    let permitirEscrita = true;
    const store = new Map<string, string>();

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (!permitirEscrita) throw new Error('QuotaExceededError');
          store.set(key, value);
        },
        removeItem: (key: string) => store.delete(key),
      },
    });

    const driver = createBrowserStorageDriver();
    permitirEscrita = false;

    try {
      driver.write('finan:db', '{}');
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('storage_write_failed');
      expect((error as DataError).message).toContain('espaco');
    }
  });
});

describe('driver de memoria', () => {
  it('le, grava e remove', () => {
    const driver = createMemoryStorageDriver({ existente: 'valor' });

    expect(driver.read('existente')).toBe('valor');
    expect(driver.read('ausente')).toBeNull();

    driver.write('novo', 'conteudo');
    expect(driver.read('novo')).toBe('conteudo');

    driver.remove('novo');
    expect(driver.read('novo')).toBeNull();
  });

  it('instancias sao independentes', () => {
    const primeiro = createMemoryStorageDriver();
    const segundo = createMemoryStorageDriver();

    primeiro.write('chave', 'a');
    expect(segundo.read('chave')).toBeNull();
  });
});
