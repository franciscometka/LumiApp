import { describe, expect, it } from 'vitest';

import { date, makeExpense, makeIncome, makePlan, month } from '../__testing__/factories';
import type { Transaction } from '../entities/transaction';
import { civilMonthResolver } from '../shared/period';
import type { HistoryWindowSize } from './history';
import {
  buildHistory,
  historyPlanStatus,
  isHistoryWindowSize,
  monthDataState,
  resolveHistoryWindow,
  summarizeHistory,
} from './history';
import { monthsToPrepare } from './materialization';
import { buildSnapshot } from './snapshot';

const HOJE = date('2026-10-20');
const OUTUBRO = month('2026-10');

function janela(size: HistoryWindowSize = 6, end = OUTUBRO) {
  return resolveHistoryWindow(civilMonthResolver, end, size);
}

function historico(
  transactions: Transaction[],
  plans = [] as ReturnType<typeof makePlan>[],
  size: HistoryWindowSize = 6,
) {
  return buildHistory({
    transactions,
    plans,
    resolver: civilMonthResolver,
    window: janela(size),
    today: HOJE,
  });
}

/** Um mes "normal": salario, um gasto pago. */
function mesRegistrado(key: string, renda: number, gasto: number): Transaction[] {
  return [
    makeIncome({ amountCents: renda, date: `${key}-05` }),
    makeExpense({ amountCents: gasto, date: `${key}-12` }),
  ];
}

describe('resolveHistoryWindow', () => {
  it('6 meses terminando em outubro sao exatamente maio a outubro', () => {
    expect(janela(6).months).toEqual(
      ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].map(month),
    );
  });

  it('12 meses terminando em outubro comecam em novembro do ano anterior', () => {
    const months = janela(12).months;
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-11');
    expect(months[11]).toBe('2026-10');
    // Sem buraco nem repeticao.
    expect(new Set(months).size).toBe(12);
  });

  it('atravessa dezembro -> janeiro', () => {
    expect(janela(6, month('2027-02')).months).toEqual(
      ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'].map(month),
    );
  });

  it('o periodo cobre do primeiro dia do mais antigo ao ultimo do mais recente', () => {
    const { period } = janela(6);
    expect(period.start).toBe('2026-05-01');
    expect(period.end).toBe('2026-10-31');
  });

  it('o mes de referencia faz parte da identidade da janela', () => {
    expect(janela(6, month('2026-10')).months).not.toEqual(janela(6, month('2026-11')).months);
  });

  it('aceita apenas 6 e 12', () => {
    expect(isHistoryWindowSize(6)).toBe(true);
    expect(isHistoryWindowSize(12)).toBe(true);
    expect(isHistoryWindowSize(3)).toBe(false);
    expect(isHistoryWindowSize('6')).toBe(false);
  });
});

describe('monthsToPrepare', () => {
  it('prepara a janela inteira quando ela termina no mes atual', () => {
    expect(monthsToPrepare(janela(6).months, OUTUBRO)).toEqual(janela(6).months);
  });

  it('nunca prepara meses depois do mes de referencia', () => {
    const futura = janela(6, month('2027-01')).months;
    expect(monthsToPrepare(futura, OUTUBRO)).toEqual(['2026-08', '2026-09', '2026-10'].map(month));
  });

  it('remove repeticoes sem mudar a ordem', () => {
    expect(
      monthsToPrepare([month('2026-09'), month('2026-10'), month('2026-09')], OUTUBRO),
    ).toEqual([month('2026-09'), month('2026-10')]);
  });
});

