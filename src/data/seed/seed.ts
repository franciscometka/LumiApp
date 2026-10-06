import type { ID } from '@/domain/shared/id';
import type { MonthKey, PlainDate } from '@/domain/shared/plain-date';
import { monthKeyOf, todayPlainDate } from '@/domain/shared/plain-date';

import type { LocalDatabase } from '../adapters/local/local-database';
import { countRecords } from '../adapters/local/persisted-schema';
import { buildSeedData } from './demo-data';

export type SeedOutcome =
  /** Dados inseridos agora. */
  | 'seeded'
  /** O marcador `seededAt` ja existia: o seed ja rodou alguma vez. */
  | 'already_seeded'
  /** Ha dados do usuario. Nunca sobrescrevemos. */
  | 'not_empty';

export interface SeedResult {
  readonly outcome: SeedOutcome;
  readonly recordsInserted: number;
}

export interface SeedRunOptions {
  readonly database: LocalDatabase;
  readonly userId: ID;
  /** Data de referencia. Os lancamentos entram no mes a que ela pertence. */
  readonly today?: PlainDate;
  readonly month?: MonthKey;
}

/**
 * Insere os dados de demonstracao SOMENTE em uma base realmente vazia.
 *
 * Idempotencia com guarda dupla, porque as duas condicoes respondem a
 * perguntas diferentes:
 *
 * - `meta.seededAt` responde "o seed ja rodou?". Impede que apagar tudo
 *   manualmente faca os dados de demonstracao voltarem na proxima abertura —
 *   o que seria, do ponto de vista do usuario, o app desfazendo o que ele fez.
 * - a contagem de registros responde "ha dados a preservar?". Impede
 *   sobrescrever dados reais caso o marcador se perca.
 *
 * Tudo entra em UMA escrita: ou o conjunto completo e gravado, ou nada e.
 * Nao existe estado intermediario em que metade do seed esta no storage.
 */
export function seedIfEmpty({
  database,
  userId,
  today,
  month,
}: SeedRunOptions): SeedResult {
  const current = database.load();

  if (current.meta.seededAt !== undefined) {
    return { outcome: 'already_seeded', recordsInserted: 0 };
  }

  if (countRecords(current) > 0 || current.settings !== null) {
    return { outcome: 'not_empty', recordsInserted: 0 };
  }

  const now = database.now();
  const referenceMonth = month ?? monthKeyOf(today ?? todayPlainDate());
  const data = buildSeedData({ userId, month: referenceMonth, now });

  const inserted =
    data.categories.length +
    data.cards.length +
    data.debts.length +
    data.recurringBills.length +
    data.transactions.length +
    data.monthlyPlans.length;

  database.mutate((draft) => {
    draft.collections.categories = [...data.categories];
    draft.collections.cards = [...data.cards];
    draft.collections.debts = [...data.debts];
    draft.collections.recurringBills = [...data.recurringBills];
    draft.collections.transactions = [...data.transactions];
    draft.collections.monthlyPlans = [...data.monthlyPlans];
    draft.settings = data.settings;
    draft.meta = { ...draft.meta, seededAt: now };
  });

  return { outcome: 'seeded', recordsInserted: inserted };
}
