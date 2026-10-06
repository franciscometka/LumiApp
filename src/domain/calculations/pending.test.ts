import { describe, expect, it } from 'vitest';

import { date, makeExpense, makeIncome } from '../__testing__/factories';
import { EMPTY_PENDING, calculatePending, isOverdue } from './pending';

const hoje = date('2026-10-15');

describe('calculatePending', () => {
  it('soma apenas saidas pendentes', () => {
    const resumo = calculatePending(
      [
        makeExpense({ amountCents: 12000, status: 'pending', date: '2026-10-20' }),
        makeExpense({ amountCents: 44000, status: 'pending', date: '2026-10-25' }),
        makeExpense({ amountCents: 91100, status: 'paid', date: '2026-10-08' }),
        makeIncome({ amountCents: 230000, status: 'pending', date: '2026-10-30' }),
      ],
      { today: hoje },
    );

    // O salario que ainda nao caiu nao e uma conta a pagar.
    expect(resumo.totalCents).toBe(56000);
    expect(resumo.count).toBe(2);
  });

  it('separa vencido de a vencer', () => {
    const resumo = calculatePending(
      [
        makeExpense({ amountCents: 12000, status: 'pending', date: '2026-10-10' }),
        makeExpense({ amountCents: 20000, status: 'pending', date: '2026-10-14' }),
        makeExpense({ amountCents: 44000, status: 'pending', date: '2026-10-25' }),
      ],
      { today: hoje },
    );

    expect(resumo.overdueCents).toBe(32000);
    expect(resumo.overdueCount).toBe(2);
    expect(resumo.totalCents).toBe(76000);
  });

  it('conta hoje como a vencer, nao como vencido', () => {
    const resumo = calculatePending(
      [makeExpense({ amountCents: 10000, status: 'pending', date: '2026-10-15' })],
      { today: hoje },
    );

    expect(resumo.overdueCount).toBe(0);
    expect(resumo.dueSoonCount).toBe(1);
  });

  it('respeita a janela de "vence em breve"', () => {
    const transacoes = [
      makeExpense({ amountCents: 10000, status: 'pending', date: '2026-10-18' }),
      makeExpense({ amountCents: 20000, status: 'pending', date: '2026-10-22' }),
      makeExpense({ amountCents: 30000, status: 'pending', date: '2026-10-31' }),
    ];

    const padrao = calculatePending(transacoes, { today: hoje });
    expect(padrao.dueSoonCents).toBe(30000); // 7 dias: ate 22/10
    expect(padrao.dueSoonCount).toBe(2);

    const curta = calculatePending(transacoes, { today: hoje, dueSoonDays: 3 });
    expect(curta.dueSoonCount).toBe(1);

    const longa = calculatePending(transacoes, { today: hoje, dueSoonDays: 30 });
    expect(longa.dueSoonCount).toBe(3);

    const zero = calculatePending(transacoes, { today: hoje, dueSoonDays: 0 });
    expect(zero.dueSoonCount).toBe(0);
  });

  it('ordena por vencimento e expoe a proxima conta', () => {
    const resumo = calculatePending(
      [
        makeExpense({ amountCents: 30000, status: 'pending', date: '2026-10-31' }),
        makeExpense({ amountCents: 10000, status: 'pending', date: '2026-10-18' }),
        makeExpense({ amountCents: 20000, status: 'pending', date: '2026-10-22' }),
      ],
      { today: hoje },
    );

    expect(resumo.items.map((item) => item.date)).toEqual([
      '2026-10-18',
      '2026-10-22',
      '2026-10-31',
    ]);
    expect(resumo.nextDue?.amountCents).toBe(10000);
  });

  it('devolve resumo vazio quando nao ha pendencias', () => {
    expect(calculatePending([], { today: hoje })).toEqual(EMPTY_PENDING);
    expect(calculatePending([], { today: hoje }).nextDue).toBeNull();
    expect(
      calculatePending([makeExpense({ status: 'paid' })], { today: hoje }).count,
    ).toBe(0);
  });

  it('atravessa a virada de mes na janela', () => {
    const resumo = calculatePending(
      [makeExpense({ amountCents: 10000, status: 'pending', date: '2026-11-02' })],
      { today: date('2026-10-30'), dueSoonDays: 7 },
    );

    expect(resumo.dueSoonCount).toBe(1);
  });
});

describe('isOverdue', () => {
  it('so considera saida pendente com data passada', () => {
    expect(isOverdue(makeExpense({ status: 'pending', date: '2026-10-10' }), hoje)).toBe(true);
    expect(isOverdue(makeExpense({ status: 'pending', date: '2026-10-15' }), hoje)).toBe(false);
    expect(isOverdue(makeExpense({ status: 'paid', date: '2026-10-10' }), hoje)).toBe(false);
    expect(isOverdue(makeIncome({ status: 'pending', date: '2026-10-10' }), hoje)).toBe(false);
  });
});
