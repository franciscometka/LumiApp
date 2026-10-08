import { describe, expect, it } from 'vitest';

import { cents, date, makeExpense, makeIncome, month } from '../__testing__/factories';
import { toMoney } from '../shared/money';
import * as cardRules from './card';
import { cardSchema } from './card';
import { acceptsType, categorySchema, sortCategories } from './category';
import * as debtRules from './debt';
import { debtSchema } from './debt';
import { monthlyPlanSchema } from './monthly-plan';
import {
  dueDateInMonth,
  isActiveInMonth,
  recurringBillSchema,
} from './recurring-bill';
import {
  isCardCommitment,
  isDebtCommitment,
  isDeleted,
  isExpense,
  isIncome,
  isPaid,
  isPending,
  signedAmount,
  transactionSchema,
} from './transaction';

const agora = '2026-10-10T12:00:00.000Z';

describe('Transaction', () => {
  it('deriva o sinal do tipo, nunca do valor', () => {
    expect(signedAmount(makeIncome({ amountCents: 230000 }))).toBe(230000);
    expect(signedAmount(makeExpense({ amountCents: 91100 }))).toBe(-91100);
  });

  it('expoe os predicados de estado', () => {
    const entrada = makeIncome({ status: 'paid' });
    const saidaPendente = makeExpense({ status: 'pending' });

    expect(isIncome(entrada)).toBe(true);
    expect(isExpense(saidaPendente)).toBe(true);
    expect(isPaid(entrada)).toBe(true);
    expect(isPending(saidaPendente)).toBe(true);
    expect(isDeleted(entrada)).toBe(false);
    expect(isDeleted(makeExpense({ deletedAt: agora }))).toBe(true);
  });

  it('identifica compromissos de cartao e divida', () => {
    expect(isCardCommitment(makeExpense({ cardId: 'card-1' }))).toBe(true);
    expect(isCardCommitment(makeExpense({ paymentMethod: 'credit' }))).toBe(true);
    expect(isCardCommitment(makeExpense({ paymentMethod: 'pix' }))).toBe(false);
    expect(isDebtCommitment(makeExpense({ debtId: 'debt-1' }))).toBe(true);
  });

  it('aceita uma transacao valida', () => {
    expect(transactionSchema.safeParse(makeExpense()).success).toBe(true);
  });

  it('recusa valor zero, negativo ou fracionario', () => {
    const base = makeExpense();

    expect(transactionSchema.safeParse({ ...base, amountCents: 0 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amountCents: -100 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amountCents: 10.5 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amountCents: Number.NaN }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, amountCents: '100' }).success).toBe(false);
  });

  it('recusa data invalida', () => {
    const base = makeExpense();

    expect(transactionSchema.safeParse({ ...base, date: '2026-02-30' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, date: '05/10/2026' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, date: '2026-10-05T00:00:00Z' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, date: '2024-02-29' }).success).toBe(true);
  });

  it('recusa enums e campos obrigatorios fora do contrato', () => {
    const base = makeExpense();

    expect(transactionSchema.safeParse({ ...base, type: 'transferencia' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, status: 'atrasado' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, paymentMethod: 'bitcoin' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, description: '' }).success).toBe(false);
  });
});

describe('Category', () => {
  const base = {
    id: 'cat-1',
    userId: 'user-1',
    name: 'Carro',
    kind: 'expense' as const,
    icon: 'car',
    colorToken: 'chart-1' as const,
    isSystem: true,
    order: 0,
    createdAt: agora,
    updatedAt: agora,
  };

  it('valida uma categoria completa', () => {
    expect(categorySchema.safeParse(base).success).toBe(true);
  });

  it('recusa token de cor fora da escala e ordem negativa', () => {
    expect(categorySchema.safeParse({ ...base, colorToken: '#ff0000' }).success).toBe(false);
    expect(categorySchema.safeParse({ ...base, colorToken: 'chart-9' }).success).toBe(false);
    expect(categorySchema.safeParse({ ...base, order: -1 }).success).toBe(false);
  });

  it('restringe a categoria ao tipo certo de transacao', () => {
    const despesa = categorySchema.parse(base);
    const receita = categorySchema.parse({ ...base, kind: 'income' });
    const ambas = categorySchema.parse({ ...base, kind: 'both' });

    expect(acceptsType(despesa, 'expense')).toBe(true);
    expect(acceptsType(despesa, 'income')).toBe(false);
    expect(acceptsType(receita, 'income')).toBe(true);
    expect(acceptsType(ambas, 'income')).toBe(true);
    expect(acceptsType(ambas, 'expense')).toBe(true);
  });

  it('ordena por posicao e desempata por nome em pt-BR', () => {
    const categorias = [
      categorySchema.parse({ ...base, id: 'c1', name: 'Zebra', order: 1 }),
      categorySchema.parse({ ...base, id: 'c2', name: 'Agua', order: 1 }),
      categorySchema.parse({ ...base, id: 'c3', name: 'Casa', order: 0 }),
    ];

    expect(sortCategories(categorias).map((item) => item.name)).toEqual(['Casa', 'Agua', 'Zebra']);
  });
});

