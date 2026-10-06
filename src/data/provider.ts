import { DataError } from './ports/errors';
import type { DataSource } from './ports/data-source';
import type { LocalStack } from './adapters/local/local-data-source';
import { createLocalStack } from './adapters/local/local-data-source';
import { seedIfEmpty } from './seed/seed';

/**
 * Ponto unico onde o adapter concreto e escolhido.
 *
 * Seguranca em SSR (regra 10): este modulo nao toca em `window` no corpo do
 * arquivo. A pilha e criada por chamada explicita, sempre no cliente. Importar
 * este arquivo em um Server Component e inofensivo; chama-lo no servidor
 * resulta em `storage_unavailable` — um erro claro, nunca um crash obscuro de
 * "localStorage is not defined".
 *
 * Quando o Supabase entrar, `initializeDataSource` passa a escolher entre os
 * adapters. Nada acima desta camada muda.
 */

let stack: LocalStack | null = null;

export function isServerEnvironment(): boolean {
  return typeof window === 'undefined';
}

export interface InitializeOptions {
  /** Insere os dados de demonstracao se a base estiver vazia. */
  readonly seed?: boolean;
}

/**
 * Cria (uma vez) e devolve a pilha de dados do cliente.
 * Chamadas seguintes reaproveitam a mesma instancia — duas instancias sobre a
 * mesma chave teriam caches independentes.
 */
export function initializeDataSource(options: InitializeOptions = {}): DataSource {
  if (isServerEnvironment()) {
    throw new DataError(
      'storage_unavailable',
      'O adapter local so funciona no cliente. Garanta que a inicializacao acontece em um Client Component.',
    );
  }

  if (stack === null) {
    stack = createLocalStack();
    if (options.seed === true) {
      seedIfEmpty({ database: stack.database, userId: stack.userId });
    }
  }

  return stack.dataSource;
}

/** Pilha ja inicializada, ou `null`. Nao cria nada e nao lanca. */
export function peekDataSource(): DataSource | null {
  return stack?.dataSource ?? null;
}

/** Injeta uma pilha pronta. Usado por testes e, no futuro, pelo adapter Supabase. */
export function setLocalStack(next: LocalStack | null): void {
  stack = next;
}

export function resetDataSource(): void {
  stack = null;
}
