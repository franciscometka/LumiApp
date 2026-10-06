import type { ZodType } from 'zod';

import { cardSchema } from '@/domain/entities/card';
import { categorySchema } from '@/domain/entities/category';
import { debtSchema } from '@/domain/entities/debt';
import { monthlyPlanSchema } from '@/domain/entities/monthly-plan';
import { recurringBillSchema } from '@/domain/entities/recurring-bill';
import { transactionSchema } from '@/domain/entities/transaction';
import { userSettingsSchema } from '@/domain/entities/user-settings';

import type { RecordIssue } from '../ports/errors';
import { DataError } from '../ports/errors';

/**
 * Fronteira unica entre JSON e dominio.
 *
 *   storage/JSON  --parse-->  dominio
 *   dominio      --serialize--> storage/JSON
 *
 * Os tipos nominais (`Money`, `PlainDate`, `MonthKey`) existem so no sistema de
 * tipos: em tempo de execucao sao `number` e `string`. Reconstrui-los com `as`
 * espalhado pelo codigo significaria confiar no JSON. Aqui eles sao
 * reconstruidos num unico lugar, e sempre por validacao Zod — o `as` nunca
 * aparece fora deste modulo.
 */

/** Valor seguro para `JSON.stringify`, sem `undefined` e sem classes. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CodecResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly RecordIssue[] };

export interface Codec<T> {
  readonly name: string;
  /** Valida e devolve a entidade do dominio. Lanca `DataError` se recusada. */
  parse(raw: unknown): T;
  /** Versao que nao lanca, usada pelo modo de recuperacao. */
  safeParse(raw: unknown, index?: number): CodecResult<T>;
  /** Dominio -> JSON. Valida antes de gravar: nada invalido chega ao storage. */
  serialize(entity: T): JsonValue;
}

/**
 * Remove chaves com valor `undefined`.
 *
 * `JSON.stringify` ja as descartaria, mas depender disso deixaria o formato
 * persistido implicito. Fazer explicitamente mantem `serialize` previsivel e
 * comparavel em teste.
 */
function stripUndefined(value: unknown): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stripUndefined);

  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      result[key] = stripUndefined(item);
    }
    return result;
  }

  if (typeof value === 'string' || typeof value === 'boolean') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DataError(
        'validation_failed',
        `Numero nao serializavel em JSON: ${String(value)}`,
      );
    }
    return value;
  }

  throw new DataError(
    'validation_failed',
    `Valor nao serializavel em JSON: ${typeof value}`,
  );
}

function readId(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const id = (raw as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

export function createCodec<T>(name: string, schema: ZodType<T>): Codec<T> {
  function toIssues(raw: unknown, index: number | null, error: unknown): RecordIssue[] {
    const zodIssues =
      typeof error === 'object' &&
      error !== null &&
      'issues' in error &&
      Array.isArray((error as { issues: unknown }).issues)
        ? ((error as { issues: { path: PropertyKey[]; message: string }[] }).issues)
        : [];

    if (zodIssues.length === 0) {
      return [
        {
          collection: name,
          index,
          id: readId(raw),
          path: '',
          message: 'Registro invalido',
        },
      ];
    }

    return zodIssues.map((issue) => ({
      collection: name,
      index,
      id: readId(raw),
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
  }

  return {
    name,

    parse(raw: unknown): T {
      const result = schema.safeParse(raw);
      if (!result.success) {
        const issues = toIssues(raw, null, result.error);
        throw new DataError(
          'validation_failed',
          `Registro invalido em ${name}: ${issues[0]?.message ?? 'motivo desconhecido'}`,
          { issues },
        );
      }
      return result.data;
    },

    safeParse(raw: unknown, index?: number): CodecResult<T> {
      const result = schema.safeParse(raw);
      if (!result.success) {
        return { ok: false, issues: toIssues(raw, index ?? null, result.error) };
      }
      return { ok: true, value: result.data };
    },

    serialize(entity: T): JsonValue {
      // Validar na saida tambem: uma entidade que foi corrompida em memoria
      // nao pode contaminar o storage.
      const result = schema.safeParse(entity);
      if (!result.success) {
        const issues = toIssues(entity, null, result.error);
        throw new DataError(
          'validation_failed',
          `Entidade invalida ao serializar ${name}: ${issues[0]?.message ?? 'motivo desconhecido'}`,
          { issues },
        );
      }
      return stripUndefined(result.data);
    },
  };
}

export const transactionCodec = createCodec('transactions', transactionSchema);
export const categoryCodec = createCodec('categories', categorySchema);
export const cardCodec = createCodec('cards', cardSchema);
export const debtCodec = createCodec('debts', debtSchema);
export const recurringBillCodec = createCodec('recurringBills', recurringBillSchema);
export const monthlyPlanCodec = createCodec('monthlyPlans', monthlyPlanSchema);
export const userSettingsCodec = createCodec('settings', userSettingsSchema);
