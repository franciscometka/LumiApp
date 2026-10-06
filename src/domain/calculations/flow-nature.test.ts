import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { isOperational, isTransfer, transactionSchema } from '../entities/transaction';
import { formatMoney } from '../shared/money';
import {
  calculateTotals,
  dependsOnTransfers,
  earnedIncomeUsagePercentage,
  incomeUsagePercentage,
} from './totals';

/**
 * O caso que motivou a distincao: usar R$ 100 da reserva nao pode aumentar a
 * renda do mes em R$ 100.
 */
describe('renda gerada x dinheiro disponivel', () => {
  const totais = calculateTotals(briefingScenario());

  it('separa as duas leituras no cenario do briefing', () => {
    expect(formatMoney(totais.income)).toBe('R$ 3.100,00'); // disponivel
    expect(formatMoney(totais.earnedIncome)).toBe('R$ 3.000,00'); // gerado no mes
    expect(formatMoney(totais.transferIn)).toBe('R$ 100,00'); // veio da reserva
  });

  it('o disponivel continua sendo a soma das duas partes', () => {
    expect(totais.earnedIncome + totais.transferIn).toBe(totais.income);
    expect(totais.operationalExpense + totais.transferOut).toBe(totais.expense);
  });

  it('o saldo operacional revela o que o mes de fato produziu', () => {
    // Saldo do caixa: +R$ 490. Mas R$ 100 vieram da reserva, logo o mes
    // sozinho produziu R$ 390.
    expect(formatMoney(totais.balance)).toBe('R$ 490,00');
    expect(formatMoney(totais.operationalBalance)).toBe('R$ 390,00');
  });

  it('expoe que o periodo dependeu de reserva', () => {
    expect(dependsOnTransfers(totais)).toBe(true);
    expect(totais.transferCount).toBe(1);
    expect(dependsOnTransfers(calculateTotals([makeIncome({ amountCents: 100 })]))).toBe(false);
  });

  it('os dois percentuais de uso respondem perguntas diferentes', () => {
    // Sobre o caixa disponivel.
    expect(incomeUsagePercentage(totais)).toBeCloseTo(84.19, 2);
    // Sobre a renda que o mes gerou — sempre o numero mais severo.
    expect(earnedIncomeUsagePercentage(totais)).toBeCloseTo(87, 2);
  });

  it('devolve null nos dois quando nao ha base', () => {
    const soGastos = calculateTotals([makeExpense({ amountCents: 50000 })]);
    expect(incomeUsagePercentage(soGastos)).toBeNull();
    expect(earnedIncomeUsagePercentage(soGastos)).toBeNull();

    // Mes inteiro bancado pela reserva: ha caixa, mas renda gerada e zero.
    const soReserva = calculateTotals([
      makeIncome({ amountCents: 100000, flow: 'transfer' }),
      makeExpense({ amountCents: 50000 }),
    ]);
    expect(incomeUsagePercentage(soReserva)).toBe(50);
    expect(earnedIncomeUsagePercentage(soReserva)).toBeNull();
  });

  it('trata saida que apenas guarda dinheiro como transferencia', () => {
    const totaisComReserva = calculateTotals([
      makeIncome({ amountCents: 300000 }),
      makeExpense({ amountCents: 100000 }),
      makeExpense({ amountCents: 50000, flow: 'transfer', description: 'Guardar sobra' }),
    ]);

    expect(totaisComReserva.expense).toBe(150000);
    expect(totaisComReserva.operationalExpense).toBe(100000);
    expect(totaisComReserva.transferOut).toBe(50000);
    // Guardar dinheiro nao empobrece o mes.
    expect(totaisComReserva.operationalBalance).toBe(200000);
  });
});

describe('compatibilidade do campo flow', () => {
  it('dados sem o campo sao lidos como operacionais — sem migracao', () => {
    const { flow: _flow, ...semFlow } = makeIncome({ amountCents: 230000 });
    const lida = transactionSchema.parse(semFlow);

    expect(lida.flow).toBe('operational');
    expect(calculateTotals([lida]).earnedIncome).toBe(230000);
  });

  it('recusa valor fora do contrato', () => {
    expect(
      transactionSchema.safeParse({ ...makeIncome(), flow: 'investimento' }).success,
    ).toBe(false);
  });

  it('predicados classificam corretamente', () => {
    expect(isTransfer(makeIncome({ flow: 'transfer' }))).toBe(true);
    expect(isOperational(makeIncome({ flow: 'transfer' }))).toBe(false);
    expect(isOperational(makeIncome())).toBe(true);
  });
});
