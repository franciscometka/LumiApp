import { describe, expect, it } from 'vitest';

import { briefingScenario, date, makeExpense, makePlan } from '../__testing__/factories';
import { formatMoney } from '../shared/money';
import { civilMonthResolver } from '../shared/period';
import { toMonthKey } from '../shared/plain-date';
import { buildSnapshot } from './snapshot';

const outubro = civilMonthResolver.resolve(toMonthKey('2026-10'));

function snapshotPadrao() {
  return buildSnapshot({
    transactions: briefingScenario(),
    resolver: civilMonthResolver,
    period: outubro,
    today: date('2026-10-20'),
    plan: makePlan({ expectedIncomeCents: 300000, spendingLimitCents: 250000, savingsGoalCents: 50000 }),
    salaryDay: 5,
  });
}

describe('buildSnapshot', () => {
  it('responde as perguntas centrais do app de uma vez so', () => {
    const snapshot = snapshotPadrao();

    // Quanto entrou / quanto gastei / quanto sobrou
    expect(formatMoney(snapshot.totals.income)).toBe('R$ 3.100,00');
    expect(formatMoney(snapshot.totals.expense)).toBe('R$ 2.610,00');
    expect(formatMoney(snapshot.totals.balance)).toBe('R$ 490,00');

    // Onde estou gastando mais
    expect(snapshot.expenseByCategory.largest?.categoryId).toBe('cat-cartao');

    // Quanto esta comprometido
    expect(snapshot.commitments.committedCents).toBe(157900);

    // Quanto posso gastar ate o proximo salario
    expect(snapshot.salaryRunway?.nextSalaryDate).toBe('2026-11-05');
  });

  it('recorta o periodo e ignora o que esta fora dele', () => {
    const snapshot = buildSnapshot({
      transactions: [
        ...briefingScenario(),
        makeExpense({ amountCents: 999999, date: '2026-09-15' }),
        makeExpense({ amountCents: 888888, date: '2026-11-15' }),
      ],
      resolver: civilMonthResolver,
      period: outubro,
      today: date('2026-10-20'),
    });

    expect(snapshot.transactions).toHaveLength(9);
    expect(snapshot.totals.expense).toBe(261000);
  });

  it('compara automaticamente com o periodo anterior', () => {
    const snapshot = buildSnapshot({
      transactions: [
        makeExpense({ amountCents: 261000, date: '2026-10-10' }),
        makeExpense({ amountCents: 230000, date: '2026-09-10' }),
      ],
      resolver: civilMonthResolver,
      period: outubro,
      today: date('2026-10-20'),
    });

    expect(snapshot.comparison.operationalExpense.previous).toBe(230000);
    expect(snapshot.comparison.operationalExpense.deltaCents).toBe(31000);
    expect(snapshot.comparison.hasPreviousData).toBe(true);
  });

  it('todas as metricas falam do mesmo recorte', () => {
    const snapshot = snapshotPadrao();

    // Distribuicoes, compromissos e plano falam de atividade OPERACIONAL; o
    // briefing tem R$ 100 vindos da reserva, que nao entram em nenhum deles.
    expect(snapshot.totals.operationalExpense).toBe(snapshot.commitments.totalExpenseCents);
    expect(snapshot.totals.operationalExpense).toBe(snapshot.expenseByCategory.totalCents);
    expect(snapshot.totals.earnedIncome).toBe(snapshot.incomeByCategory.totalCents);
    expect(snapshot.plan.committedSpendingCents).toBe(snapshot.totals.operationalExpense);
  });

  it('nao quebra em periodo totalmente vazio', () => {
    const snapshot = buildSnapshot({
      transactions: [],
      resolver: civilMonthResolver,
      period: outubro,
      today: date('2026-10-20'),
    });

    expect(snapshot.totals.balance).toBe(0);
    expect(snapshot.expenseByCategory.items).toHaveLength(0);
    expect(snapshot.expenseByCategory.largest).toBeNull();
    expect(snapshot.commitments.committedPercentage).toBeNull();
    expect(snapshot.pending.nextDue).toBeNull();
    expect(snapshot.plan.hasPlan).toBe(false);
    expect(snapshot.projection.dailyBurnCents).toBe(0);
    expect(snapshot.comparison.hasPreviousData).toBe(false);
    expect(snapshot.salaryRunway).toBeNull();
  });

  it('omite o folego de salario quando o dia nao foi informado', () => {
    const snapshot = buildSnapshot({
      transactions: briefingScenario(),
      resolver: civilMonthResolver,
      period: outubro,
      today: date('2026-10-20'),
    });

    expect(snapshot.salaryRunway).toBeNull();
  });

  it('usa o resolver injetado para achar o periodo anterior', () => {
    // Prova de que o ciclo e plugavel: trocar o resolver muda a comparacao
    // sem tocar em nenhuma funcao de calculo.
    const resolverInvertido = {
      ...civilMonthResolver,
      id: 'teste-dois-meses-atras',
      previous: (key: typeof outubro.key) => civilMonthResolver.previous(civilMonthResolver.previous(key)),
    };

    const snapshot = buildSnapshot({
      transactions: [
        makeExpense({ amountCents: 100000, date: '2026-10-10' }),
        makeExpense({ amountCents: 777000, date: '2026-09-10' }),
        makeExpense({ amountCents: 555000, date: '2026-08-10' }),
      ],
      resolver: resolverInvertido,
      period: outubro,
      today: date('2026-10-20'),
    });

    expect(snapshot.comparison.operationalExpense.previous).toBe(555000);
  });

  it('atravessa a virada de ano ao buscar o periodo anterior', () => {
    const janeiro = civilMonthResolver.resolve(toMonthKey('2027-01'));
    const snapshot = buildSnapshot({
      transactions: [
        makeExpense({ amountCents: 100000, date: '2027-01-10' }),
        makeExpense({ amountCents: 200000, date: '2026-12-10' }),
      ],
      resolver: civilMonthResolver,
      period: janeiro,
      today: date('2027-01-20'),
    });

    expect(snapshot.comparison.operationalExpense.previous).toBe(200000);
  });
});
