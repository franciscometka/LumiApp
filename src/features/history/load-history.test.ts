import { describe, expect, it, vi } from 'vitest';

import { createLocalStack } from '@/data/adapters/local/local-data-source';
import { createMemoryStorageDriver } from '@/data/adapters/local/storage-driver';
import { resolveHistoryWindow } from '@/domain/calculations/history';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';
import { monthKeyOf, todayPlainDate, toMonthKey } from '@/domain/shared/plain-date';

import { loadMonthlySnapshot } from '../dashboard/use-monthly-snapshot';
import { materializeMonth } from '../recurring/materialize';

import { loadHistory } from './use-history';

/**
 * `loadHistory` contra o storage real (em memoria).
 *
 * Duas garantias: ele so LE (a escrita e da preparacao, antes), e para cada
 * mes devolve os mesmos numeros que o Dashboard calcularia para aquele mes.
 */

const atual = monthKeyOf(todayPlainDate());
const anterior = civilMonthResolver.previous(atual);
const m = (value: string) => toMonthKey(value) as MonthKey;

async function montar() {
  const { dataSource, userId } = createLocalStack({ driver: createMemoryStorageDriver() });
  const base = { userId, categoryId: 'cat-outros', paymentMethod: 'pix' as const };

  await dataSource.transactions.createMany([
    {
      ...base,
      description: 'Salario',
      amountCents: 300000,
      type: 'income',
      flow: 'operational',
      status: 'paid',
      date: `${anterior}-05`,
    },
    {
      ...base,
      description: 'Reserva',
      amountCents: 10000,
      type: 'income',
      flow: 'transfer',
      status: 'paid',
      date: `${anterior}-06`,
    },
    {
      ...base,
      description: 'Mercado',
      amountCents: 80000,
      type: 'expense',
      flow: 'operational',
      status: 'paid',
      date: `${anterior}-12`,
    },
    {
      ...base,
      description: 'Guardar',
      amountCents: 50000,
      type: 'expense',
      flow: 'transfer',
      status: 'paid',
      date: `${anterior}-28`,
    },
    {
      ...base,
      description: 'Salario',
      amountCents: 310000,
      type: 'income',
      flow: 'operational',
      status: 'pending',
      date: `${atual}-05`,
    },
  ] as unknown as Parameters<typeof dataSource.transactions.createMany>[0]);

  await dataSource.monthlyPlans.create({
    userId,
    month: anterior,
    expectedIncomeCents: 300000,
    spendingLimitCents: 100000,
    savingsGoalCents: 0,
  } as Parameters<typeof dataSource.monthlyPlans.create>[0]);

  await dataSource.recurringBills.create({
    userId,
    description: 'Internet',
    amountCents: 12000,
    type: 'expense',
    categoryId: 'cat-internet',
    dueDay: 10,
    paymentMethod: 'boleto',
    isActive: true,
    startMonth: m('2020-01'),
  } as Parameters<typeof dataSource.recurringBills.create>[0]);

  return dataSource;
}

describe('loadHistory', () => {
  it('e somente leitura: nao materializa nem grava nada', async () => {
    const dataSource = await montar();
    const insert = vi.spyOn(dataSource.transactions, 'insertManyIgnoringExisting');
    const createMany = vi.spyOn(dataSource.transactions, 'createMany');
    const antes = await dataSource.transactions.count({ includeDeleted: true });

    await loadHistory(dataSource, resolveHistoryWindow(civilMonthResolver, atual, 12));

    expect(insert).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(await dataSource.transactions.count({ includeDeleted: true })).toBe(antes);
  });

  it('cada mes tem os mesmos totais e plano do snapshot do Dashboard', async () => {
    const dataSource = await montar();
    const window = resolveHistoryWindow(civilMonthResolver, atual, 6);
    // A preparacao que o hook faz antes de ler.
    for (const month of window.months) await materializeMonth(dataSource, month);

    const history = await loadHistory(dataSource, window);

    for (const entry of history.months) {
      const { snapshot } = await loadMonthlySnapshot(dataSource, entry.month);
      expect(entry.totals, entry.month).toEqual(snapshot.totals);
      expect(entry.plan, entry.month).toEqual(snapshot.plan);
      expect(entry.temporality, entry.month).toBe(snapshot.temporality);
    }

    const mesAnterior = history.months.find((entry) => entry.month === anterior);
    // R$ 3.000 de renda + R$ 100 da reserva = R$ 3.000 de renda gerada.
    expect(mesAnterior?.earnedIncome).toBe(300000);
    // R$ 800 de mercado + R$ 120 de internet; os R$ 500 guardados nao entram.
    expect(mesAnterior?.operationalExpense).toBe(92000);
    expect(mesAnterior?.result).toBe(208000);
  });
});
