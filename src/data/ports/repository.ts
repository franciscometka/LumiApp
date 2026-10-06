import type { ID, Timestamp } from '@/domain/shared/id';

/**
 * Contratos genericos de persistencia.
 *
 * Toda operacao devolve `Promise`, mesmo que o adapter atual (localStorage)
 * seja sincrono. A assinatura descreve o CONTRATO, nao a implementacao de
 * hoje: quando o Supabase entrar, a camada de aplicacao nao muda uma linha.
 */

/** Campos que toda entidade persistida carrega. */
export interface PersistedRecord {
  readonly id: ID;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  /** Exclusao logica. Preserva a sincronizacao futura. */
  readonly deletedAt?: Timestamp;
}

/** O que o chamador informa ao criar: sem id e sem timestamps. */
export type CreateInput<T extends PersistedRecord> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** O que pode ser alterado. `id` e `createdAt` sao imutaveis por contrato. */
export type UpdateInput<T extends PersistedRecord> = Partial<
  Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
>;

export interface ListOptions {
  /** Por padrao os registros excluidos ficam de fora. */
  readonly includeDeleted?: boolean;
}

export interface Repository<T extends PersistedRecord> {
  findAll(options?: ListOptions): Promise<T[]>;
  findById(id: ID, options?: ListOptions): Promise<T | null>;
  create(input: CreateInput<T>): Promise<T>;
  update(id: ID, patch: UpdateInput<T>): Promise<T>;
  /** Exclusao logica: marca `deletedAt`, nao remove a linha. */
  remove(id: ID): Promise<void>;
  /** Desfaz a exclusao logica. Sustenta o "desfazer" do toast. */
  restore(id: ID): Promise<T>;
  count(options?: ListOptions): Promise<number>;
}
