import { describe, expect, it } from 'vitest';

import { briefingScenario, date, makeExpense, makeIncome } from '../__testing__/factories';
import { civilMonthResolver } from '../shared/period';
import { toMonthKey } from '../shared/plain-date';
import {
  calculateProjection,
  calculateSalaryRunway,
  nextSalaryDate,
} from './projection';
import { EMPTY_TOTALS, calculateTotals } from './totals';

const outubro = civilMonthResolver.resolve(toMonthKey('2026-10'));
const fevereiro = civilMonthResolver.resolve(toMonthKey('2026-02'));

describe('calculateProjection', () => {
  it('projeta o fechamento a partir do ritmo de gasto', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 100000, date: '2026-10-05' })]);

    // R$ 1.000 em 10 dias = R$ 100/dia; 31 dias => R$ 3.100 projetados.
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-10') });

    expect(projecao.totalDays).toBe(31);
    expect(projecao.elapsedDays).toBe(10);
    expect(projecao.remainingDays).toBe(21);
    expect(projecao.dailyBurnCents).toBe(10000);
    expect(projecao.projectedExpenseCents).toBe(310000);
  });

  it('projeta o cenario do briefing', () => {
    const totais = calculateTotals(briefingScenario());
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-20') });

    expect(projecao.elapsedDays).toBe(20);
    expect(projecao.dailyBurnCents).toBe(13050); // 261000 / 20
    expect(projecao.projectedExpenseCents).toBe(404550); // 13050 * 31
    expect(projecao.projectedBalanceCents).toBe(310000 - 404550);
  });

  it('nao quebra em periodo sem transacoes', () => {
    const projecao = calculateProjection({
      totals: EMPTY_TOTALS,
      period: outubro,
      today: date('2026-10-15'),
    });

    expect(projecao.dailyBurnCents).toBe(0);
    expect(projecao.projectedExpenseCents).toBe(0);
    expect(projecao.projectedBalanceCents).toBe(0);
    expect(projecao.dailyAllowanceCents).toBe(0);
  });

  it('nao divide por zero no primeiro dia do periodo', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 50000, date: '2026-10-01' })]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-01') });

    expect(projecao.elapsedDays).toBe(1);
    expect(projecao.dailyBurnCents).toBe(50000);
    expect(projecao.projectedExpenseCents).toBe(1550000);
  });

  it('devolve null na mesada diaria quando nao resta dia nenhum', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 310000 }),
      makeExpense({ amountCents: 261000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-31') });

    expect(projecao.remainingDays).toBe(0);
    expect(projecao.dailyAllowanceCents).toBeNull();
  });

  it('calcula quanto cabe por dia nos dias restantes', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 310000 }),
      makeExpense({ amountCents: 261000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-21') });

    expect(projecao.remainingDays).toBe(10);
    expect(projecao.dailyAllowanceCents).toBe(4900); // R$ 490 / 10 dias
  });

  it('zera a mesada quando o saldo esta negativo', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 300000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-21') });

    expect(projecao.dailyAllowanceCents).toBe(0);
  });

  it('nao produz numero negativo quando a data esta fora do periodo', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 100000 })]);

    const antes = calculateProjection({ totals: totais, period: outubro, today: date('2026-09-15') });
    expect(antes.elapsedDays).toBe(0);
    expect(antes.remainingDays).toBe(31);
    expect(antes.dailyBurnCents).toBe(0);
    expect(antes.projectedExpenseCents).toBe(100000);

    const depois = calculateProjection({ totals: totais, period: outubro, today: date('2026-12-01') });
    expect(depois.elapsedDays).toBe(31);
    expect(depois.remainingDays).toBe(0);
  });

  it('usa a duracao correta em fevereiro', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 140000, date: '2026-02-01' })]);
    const projecao = calculateProjection({ totals: totais, period: fevereiro, today: date('2026-02-14') });

    expect(projecao.totalDays).toBe(28);
    expect(projecao.dailyBurnCents).toBe(10000);
    expect(projecao.projectedExpenseCents).toBe(280000);
  });
});

describe('nextSalaryDate', () => {
  it('aponta para o mes corrente quando o dia ainda nao chegou', () => {
    expect(nextSalaryDate(date('2026-10-01'), 5)).toBe('2026-10-05');
    expect(nextSalaryDate(date('2026-10-05'), 5)).toBe('2026-10-05');
  });

  it('pula para o mes seguinte quando o dia ja passou', () => {
    expect(nextSalaryDate(date('2026-10-06'), 5)).toBe('2026-11-05');
    expect(nextSalaryDate(date('2026-12-20'), 5)).toBe('2027-01-05');
  });

  it('limita o dia 31 ao ultimo dia do mes', () => {
    // Sem a trava, "dia 31" em fevereiro transbordaria para 2 ou 3 de marco.
    expect(nextSalaryDate(date('2026-02-01'), 31)).toBe('2026-02-28');
    expect(nextSalaryDate(date('2024-02-01'), 31)).toBe('2024-02-29');
    expect(nextSalaryDate(date('2026-04-15'), 31)).toBe('2026-04-30');
    expect(nextSalaryDate(date('2026-01-31'), 31)).toBe('2026-01-31');
    expect(nextSalaryDate(date('2026-02-28'), 31)).toBe('2026-02-28');
  });
});

describe('calculateSalaryRunway', () => {
  it('responde "quanto posso gastar ate o proximo salario"', () => {
    const totais = calculateTotals(briefingScenario());
    const folego = calculateSalaryRunway(totais, date('2026-10-26'), 5);

    expect(folego.nextSalaryDate).toBe('2026-11-05');
    expect(folego.daysUntilSalary).toBe(10);
    expect(folego.availableCents).toBe(49000);
    expect(folego.dailyAllowanceCents).toBe(4900);
  });

  it('devolve null na mesada quando o salario cai hoje', () => {
    const totais = calculateTotals(briefingScenario());
    const folego = calculateSalaryRunway(totais, date('2026-10-05'), 5);

    expect(folego.daysUntilSalary).toBe(0);
    expect(folego.dailyAllowanceCents).toBeNull();
  });

  it('nunca distribui saldo negativo', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 300000 }),
    ]);
    const folego = calculateSalaryRunway(totais, date('2026-10-01'), 5);

    expect(folego.availableCents).toBe(0);
    expect(folego.dailyAllowanceCents).toBe(0);
  });

  it('atravessa a virada de ano', () => {
    const folego = calculateSalaryRunway(EMPTY_TOTALS, date('2026-12-28'), 5);
    expect(folego.nextSalaryDate).toBe('2027-01-05');
    expect(folego.daysUntilSalary).toBe(8);
  });
});