describe('Card', () => {
  const base = cardSchema.parse({
    id: 'card-1',
    userId: 'user-1',
    name: 'Inter',
    limitCents: toMoney(500000),
    closingDay: 20,
    dueDay: 31,
    currentInvoiceCents: toMoney(37400),
    colorToken: 'chart-2',
    createdAt: agora,
    updatedAt: agora,
  });

  it('calcula limite disponivel e uso', () => {
    expect(cardRules.availableLimit(base)).toBe(462600);
    expect(cardRules.limitUsagePercentage(base)).toBeCloseTo(7.48, 2);
    expect(cardRules.isOverLimit(base)).toBe(false);
  });

  it('nunca devolve limite disponivel negativo', () => {
    const estourado = { ...base, currentInvoiceCents: toMoney(600000) };
    expect(cardRules.availableLimit(estourado)).toBe(0);
    expect(cardRules.isOverLimit(estourado)).toBe(true);
  });

  it('devolve null no uso quando nao ha limite cadastrado', () => {
    expect(cardRules.limitUsagePercentage({ ...base, limitCents: toMoney(0) })).toBeNull();
  });

  it('limita o vencimento ao ultimo dia do mes', () => {
    // Vencimento dia 31 nao pode virar 3 de marco em fevereiro.
    expect(cardRules.nextDueDate(base, date('2026-02-01'))).toBe('2026-02-28');
    expect(cardRules.nextDueDate(base, date('2024-02-01'))).toBe('2024-02-29');
    expect(cardRules.nextDueDate(base, date('2026-04-15'))).toBe('2026-04-30');
    expect(cardRules.nextDueDate(base, date('2026-10-31'))).toBe('2026-10-31');
    expect(cardRules.nextDueDate(base, date('2026-11-30'))).toBe('2026-11-30');
  });

  it('calcula o proximo fechamento', () => {
    expect(cardRules.nextClosingDate(base, date('2026-10-10'))).toBe('2026-10-20');
    expect(cardRules.nextClosingDate(base, date('2026-10-21'))).toBe('2026-11-20');
  });

  it('recusa dia de vencimento fora de 1-31 e fatura negativa', () => {
    const cru = { ...base, dueDay: 32 };
    expect(cardSchema.safeParse(cru).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, closingDay: 0 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, currentInvoiceCents: -100 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, currentInvoiceCents: 0 }).success).toBe(true);
  });
});

describe('Debt', () => {
  const base = debtSchema.parse({
    id: 'debt-1',
    userId: 'user-1',
    name: 'Emprestimo',
    installmentCents: toMoney(44000),
    totalInstallments: 24,
    paidInstallments: 9,
    dueDay: 10,
    startDate: date('2026-02-10'),
    createdAt: agora,
    updatedAt: agora,
  });

  it('deriva parcelas e valores restantes', () => {
    expect(debtRules.remainingInstallments(base)).toBe(15);
    expect(debtRules.totalAmount(base)).toBe(1056000);
    expect(debtRules.paidAmount(base)).toBe(396000);
    expect(debtRules.remainingAmount(base)).toBe(660000);
    expect(debtRules.progressPercentage(base)).toBe(37.5);
    expect(debtRules.isSettled(base)).toBe(false);
  });

  it('reconhece divida quitada', () => {
    const quitada = { ...base, paidInstallments: 24 };
    expect(debtRules.isSettled(quitada)).toBe(true);
    expect(debtRules.remainingInstallments(quitada)).toBe(0);
    expect(debtRules.remainingAmount(quitada)).toBe(0);
    expect(debtRules.progressPercentage(quitada)).toBe(100);
    expect(debtRules.nextDueDate(quitada, date('2026-10-01'))).toBeNull();
  });

  it('calcula o mes da ultima parcela atravessando o ano', () => {
    expect(debtRules.finalMonth(base)).toBe('2028-01');
  });

  it('soma o compromisso mensal ignorando dividas quitadas', () => {
    const quitada = { ...base, id: 'debt-2', paidInstallments: 24 };
    expect(debtRules.monthlyCommitment([base, quitada])).toBe(44000);
    expect(debtRules.monthlyCommitment([])).toBe(0);
  });

  it('recusa parcelas pagas acima do total', () => {
    expect(
      debtSchema.safeParse({ ...base, paidInstallments: 25, totalInstallments: 24 }).success,
    ).toBe(false);
    expect(debtSchema.safeParse({ ...base, totalInstallments: 0 }).success).toBe(false);
    expect(debtSchema.safeParse({ ...base, installmentCents: 0 }).success).toBe(false);
    expect(debtSchema.safeParse({ ...base, paidInstallments: -1 }).success).toBe(false);
  });
});

