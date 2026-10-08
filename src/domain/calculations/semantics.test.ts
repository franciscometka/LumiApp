import { describe, expect, it } from 'vitest';

import { date, makeExpense, makeIncome, makePlan, month } from '../__testing__/factories';
import type { Transaction } from '../entities/transaction';
import { subtractMoney } from '../shared/money';
import { civilMonthResolver } from '../shared/period';
import { buildHistory, resolveHistoryWindow } from './history';
import { buildSnapshot } from './snapshot';

/**
 * ============================================================================
 * As duas identidades centrais do app — e por que coexistem.
 * ============================================================================
 *
 * CAIXA (Inicio):        Entradas - Saidas = Saldo
 *                        inclui transferencias.
 *
 * ATIVIDADE ECONOMICA    Renda gerada - Gastos operacionais = Economia do mes
 * (Planejamento,         exclui transferencias.
 *  Historico):
 *
 * Mover dinheiro proprio muda o caixa e nao muda a atividade economica. Os
 * testes abaixo prendem isso em todas as metricas que poderiam confundir as
 * duas coisas: plano, categorias, compromissos, ritmo, comparacao e Historico.
 */

const OUTUBRO = civilMonthResolver.resolve(month('2026-10'));
const HOJE = date('2026-10-20');
const PLANO = makePlan({
  month: '2026-10',
  expectedIncomeCents: 300000,
  spendingLimitCents: 300000,
  savingsGoalCents: 50000,
});

/** Cenario da v1, sem a transferencia para a reserva. */
function base(): Transaction[] {
  return [
    makeIncome({ amountCents: 300000, date: '2026-10-05', categoryId: 'cat-salario' }),
    makeIncome({
      amountCents: 10000,
      flow: 'transfer',
      date: '2026-10-06',
      categoryId: 'cat-guardado',
    }),
    makeExpense({ amountCents: 120000, date: '2026-10-03', categoryId: 'cat-casa' }),
    makeExpense({ amountCents: 60000, date: '2026-10-10', categoryId: 'cat-mercado' }),
    makeExpense({
      amountCents: 37000,
      date: '2026-10-15',
      categoryId: 'cat-lazer',
      status: 'pending',
    }),
    makeExpense({
      amountCents: 44000,
      date: '2026-10-20',
      categoryId: 'cat-emprestimo',
      debtId: 'divida-1',
    }),
  ];
}

/** R$ 200 para a reserva, no dia 8. */
const PARA_RESERVA = makeExpense({
  amountCents: 20000,
  flow: 'transfer',
  date: '2026-10-08',
  categoryId: 'cat-guardado',
});

function snapshot(transactions: Transaction[]) {
  return buildSnapshot({
    transactions,
    resolver: civilMonthResolver,
    period: OUTUBRO,
    today: HOJE,
    plan: PLANO,
  });
}

describe('cenario completo da v1', () => {
  const com = snapshot([...base(), PARA_RESERVA]);

  it('renda gerada R$ 3.000 e economia do mes R$ 390', () => {
    expect(com.totals.earnedIncome).toBe(300000);
    expect(com.totals.operationalExpense).toBe(261000);
    expect(com.plan.earnedIncomeCents).toBe(300000);
    expect(com.plan.projectedSavingsCents).toBe(39000);
  });

  it('entradas R$ 3.100, saidas R$ 2.810, saldo R$ 290', () => {
    expect(com.totals.income).toBe(310000);
    expect(com.totals.expense).toBe(281000);
    expect(com.totals.balance).toBe(29000);
  });

  it('as duas identidades fecham ao mesmo tempo', () => {
    // Caixa
    expect(subtractMoney(com.totals.income, com.totals.expense)).toBe(com.totals.balance);
    // Atividade economica
    expect(subtractMoney(com.totals.earnedIncome, com.totals.operationalExpense)).toBe(
      com.plan.projectedSavingsCents,
    );
    // E a diferenca entre elas e exatamente o saldo das transferencias.
    expect(com.totals.balance - com.plan.projectedSavingsCents).toBe(
      com.totals.transferIn - com.totals.transferOut,
    );
  });
});

