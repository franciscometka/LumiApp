import type { MonthlyPlan } from '../entities/monthly-plan';
import type { Transaction } from '../entities/transaction';
import type { Money } from '../shared/money';
import { toMoney } from '../shared/money';
import type { MonthKey, PlainDate } from '../shared/plain-date';
import { toMonthKey, toPlainDate } from '../shared/plain-date';

/**
 * Fabricas usadas apenas pelos testes. Nao sao importadas por codigo de
 * producao e nao entram no bundle.
 */

export const TEST_USER_ID = 'user-teste';

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

export function cents(value: number): Money {
  return toMoney(value);
}

export function date(value: string): PlainDate {
  return toPlainDate(value);
}

export function month(value: string): MonthKey {
  return toMonthKey(value);
}

type TransactionOverrides = Partial<Omit<Transaction, 'amountCents' | 'date'>> & {
  amountCents?: number;
  date?: string;
};

export function makeTransaction(overrides: TransactionOverrides = {}): Transaction {
  const { amountCents, date: dateValue, ...rest } = overrides;

  return {
    id: nextId('tx'),
    userId: TEST_USER_ID,
    description: 'Lancamento',
    amountCents: cents(amountCents ?? 10000),
    type: 'expense',
    flow: 'operational',
    categoryId: 'cat-outros',
    date: date(dateValue ?? '2026-10-10'),
    status: 'paid',
    paymentMethod: 'pix',
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
    ...rest,
  };
}

export function makeIncome(overrides: TransactionOverrides = {}): Transaction {
  return makeTransaction({ type: 'income', categoryId: 'cat-salario', ...overrides });
}

export function makeExpense(overrides: TransactionOverrides = {}): Transaction {
  return makeTransaction({ type: 'expense', ...overrides });
}

// Os campos substituidos saem do `Partial` original: mante-los criaria a
// intersecao `Money & number`, que volta a recusar numeros crus.
type PlanOverrides = Partial<
  Omit<
    MonthlyPlan,
    'month' | 'expectedIncomeCents' | 'spendingLimitCents' | 'savingsGoalCents'
  >
> & {
  month?: string;
  expectedIncomeCents?: number;
  spendingLimitCents?: number;
  savingsGoalCents?: number;
};

export function makePlan(overrides: PlanOverrides = {}): MonthlyPlan {
  const {
    month: monthValue,
    expectedIncomeCents,
    spendingLimitCents,
    savingsGoalCents,
    ...rest
  } = overrides;

  return {
    id: nextId('plan'),
    userId: TEST_USER_ID,
    month: month(monthValue ?? '2026-10'),
    expectedIncomeCents: cents(expectedIncomeCents ?? 300000),
    spendingLimitCents: cents(spendingLimitCents ?? 250000),
    savingsGoalCents: cents(savingsGoalCents ?? 50000),
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...rest,
  };
}

/**
 * Cenario exato do briefing: outubro de 2026, 4 entradas e 5 saidas.
 * Entradas R$ 3.100,00 - Saidas R$ 2.610,00 = Saldo R$ 490,00.
 */
export function briefingScenario(): Transaction[] {
  return [
    makeIncome({ description: 'Salario', amountCents: 230000, categoryId: 'cat-salario', date: '2026-10-05' }),
    makeIncome({ description: 'Renda extra', amountCents: 30000, categoryId: 'cat-extra', date: '2026-10-12' }),
    // Reserva nao e renda gerada: entra como transferencia.
    makeIncome({
      description: 'Dinheiro guardado',
      amountCents: 10000,
      categoryId: 'cat-reserva',
      date: '2026-10-15',
      flow: 'transfer',
    }),
    makeIncome({ description: 'Bonus', amountCents: 40000, categoryId: 'cat-bonus', date: '2026-10-20' }),

    makeExpense({ description: 'Carro', amountCents: 91100, categoryId: 'cat-carro', date: '2026-10-08' }),
    makeExpense({ description: 'Internet', amountCents: 12000, categoryId: 'cat-internet', date: '2026-10-10' }),
    makeExpense({
      description: 'Cartao Inter',
      amountCents: 37400,
      categoryId: 'cat-cartao',
      date: '2026-10-15',
      paymentMethod: 'credit',
      cardId: 'card-inter',
    }),
    makeExpense({
      description: 'Cartao Magalu',
      amountCents: 76500,
      categoryId: 'cat-cartao',
      date: '2026-10-15',
      paymentMethod: 'credit',
      cardId: 'card-magalu',
    }),
    makeExpense({
      description: 'Emprestimo',
      amountCents: 44000,
      categoryId: 'cat-emprestimo',
      date: '2026-10-20',
      paymentMethod: 'boleto',
      debtId: 'debt-emprestimo',
    }),
  ];
}
