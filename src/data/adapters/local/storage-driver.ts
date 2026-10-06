import { DataError } from '../../ports/errors';

/**
 * Abstracao minima sobre o armazenamento chave-valor.
 *
 * Existe por tres motivos:
 * 1. isolar `localStorage` atras de uma interface, para que o restante do
 *    adapter seja testavel sem navegador;
 * 2. transformar as falhas do navegador (modo privado, cota estourada) em
 *    `DataError` com codigo conhecido;
 * 3. garantir que nenhum acesso aconteca durante o import do modulo — toda
 *    verificacao de ambiente e feita no momento da chamada.
 */
export interface StorageDriver {
  readonly id: string;
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * Se ha um `localStorage` utilizavel AGORA.
 *
 * Nao basta checar `typeof window`: no modo privado do Safari o objeto existe
 * mas qualquer escrita lanca. A unica verificacao confiavel e tentar escrever.
 */
export function isBrowserStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const probe = '__finan_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Driver de `localStorage`.
 *
 * A checagem de ambiente acontece dentro da funcao, nunca no corpo do modulo:
 * importar este arquivo em um Server Component e inofensivo, chamar esta
 * funcao no servidor e um erro explicito.
 */
export function createBrowserStorageDriver(): StorageDriver {
  if (typeof window === 'undefined') {
    throw new DataError(
      'storage_unavailable',
      'localStorage nao existe neste ambiente. O adapter local so pode ser usado no cliente.',
    );
  }

  if (!isBrowserStorageAvailable()) {
    throw new DataError(
      'storage_unavailable',
      'localStorage esta bloqueado neste navegador (modo privado ou permissao negada).',
    );
  }

  return {
    id: 'browser-local-storage',

    read(key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch (cause) {
        throw new DataError('storage_unavailable', 'Falha ao ler do localStorage.', { cause });
      }
    },

    write(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value);
      } catch (cause) {
        throw new DataError(
          'storage_write_failed',
          'Falha ao gravar no localStorage. O limite de espaco pode ter sido atingido.',
          { cause },
        );
      }
    },

    remove(key: string): void {
      try {
        window.localStorage.removeItem(key);
      } catch (cause) {
        throw new DataError('storage_write_failed', 'Falha ao remover do localStorage.', { cause });
      }
    },
  };
}

/** Driver em memoria. Usado pelos testes e como base de fixtures. */
export function createMemoryStorageDriver(
  initial: Readonly<Record<string, string>> = {},
): StorageDriver {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    id: 'memory',
    read: (key) => store.get(key) ?? null,
    write: (key, value) => {
      store.set(key, value);
    },
    remove: (key) => {
      store.delete(key);
    },
  };
}