describe('a transferencia de R$ 200 para a reserva', () => {
  const sem = snapshot(base());
  const com = snapshot([...base(), PARA_RESERVA]);

  it('altera o saldo e as saidas', () => {
    expect(com.totals.balance).toBe(sem.totals.balance - 20000);
    expect(com.totals.expense).toBe(sem.totals.expense + 20000);
  });

  it('nao altera gastos operacionais nem o limite do plano', () => {
    expect(com.totals.operationalExpense).toBe(sem.totals.operationalExpense);
    expect(com.plan.committedSpendingCents).toBe(sem.plan.committedSpendingCents);
    expect(com.plan.remainingToSpendCents).toBe(sem.plan.remainingToSpendCents);
  });

  it('nao altera a distribuicao por categoria', () => {
    expect(com.expenseByCategory).toEqual(sem.expenseByCategory);
    expect(com.expenseByCategory.items.map((item) => item.categoryId)).not.toContain(
      'cat-guardado',
    );
  });

  it('nao altera compromissos nem a fatia dos cartoes', () => {
    expect(com.commitments).toEqual(sem.commitments);
  });

  it('nao altera o ritmo de consumo', () => {
    expect(com.projection.dailyBurnCents).toBe(sem.projection.dailyBurnCents);
    expect(com.projection.fixedExpenseCents).toBe(sem.projection.fixedExpenseCents);
    // A projecao e de SALDO: a transferencia ja feita continua no caixa.
    expect(com.projection.projectedBalanceCents).toBe(sem.projection.projectedBalanceCents - 20000);
  });

  it('nao altera a comparacao de gastos com o mes anterior', () => {
    const setembro = [makeExpense({ amountCents: 200000, date: '2026-09-10' })];
    const comparaSem = snapshot([...setembro, ...base()]).comparison;
    const comparaCom = snapshot([...setembro, ...base(), PARA_RESERVA]).comparison;

    expect(comparaCom.operationalExpense).toEqual(comparaSem.operationalExpense);
    expect(comparaCom.earnedIncome).toEqual(comparaSem.earnedIncome);
    // O saldo, que e de caixa, muda.
    expect(comparaCom.balance.current).toBe(comparaSem.balance.current - 20000);
  });

  it('nao altera a economia do mes nem seus percentuais', () => {
    expect(com.plan.projectedSavingsCents).toBe(sem.plan.projectedSavingsCents);
    expect(com.plan.savingsPercentage).toBe(sem.plan.savingsPercentage);
    expect(com.plan.savingsDifferenceCents).toBe(sem.plan.savingsDifferenceCents);
  });

  it('nao altera o Historico, e o Historico concorda com o Planejamento', () => {
    const window = resolveHistoryWindow(civilMonthResolver, month('2026-10'), 6);
    const historico = (transactions: Transaction[]) =>
      buildHistory({
        transactions,
        plans: [PLANO],
        resolver: civilMonthResolver,
        window,
        today: HOJE,
      }).months.at(-1);

    const hSem = historico(base());
    const hCom = historico([...base(), PARA_RESERVA]);

    expect(hCom?.result).toBe(hSem?.result);
    expect(hCom?.operationalExpense).toBe(hSem?.operationalExpense);
    expect(hCom?.result).toBe(com.plan.projectedSavingsCents);
  });
});

describe('invariantes da economia do mes', () => {
  const economia = (transactions: Transaction[]) =>
    snapshot(transactions).plan.projectedSavingsCents;
  const referencia = economia(base());

  it('1. transferir R$ 500 para a reserva nao altera a economia', () => {
    expect(
      economia([
        ...base(),
        makeExpense({ amountCents: 50000, flow: 'transfer', date: '2026-10-11' }),
      ]),
    ).toBe(referencia);
  });

  it('2. retirar R$ 100 da reserva nao altera a economia', () => {
    expect(
      economia([
        ...base(),
        makeIncome({ amountCents: 10000, flow: 'transfer', date: '2026-10-11' }),
      ]),
    ).toBe(referencia);
  });

  it('3. gastar R$ 100 operacionalmente reduz a economia em R$ 100', () => {
    expect(economia([...base(), makeExpense({ amountCents: 10000, date: '2026-10-11' })])).toBe(
      referencia - 10000,
    );
  });

  it('4. receber R$ 100 de renda operacional aumenta a economia em R$ 100', () => {
    expect(economia([...base(), makeIncome({ amountCents: 10000, date: '2026-10-11' })])).toBe(
      referencia + 10000,
    );
  });

  it('5. pendente -> pago nao altera a economia projetada', () => {
    const pagas = base().map((transaction) => ({ ...transaction, status: 'paid' as const }));
    expect(economia(pagas)).toBe(referencia);
  });

  it('6. nenhuma transferencia muda os percentuais da meta', () => {
    const p = snapshot([
      ...base(),
      makeExpense({ amountCents: 70000, flow: 'transfer', date: '2026-10-12' }),
      makeIncome({ amountCents: 30000, flow: 'transfer', date: '2026-10-13' }),
    ]).plan;
    const ref = snapshot(base()).plan;

    expect(p.savingsPercentage).toBe(ref.savingsPercentage);
    expect(p.incomePercentage).toBe(ref.incomePercentage);
    expect(p.spendingPercentage).toBe(ref.spendingPercentage);
    for (const value of [p.savingsPercentage, p.incomePercentage, p.spendingPercentage]) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it('mes so de transferencias: economia zero, nunca NaN', () => {
    const p = snapshot([
      makeIncome({ amountCents: 10000, flow: 'transfer', date: '2026-10-06' }),
      makeExpense({ amountCents: 20000, flow: 'transfer', date: '2026-10-08' }),
    ]).plan;

    expect(p.projectedSavingsCents).toBe(0);
    expect(p.savingsPercentage).toBe(0);
  });
});
