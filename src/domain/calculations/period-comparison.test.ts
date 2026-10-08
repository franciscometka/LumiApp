import { describe, expect, it } from 'vitest';

import { makeExpense, makeIncome } from '../__testing__/factories';
import { roundPercentage } from '../shared/percentage';
import { comparePeriods, isFavorable } from './period-comparison';
import { EMPTY_TOTALS, calculateTotals } from './totals';

describe('comparePeriods', () => {
  it('reproduz a comparacao do briefing: setembro -> outubro', () => {
    const setembro = calculateTotals([makeExpense({ amountCents: 230000 })]);
    const outubro = calculateTotals([makeExpense({ amountCents: 261000 })]);

    const comparacao = comparePeriods(outubro, setembro);

    expect(comparacao.operationalExpense.deltaCents).toBe(31000);
    expect(roundPercentage(comparacao.operationalExpense.changePercentage as number, 1)).toBe(13.5);
    expect(comparacao.operationalExpense.trend).toBe('up');
    expect(comparacao.hasPreviousData).toBe(true);
  });

  it('detecta queda e estabilidade', () => {
    const anterior = calculateTotals([makeExpense({ amountCents: 200000 })]);
    const queda = calculateTotals([makeExpense({ amountCents: 150000 })]);
    const igual = calculateTotals([makeExpense({ amountCents: 200000 })]);

    expect(comparePeriods(queda, anterior).operationalExpense.trend).toBe('down');
    expect(comparePeriods(queda, anterior).operationalExpense.changePercentage).toBe(-25);
    expect(comparePeriods(igual, anterior).operationalExpense.trend).toBe('flat');
    expect(comparePeriods(igual, anterior).operationalExpense.changePercentage).toBe(0);
  });

  it('devolve null no percentual quando o periodo anterior foi vazio', () => {
    const outubro = calculateTotals([
      makeIncome({ amountCents: 310000 }),
      makeExpense({ amountCents: 261000 }),
    ]);

    const comparacao = comparePeriods(outubro, EMPTY_TOTALS);

    expect(comparacao.operationalExpense.changePercentage).toBeNull();
    expect(comparacao.earnedIncome.changePercentage).toBeNull();
    expect(comparacao.balance.changePercentage).toBeNull();
    expect(comparacao.hasPreviousData).toBe(false);

    // Os deltas absolutos continuam corretos e uteis.
    expect(comparacao.operationalExpense.deltaCents).toBe(261000);
    expect(comparacao.operationalExpense.trend).toBe('up');
  });

  it('lida com os dois periodos vazios', () => {
    const comparacao = comparePeriods(EMPTY_TOTALS, EMPTY_TOTALS);

    expect(comparacao.operationalExpense.deltaCents).toBe(0);
    expect(comparacao.operationalExpense.trend).toBe('flat');
    expect(comparacao.operationalExpense.changePercentage).toBeNull();
    expect(comparacao.hasPreviousData).toBe(false);
  });

  it('compara saldos, inclusive atravessando o zero', () => {
    const anterior = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 150000 }),
    ]);
    const atual = calculateTotals([
      makeIncome({ amountCents: 200000 }),
      makeExpense({ amountCents: 150000 }),
    ]);

    const comparacao = comparePeriods(atual, anterior);

    expect(anterior.balance).toBe(-50000);
    expect(atual.balance).toBe(50000);
    expect(comparacao.balance.deltaCents).toBe(100000);
    expect(comparacao.balance.trend).toBe('up');
    expect(comparacao.balance.changePercentage).toBe(200);
  });
});

describe('isFavorable', () => {
  it('inverte a leitura para gastos', () => {
    const anterior = calculateTotals([makeExpense({ amountCents: 200000 })]);
    const maior = comparePeriods(calculateTotals([makeExpense({ amountCents: 300000 })]), anterior);
    const menor = comparePeriods(calculateTotals([makeExpense({ amountCents: 100000 })]), anterior);

    expect(isFavorable(maior.operationalExpense, 'operationalExpense')).toBe(false);
    expect(isFavorable(menor.operationalExpense, 'operationalExpense')).toBe(true);
  });

  it('mantem a leitura direta para entradas e saldo', () => {
    const anterior = calculateTotals([makeIncome({ amountCents: 200000 })]);
    const maior = comparePeriods(calculateTotals([makeIncome({ amountCents: 300000 })]), anterior);

    expect(isFavorable(maior.earnedIncome, 'earnedIncome')).toBe(true);
    expect(isFavorable(maior.balance, 'balance')).toBe(true);
  });

  it('trata estabilidade como neutra-favoravel', () => {
    const comparacao = comparePeriods(EMPTY_TOTALS, EMPTY_TOTALS);
    expect(isFavorable(comparacao.operationalExpense, 'operationalExpense')).toBe(true);
  });
});