describe('metricas de cada mes', () => {
  it('usa renda GERADA: a reserva nao e renda', () => {
    const mes = historico([
      makeIncome({ amountCents: 300000, date: '2026-09-05' }),
      makeIncome({ amountCents: 10000, flow: 'transfer', date: '2026-09-06' }),
    ]).months.find((m) => m.month === '2026-09');

    expect(mes?.earnedIncome).toBe(300000);
    // O caixa do mes inclui a reserva — e por isso nao e a metrica daqui.
    expect(mes?.totals.income).toBe(310000);
  });

  it('usa gastos OPERACIONAIS: guardar na reserva nao e gastar', () => {
    const mes = historico([
      makeExpense({ amountCents: 120000, date: '2026-09-10' }),
      makeExpense({ amountCents: 50000, flow: 'transfer', date: '2026-09-28' }),
    ]).months.find((m) => m.month === '2026-09');

    expect(mes?.operationalExpense).toBe(120000);
    expect(mes?.totals.expense).toBe(170000);
  });

  it('resultado = renda gerada - gastos operacionais', () => {
    const mes = historico([
      ...mesRegistrado('2026-09', 300000, 180000),
      makeIncome({ amountCents: 40000, flow: 'transfer', date: '2026-09-20' }),
    ]).months.find((m) => m.month === '2026-09');

    expect(mes?.result).toBe(120000);
    // O saldo do Dashboard incluiria os R$ 400 da reserva.
    expect(mes?.totals.balance).toBe(160000);
  });

  it('mes sem lancamento tem metricas null, nunca R$ 0', () => {
    const mes = historico(mesRegistrado('2026-09', 300000, 100000)).months.find(
      (m) => m.month === '2026-07',
    );

    expect(mes?.dataState).toBe('empty');
    expect(mes?.earnedIncome).toBeNull();
    expect(mes?.operationalExpense).toBeNull();
    expect(mes?.result).toBeNull();
    expect(mes?.isEligible).toBe(false);
  });

  it('a lista sempre tem todos os meses da janela, na ordem', () => {
    const h = historico([], [], 12);
    expect(h.months.map((m) => m.month)).toEqual(h.window.months);
    expect(h.monthsWithData).toBe(0);
  });

  it('ignora lancamentos fora da janela e excluidos', () => {
    const h = historico([
      makeExpense({ amountCents: 999999, date: '2026-04-30' }),
      makeExpense({ amountCents: 888888, date: '2026-11-01' }),
      makeExpense({
        amountCents: 777777,
        date: '2026-09-10',
        deletedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);
    expect(h.monthsWithData).toBe(0);
  });
});

describe('temporalidade e elegibilidade', () => {
  it('o mes atual fica marcado como em andamento e fora do resumo', () => {
    const h = historico(mesRegistrado('2026-10', 300000, 100000));
    const outubro = h.months.at(-1);

    expect(outubro?.temporality).toBe('current');
    expect(outubro?.isEligible).toBe(false);
    expect(h.summary.eligibleCount).toBe(0);
  });

  it('mes passado com registro da pessoa e elegivel', () => {
    const mes = historico(mesRegistrado('2026-09', 300000, 100000)).months.find(
      (m) => m.month === '2026-09',
    );
    expect(mes?.temporality).toBe('past');
    expect(mes?.isEligible).toBe(true);
  });

  it('mes futuro nunca e elegivel', () => {
    const h = buildHistory({
      transactions: mesRegistrado('2026-11', 300000, 100000),
      plans: [],
      resolver: civilMonthResolver,
      window: janela(6, month('2026-11')),
      today: HOJE,
    });
    const novembro = h.months.at(-1);
    expect(novembro?.temporality).toBe('future');
    expect(novembro?.isEligible).toBe(false);
  });

  it('mes so com recorrencias geradas e pendentes nao e mes realizado', () => {
    const geradas = [
      makeExpense({
        amountCents: 12000,
        date: '2026-06-10',
        recurringBillId: 'bill-internet',
        status: 'pending',
      }),
    ];
    const mes = historico(geradas).months.find((m) => m.month === '2026-06');

    expect(mes?.dataState).toBe('generated_only');
    // Os numeros existem — sao os mesmos do Dashboard de junho...
    expect(mes?.operationalExpense).toBe(12000);
    // ...mas nao fazem de junho o "melhor mes".
    expect(mes?.isEligible).toBe(false);
  });

  it('recorrencia confirmada como paga ja e registro da pessoa', () => {
    expect(
      monthDataState([
        makeExpense({ recurringBillId: 'bill-internet', status: 'paid', date: '2026-06-10' }),
      ]),
    ).toBe('recorded');
  });
});

describe('resumo', () => {
  it('com menos de 2 meses encerrados elegiveis nao ha media nem ranking', () => {
    const h = historico([
      ...mesRegistrado('2026-09', 300000, 100000),
      // Mes atual nao conta.
      ...mesRegistrado('2026-10', 300000, 900000),
    ]);

    expect(h.summary.eligibleCount).toBe(1);
    expect(h.summary.isAvailable).toBe(false);
    expect(h.summary.averageEarnedIncome).toBeNull();
    expect(h.summary.averageOperationalExpense).toBeNull();
    expect(h.summary.best).toBeNull();
    expect(h.summary.worst).toBeNull();
  });

  it('media sobre os elegiveis apenas — vazios nao puxam para baixo', () => {
    const h = historico([
      ...mesRegistrado('2026-08', 300000, 100000),
      ...mesRegistrado('2026-09', 200000, 200000),
      // Julho vazio, junho so gerado, outubro em andamento: todos fora.
      makeExpense({
        amountCents: 12000,
        date: '2026-06-10',
        recurringBillId: 'b',
        status: 'pending',
      }),
      ...mesRegistrado('2026-10', 999900, 999900),
    ]);

    expect(h.summary.eligibleCount).toBe(2);
    expect(h.summary.averageEarnedIncome).toBe(250000);
    expect(h.summary.averageOperationalExpense).toBe(150000);
  });

  it('melhor/pior = maior/menor resultado entre os elegiveis', () => {
    const h = historico([
      ...mesRegistrado('2026-07', 300000, 280000), // +200
      ...mesRegistrado('2026-08', 300000, 100000), // +2.000
      ...mesRegistrado('2026-09', 300000, 350000), // -500
    ]);

    expect(h.summary.best).toEqual({ month: '2026-08', result: 200000 });
    expect(h.summary.worst).toEqual({ month: '2026-09', result: -50000 });
  });

  it('empate no resultado favorece o mes mais recente', () => {
    const h = historico([
      ...mesRegistrado('2026-07', 300000, 100000), // +2.000
      ...mesRegistrado('2026-08', 300000, 100000), // +2.000
      ...mesRegistrado('2026-09', 300000, 250000), // +500
    ]);

    expect(h.summary.best?.month).toBe('2026-08');
    expect(h.summary.worst?.month).toBe('2026-09');
  });

  it('todos empatados: nao ha melhor nem pior', () => {
    const h = historico([
      ...mesRegistrado('2026-08', 300000, 100000),
      ...mesRegistrado('2026-09', 300000, 100000),
    ]);

    expect(h.summary.isAvailable).toBe(true);
    expect(h.summary.best).toBeNull();
    expect(h.summary.worst).toBeNull();
  });

  it('media arredonda para centavo inteiro', () => {
    const h = historico([
      ...mesRegistrado('2026-07', 100, 0 + 1),
      ...mesRegistrado('2026-08', 100, 1),
      ...mesRegistrado('2026-09', 101, 1),
    ]);
    expect(Number.isInteger(h.summary.averageEarnedIncome)).toBe(true);
    expect(h.summary.averageEarnedIncome).toBe(100);
  });

  it('summarizeHistory de lista vazia nao quebra', () => {
    expect(summarizeHistory([]).isAvailable).toBe(false);
  });
});

describe('planejamento', () => {
  it('situacao do plano por mes vem de calculatePlanProgress', () => {
    const h = historico(
      [...mesRegistrado('2026-08', 300000, 100000), ...mesRegistrado('2026-09', 300000, 300000)],
      [
        makePlan({ month: '2026-08', spendingLimitCents: 200000 }),
        makePlan({ month: '2026-09', spendingLimitCents: 200000 }),
        makePlan({ month: '2026-07', spendingLimitCents: 0, savingsGoalCents: 10000 }),
      ],
    );
    const status = Object.fromEntries(h.months.map((m) => [m.month, m.planStatus]));

    expect(status['2026-08']).toBe('within_limit');
    expect(status['2026-09']).toBe('over_limit');
    expect(status['2026-07']).toBe('no_limit');
    expect(status['2026-06']).toBe('none');
  });

  it('plano sem transacoes e contexto, nao torna o mes realizado', () => {
    const mes = historico([], [makePlan({ month: '2026-09' })]).months.find(
      (m) => m.month === '2026-09',
    );

    expect(mes?.planStatus).toBe('within_limit');
    expect(mes?.dataState).toBe('empty');
    expect(mes?.isEligible).toBe(false);
    expect(mes?.result).toBeNull();
  });

  it('plano excluido logicamente nao conta', () => {
    const mes = historico(
      [],
      [makePlan({ month: '2026-09', deletedAt: '2026-10-01T00:00:00.000Z' })],
    ).months.find((m) => m.month === '2026-09');
    expect(mes?.planStatus).toBe('none');
  });

  it('historyPlanStatus sem plano e "none"', () => {
    const h = historico([]);
    expect(historyPlanStatus(h.months[0]!.plan)).toBe('none');
  });
});

describe('consistencia com o Dashboard', () => {
  /**
   * O Historico nao tem formula propria. Para o mesmo MonthKey e os mesmos
   * dados, os totais e o progresso do plano tem de ser IDENTICOS aos do
   * snapshot que o Dashboard exibe — metrica por metrica, nao conceito
   * parecido contra conceito parecido.
   */
  it('totais e plano de cada mes sao os mesmos do snapshot daquele mes', () => {
    const transactions = [
      ...mesRegistrado('2026-08', 300000, 120000),
      makeIncome({ amountCents: 10000, flow: 'transfer', date: '2026-08-20' }),
      makeExpense({ amountCents: 30000, status: 'pending', date: '2026-09-15' }),
      makeExpense({ amountCents: 45000, flow: 'transfer', date: '2026-09-28' }),
      ...mesRegistrado('2026-10', 310000, 90000),
    ];
    const plans = [
      makePlan({ month: '2026-08', spendingLimitCents: 100000 }),
      makePlan({ month: '2026-10' }),
    ];

    const h = historico(transactions, plans);

    for (const entry of h.months) {
      const snapshot = buildSnapshot({
        transactions,
        resolver: civilMonthResolver,
        period: civilMonthResolver.resolve(entry.month),
        today: HOJE,
        plan: plans.find((plan) => plan.month === entry.month) ?? null,
      });

      expect(entry.totals).toEqual(snapshot.totals);
      expect(entry.plan).toEqual(snapshot.plan);
      expect(entry.temporality).toBe(snapshot.temporality);

      if (entry.dataState !== 'empty') {
        expect(entry.earnedIncome).toBe(snapshot.totals.earnedIncome);
        expect(entry.operationalExpense).toBe(snapshot.totals.operationalExpense);
        expect(entry.result).toBe(snapshot.totals.operationalBalance);
      }
    }
  });
});

describe('Historico e Planejamento classificam o mesmo mes igual', () => {
  it('reserva guardada nao faz o mes "fechar acima do limite"', () => {
    // Julho: gasto operacional 890 < limite 1.000, mas 500 foram para a reserva.
    const transactions = [
      makeIncome({ amountCents: 300000, date: '2026-07-05' }),
      makeExpense({ amountCents: 89000, date: '2026-07-12' }),
      makeExpense({ amountCents: 50000, flow: 'transfer', date: '2026-07-28' }),
    ];
    const plan = makePlan({ month: '2026-07', spendingLimitCents: 100000, savingsGoalCents: 0 });

    const julho = historico(transactions, [plan]).months.find((m) => m.month === '2026-07');
    const snapshot = buildSnapshot({
      transactions,
      resolver: civilMonthResolver,
      period: civilMonthResolver.resolve(month('2026-07')),
      today: HOJE,
      plan,
    });

    expect(julho?.planStatus).toBe('within_limit');
    expect(historyPlanStatus(snapshot.plan)).toBe('within_limit');
    // A mesma metrica dos dois lados: o gasto do plano e o gasto da linha.
    expect(julho?.plan.committedSpendingCents).toBe(julho?.operationalExpense);
    expect(snapshot.plan.remainingToSpendCents).toBe(11000);
  });
});
