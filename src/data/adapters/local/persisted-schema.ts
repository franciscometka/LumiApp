import { z } from 'zod';

import { cardSchema } from '@/domain/entities/card';
import { categorySchema } from '@/domain/entities/category';
import { debtSchema } from '@/domain/entities/debt';
import { monthlyPlanSchema } from '@/domain/entities/monthly-plan';
import { recurringBillSchema } from '@/domain/entities/recurring-bill';
import { transactionSchema } from '@/domain/entities/transaction';
import { userSettingsSchema } from '@/domain/entities/user-settings';
import { timestampSchema } from '@/domain/shared/schemas';

/**
 * Formato persistido.
 *
 * Tudo vive sob UMA chave do localStorage. A alternativa (uma chave por
 * colecao) tornaria cada migracao nao-atomica: um crash no meio deixaria
 * metade dos dados numa versao e metade em outra, sem forma de saber qual.
 */
export const STORAGE_KEY = 'finan:db';

/** Versao inicial do formato. Incrementa a cada mudanca incompativel. */
export const CURRENT_SCHEMA_VERSION = 1;

export const COLLECTION_NAMES = [
  'transactions',
  'categories',
  'cards',
  'debts',
  'recurringBills',
  'monthlyPlans',
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

export const persistedCollectionsSchema = z.object({
  transactions: z.array(transactionSchema),
  categories: z.array(categorySchema),
  cards: z.array(cardSchema),
  debts: z.array(debtSchema),
  recurringBills: z.array(recurringBillSchema),
  monthlyPlans: z.array(monthlyPlanSchema),
});

export const persistedMetaSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Marcador de idempotencia do seed. Presente => o seed ja rodou. */
  seededAt: timestampSchema.optional(),
});

export const persistedDatabaseSchema = z.object({
  schemaVersion: z.number().int().positive(),
  meta: persistedMetaSchema,
  collections: persistedCollectionsSchema,
  settings: userSettingsSchema.nullable(),
});

export type PersistedCollections = z.infer<typeof persistedCollectionsSchema>;
export type PersistedDatabase = z.infer<typeof persistedDatabaseSchema>;

export function createEmptyCollections(): PersistedCollections {
  return {
    transactions: [],
    categories: [],
    cards: [],
    debts: [],
    recurringBills: [],
    monthlyPlans: [],
  };
}

export function createEmptyDatabase(now: string): PersistedDatabase {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { createdAt: now, updatedAt: now },
    collections: createEmptyCollections(),
    settings: null,
  };
}

export function countRecords(database: PersistedDatabase): number {
  return COLLECTION_NAMES.reduce(
    (total, name) => total + database.collections[name].length,
    0,
  );
}

export function isDatabaseEmpty(database: PersistedDatabase): boolean {
  return countRecords(database) === 0 && database.settings === null;
}

/**
 * Le a versao sem validar o resto.
 *
 * Precisa ser tolerante de proposito: e esta leitura que decide se os dados
 * devem ser migrados antes de passar pelo schema completo. Validar primeiro e
 * perguntar a versao depois rejeitaria todo dado antigo como "corrompido".
 */
export function readSchemaVersion(value: unknown): number | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const version = (value as Record<string, unknown>).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null;

  return version;
}
