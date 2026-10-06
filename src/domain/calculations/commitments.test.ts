import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { roundPercentage } from '../shared/percentage';
import { EMPTY_COMMITMENTS, calculateCommitments } from './commitments';

describe('calculateCommitments', () => {
  it('mede o comprometimento do cenario do briefing', () => {
    const comprometimento = calculateCommitments(briefingScenario());

    expect(comprometimento.cardCents).toBe(37400 + 76500);
    expect(comprometimento.debtCents).toBe(44000);
    expect(comprometimento.committedCents).toBe(157900);
    expect(comprometimento.freeCents).toBe(91100 + 12000);
    expect(comprometimento.totalExpenseCents).toBe(261000);

    // "Cartoes representam 44% dos seus gastos."
    expect(roundPercentage(comprometimento.cardPercentage as number, 0)).toBe(44);
    expect(roundPercentage(comprometimento.committedPercentage as number, 1)).toBe(60.5);
  });

  it('conta divida uma unica vez quando ela esta no cartao', () => {
    // Parcela de emprestimo debitada no credito: sem a precedencia da divida,
    // ela entraria nas duas somas e o "comprometido" passaria de 100%.
    const comprometimento = calculateCommitments([
      makeExpense({ amountCents: 44000, paymentMethod: 'credit', cardId: 'card-x', debtId: 'debt-y' }),
    ]);

    expect(comprometimento.debtCents).toBe(44000);
    expect(comprometimento.cardCents).toBe(0);
    expect(comprometimento.committedCents).toBe(44000);
    expect(comprometimento.committedPercentage).toBe(100);
  });

  it('trata credito sem cartao cadastrado como compromisso de cartao', () => {
    const comprometimento = calculateCommitments([
      makeExpense({ amountCents: 20000, paymentMethod: 'credit' }),
    ]);
    expect(comprometimento.cardCents).toBe(20000);
  });

  it('ignora entradas', () => {
    const comprometimento = calculateCommitments([
      makeIncome({ amountCents: 230000, paymentMethod: 'credit' }),
      makeExpense({ amountCents: 10000, paymentMethod: 'pix' }),
    ]);

    expect(comprometimento.totalExpenseCents).toBe(10000);
    expect(comprometimento.cardCents).toBe(0);
  });

  it('devolve estrutura vazia e percentuais null em periodo sem gastos', () => {
    expect(calculateCommitments([])).toEqual(EMPTY_COMMITMENTS);
    expect(calculateCommitments([]).committedPercentage).toBeNull();
    expect(calculateCommitments([makeIncome({ amountCents: 100000 })]).cardPercentage).toBeNull();
  });

  it('as partes sempre somam o total de gastos', () => {
    const comprometimento = calculateCommitments(briefingScenario());
    expect(comprometimento.cardCents + comprometimento.debtCents + comprometimento.freeCents).toBe(
      comprometimento.totalExpenseCents,
    );
  });
});