describe('RecurringBill', () => {
  const base = recurringBillSchema.parse({
    id: 'rec-1',
    userId: 'user-1',
    description: 'Internet',
    amountCents: toMoney(12000),
    type: 'expense',
    categoryId: 'cat-internet',
    dueDay: 31,
    paymentMethod: 'boleto',
    isActive: true,
    startMonth: month('2026-01'),
    createdAt: agora,
    updatedAt: agora,
  });

  it('limita o vencimento ao ultimo dia do mes', () => {
    // "Todo dia 31" tem que existir em todo mes.
    expect(dueDateInMonth(base, month('2026-01'))).toBe('2026-01-31');
    expect(dueDateInMonth(base, month('2026-02'))).toBe('2026-02-28');
    expect(dueDateInMonth(base, month('2024-02'))).toBe('2024-02-29');
    expect(dueDateInMonth(base, month('2026-04'))).toBe('2026-04-30');
  });

  it('respeita a vigencia da conta', () => {
    expect(isActiveInMonth(base, month('2025-12'))).toBe(false);
    expect(isActiveInMonth(base, month('2026-01'))).toBe(true);
    expect(isActiveInMonth(base, month('2026-10'))).toBe(true);
    expect(isActiveInMonth({ ...base, isActive: false }, month('2026-10'))).toBe(false);
    expect(isActiveInMonth({ ...base, deletedAt: agora }, month('2026-10'))).toBe(false);

    const comFim = { ...base, endMonth: month('2026-06') };
    expect(isActiveInMonth(comFim, month('2026-06'))).toBe(true);
    expect(isActiveInMonth(comFim, month('2026-07'))).toBe(false);
  });

  it('a vigencia nao depende de lastGeneratedMonth', () => {
    /**
     * `lastGeneratedMonth` era usado como guarda de idempotencia, com a regra
     * `month > lastGeneratedMonth`. Isso pulava meses visitados fora de ordem:
     * depois de abrir novembro, setembro nunca mais ganharia suas contas.
     *
     * A idempotencia passou para o id determinstico da ocorrencia, e a
     * vigencia virou uma pergunta puramente civil — que nao olha para o campo.
     */
    const comMarcador = { ...base, lastGeneratedMonth: month('2026-11') };

    expect(isActiveInMonth(comMarcador, month('2026-09'))).toBe(true);
    expect(isActiveInMonth(comMarcador, month('2026-10'))).toBe(true);
    expect(isActiveInMonth(comMarcador, month('2026-12'))).toBe(true);
  });
});

describe('MonthlyPlan', () => {
  const base = {
    id: 'plan-1',
    userId: 'user-1',
    month: month('2026-10'),
    expectedIncomeCents: cents(300000),
    spendingLimitCents: cents(250000),
    savingsGoalCents: cents(50000),
    createdAt: agora,
    updatedAt: agora,
  };

  it('aceita metas zeradas mas recusa negativas', () => {
    expect(monthlyPlanSchema.safeParse(base).success).toBe(true);
    expect(monthlyPlanSchema.safeParse({ ...base, savingsGoalCents: 0 }).success).toBe(true);
    expect(monthlyPlanSchema.safeParse({ ...base, savingsGoalCents: -1 }).success).toBe(false);
    expect(monthlyPlanSchema.safeParse({ ...base, spendingLimitCents: -100 }).success).toBe(false);
  });

  it('recusa mes mal formado', () => {
    expect(monthlyPlanSchema.safeParse({ ...base, month: '2026-13' }).success).toBe(false);
    expect(monthlyPlanSchema.safeParse({ ...base, month: '2026-10-01' }).success).toBe(false);
  });
});
