import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { formatMoney } from '../shared/money';
import { roundPercentage } from '../shared/percentage';
import {
  EMPTY_TOTALS,
  calculateTotals,
  hasActivity,
  incomeUsagePercentage,
  isNegativeBalance,
} from './totals';

describe('calculateTotals', () => {
  it('reproduz o cenario do briefing', () => {
    const totais = calculateTotals(briefingScenario());

    expect(formatMoney(totais.income)).toBe('R$ 3.100,00');
    expect(formatMoney(totais.expense)).toBe('R$ 2.610,00');
    expect(formatMoney(totais.balance)).toBe('R$ 490,00');
    expect(totais.transactionCount).toBe(9);
  });

  it('devolve zeros para periodo sem transacoes', () => {
    const totais = calculateTotals([]);

    expect(totais).toEqual(EMPTY_TOTALS);
    expect(totais.balance).toBe(0);
    expect(totais.income).toBe(0);
    expect(Number.isNaN(totais.expense)).toBe(false);
    expect(hasActivity(totais)).toBe(false);
  });

  it('separa realizado de projetado', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 230000, status: 'paid' }),
      makeIncome({ amountCents: 40000, status: 'pending' }),
      makeExpense({ amountCents: 91100, status: 'paid' }),
      makeExpense({ amountCents: 12000, status: 'pending' }),
    ]);

    expect(totais.paidIncome).toBe(230000);
    expect(totais.pendingIncome).toBe(40000);
    expect(totais.paidExpense).toBe(91100);
    expect(totais.pendingExpense).toBe(12000);

    // Realizado: so o que ja passou pela conta.
    expect(totais.realizedBalance).toBe(230000 - 91100);
    // Projetado: tudo que o mes ainda vai movimentar.
    expect(totais.balance).toBe(270000 - 103100);
    expect(totais.pendingCount).toBe(2);
  });

  it('nunca soma valores com sinal invertido', () => {
    // O valor e sempre positivo; o sinal vem do tipo. Duas saidas iguais
    // somam, nunca se cancelam.
    const totais = calculateTotals([
      makeExpense({ amountCents: 50000 }),
      makeExpense({ amountCents: 50000 }),
    ]);
    expect(totais.expense).toBe(100000);
    expect(totais.balance).toBe(-100000);
  });

  it('aceita saldo negativo', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 250000 }),
    ]);

    expect(totais.balance).toBe(-150000);
    expect(isNegativeBalance(totais)).toBe(true);
    expect(formatMoney(totais.balance)).toBe('-R$ 1.500,00');
  });

  it('nao acumula erro em muitas transacoes', () => {
    const transacoes = Array.from({ length: 5000 }, () => makeExpense({ amountCents: 1999 }));
    expect(calculateTotals(transacoes).expense).toBe(5000 * 1999);
  });
});

describe('incomeUsagePercentage', () => {
  it('responde "quanto da renda ja foi usado"', () => {
    const totais = calculateTotals(briefingScenario());
    const uso = incomeUsagePercentage(totais);

    expect(uso).not.toBeNull();
    expect(roundPercentage(uso as number, 1)).toBe(84.2);
  });

  it('devolve null quando nao ha renda registrada', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 50000 })]);
    expect(incomeUsagePercentage(totais)).toBeNull();
  });

  it('devolve null tambem em periodo totalmente vazio', () => {
    expect(incomeUsagePercentage(EMPTY_TOTALS)).toBeNull();
  });

  it('passa de 100% quando se gasta mais do que entrou', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 150000 }),
    ]);
    expect(incomeUsagePercentage(totais)).toBe(150);
  });
});
