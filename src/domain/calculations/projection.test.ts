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
    const transacoes = [makeExpense({ amountCents: 100000, date: '2026-10-05' })];
    const totais = calculateTotals(transacoes);

    // R$ 1.000 em 10 dias = R$ 100/dia; faltam 21 dias.
    const projecao = calculateProjection({
      totals: totais,
      period: outubro,
      today: date('2026-10-10'),
      transactions: transacoes,
    });

    expect(projecao.totalDays).toBe(31);
    expect(projecao.elapsedDays).toBe(10);
    expect(projecao.remainingDays).toBe(21);
    expect(projecao.dailyBurnCents).toBe(10000);
    expect(projecao.projectedExpenseCents).toBe(310000);
  });

  it('projeta o cenario do briefing', () => {
    const transacoes = briefingScenario();
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-20'),
      transactions: transacoes,
    });

    expect(projecao.elapsedDays).toBe(20);
    // Variavel decorrido: R$ 2.610 menos a parcela da divida (R$ 440).
    expect(projecao.dailyBurnCents).toBe(10850); // 217000 / 20
    expect(projecao.projectedExpenseCents).toBe(261000 + 10850 * 11);
  });

  it('nao quebra em periodo sem transacoes', () => {
    const projecao = calculateProjection({
      totals: EMPTY_TOTALS,
      period: outubro,
      today: date('2026-10-15'),
      transactions: [],
    });

    expect(projecao.dailyBurnCents).toBe(0);
    expect(projecao.projectedExpenseCents).toBe(0);
    expect(projecao.projectedBalanceCents).toBe(0);
    expect(projecao.dailyAllowanceCents).toBe(0);
  });

  it('nao divide por zero no primeiro dia do periodo', () => {
    const transacoes = [makeExpense({ amountCents: 50000, date: '2026-10-01' })];
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-01'),
      transactions: transacoes,
    });

    expect(projecao.elapsedDays).toBe(1);
    expect(projecao.dailyBurnCents).toBe(50000);
    expect(projecao.projectedExpenseCents).toBe(1550000);
  });

  it('devolve null na mesada diaria quando nao resta dia nenhum', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 310000 }),
      makeExpense({ amountCents: 261000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-31'), transactions: [] });

    expect(projecao.remainingDays).toBe(0);
    expect(projecao.dailyAllowanceCents).toBeNull();
  });

  it('calcula quanto cabe por dia nos dias restantes', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 310000 }),
      makeExpense({ amountCents: 261000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-21'), transactions: [] });

    expect(projecao.remainingDays).toBe(10);
    expect(projecao.dailyAllowanceCents).toBe(4900); // R$ 490 / 10 dias
  });

  it('zera a mesada quando o saldo esta negativo', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 300000 }),
    ]);
    const projecao = calculateProjection({ totals: totais, period: outubro, today: date('2026-10-21'), transactions: [] });

    expect(projecao.dailyAllowanceCents).toBe(0);
  });

  it('nao produz numero negativo quando a data esta fora do periodo', () => {
    const transacoes = [makeExpense({ amountCents: 100000, date: '2026-10-05' })];
    const totais = calculateTotals(transacoes);

    const antes = calculateProjection({ totals: totais, period: outubro, today: date('2026-09-15'), transactions: transacoes });
    expect(antes.elapsedDays).toBe(0);
    expect(antes.remainingDays).toBe(31);
    expect(antes.dailyBurnCents).toBe(0);
    expect(antes.projectedExpenseCents).toBe(100000);

    const depois = calculateProjection({ totals: totais, period: outubro, today: date('2026-12-01'), transactions: transacoes });
    expect(depois.elapsedDays).toBe(31);
    expect(depois.remainingDays).toBe(0);
  });

  it('usa a duracao correta em fevereiro', () => {
    const transacoes = [makeExpense({ amountCents: 140000, date: '2026-02-01' })];
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: fevereiro,
      today: date('2026-02-14'),
      transactions: transacoes,
    });

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

describe('fixo x variavel', () => {
  it('nao extrapola compromissos que acontecem uma vez por mes', () => {
    // Nesta fixture apenas o emprestimo carrega vinculo (`debtId`). Basta
    // para o ponto: uma parcela que acontece UMA vez no mes nao pode virar
    // ritmo diario. No seed real a internet tambem e vinculada, e a separacao
    // melhora conforme mais recorrencias sao cadastradas.
    const totais = calculateTotals(briefingScenario());
    const semVinculos = calculateProjection({
      totals: totais,
      period: outubro,
      today: date('2026-10-20'),
      transactions: briefingScenario().map((t) => ({ ...t, debtId: undefined, recurringBillId: undefined })),
    });
    const comVinculos = calculateProjection({
      totals: totais,
      period: outubro,
      today: date('2026-10-20'),
      transactions: briefingScenario(),
    });

    // Sem a separacao, as contas fixas entram no ritmo diario e inflam a
    // previsao — o erro que fazia a tela anunciar um fechamento negativo.
    expect(semVinculos.fixedExpenseCents).toBe(0);
    expect(comVinculos.fixedExpenseCents).toBe(44000);

    expect(comVinculos.dailyBurnCents).toBeLessThan(semVinculos.dailyBurnCents);
    expect(comVinculos.projectedExpenseCents).toBeLessThan(semVinculos.projectedExpenseCents);
    expect(comVinculos.projectedBalanceCents).toBeGreaterThan(semVinculos.projectedBalanceCents);
  });

  it('preserva o que ja foi gasto e estima apenas os dias que faltam', () => {
    const transacoes = [
      makeExpense({ amountCents: 100000, date: '2026-10-05', recurringBillId: 'rec-1' }),
      makeExpense({ amountCents: 20000, date: '2026-10-06' }),
    ];
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-10'),
      transactions: transacoes,
    });

    // Variavel: R$ 200 em 10 dias = R$ 20/dia. Faltam 21 dias.
    expect(projecao.fixedExpenseCents).toBe(100000);
    expect(projecao.dailyBurnCents).toBe(2000);
    expect(projecao.projectedExpenseCents).toBe(120000 + 2000 * 21);
  });

  it('nunca projeta menos do que ja foi gasto', () => {
    const transacoes = [
      makeExpense({ amountCents: 300000, date: '2026-10-05', debtId: 'debt-1' }),
    ];
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-10'),
      transactions: transacoes,
    });

    expect(projecao.dailyBurnCents).toBe(0);
    expect(projecao.projectedExpenseCents).toBe(300000);
  });
});

describe('lancamentos com data futura dentro do mes', () => {
  it('nao entram no ritmo diario', () => {
    // No dia 5, uma fatura que vence dia 28 ja esta registrada mas ainda nao
    // foi gasta. Conta-la no ritmo fazia a tela projetar um rombo inexistente.
    const transacoes = [
      makeIncome({ amountCents: 310000, date: '2026-10-01' }),
      makeExpense({ amountCents: 200000, date: '2026-10-28' }),
    ];
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-05'),
      transactions: transacoes,
    });

    expect(projecao.dailyBurnCents).toBe(0);
    // A despesa agendada continua contando no total projetado — ela e um fato.
    expect(projecao.projectedExpenseCents).toBe(200000);
    expect(projecao.projectedBalanceCents).toBe(110000);
  });

  it('passam a contar assim que a data chega', () => {
    const transacoes = [makeExpense({ amountCents: 100000, date: '2026-10-05' })];
    const base = { totals: calculateTotals(transacoes), period: outubro, transactions: transacoes };

    expect(calculateProjection({ ...base, today: date('2026-10-04') }).dailyBurnCents).toBe(0);
    expect(calculateProjection({ ...base, today: date('2026-10-05') }).dailyBurnCents).toBe(20000);
  });

  it('o cenario do briefing no dia 5 projeta o saldo real, nao um rombo', () => {
    const transacoes = briefingScenario();
    const projecao = calculateProjection({
      totals: calculateTotals(transacoes),
      period: outubro,
      today: date('2026-10-05'),
      transactions: transacoes,
    });

    // Nada variavel foi gasto ate o dia 5: a projecao e o proprio saldo.
    expect(projecao.dailyBurnCents).toBe(0);
    expect(projecao.projectedBalanceCents).toBe(49000);
  });
});
