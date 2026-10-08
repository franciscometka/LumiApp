import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome, makePlan } from '../__testing__/factories';

import { EMPTY_PLAN_PROGRESS, calculatePlanCoherence, calculatePlanProgress } from './plan-progress';
import { EMPTY_TOTALS, calculateTotals } from './totals';

/** Plano do briefing: espera 3.000, limita 2.500, quer guardar 500. */
const PLANO = makePlan({
  expectedIncomeCents: 300000,
  spendingLimitCents: 250000,
  savingsGoalCents: 50000,
});

const BRIEFING = calculateTotals(briefingScenario());

describe('cenario do briefing', () => {
  const p = calculatePlanProgress(BRIEFING, PLANO);

  it('mede a renda GERADA, nao o caixa', () => {
    // R$ 3.100 entraram, mas R$ 100 vieram da reserva.
    expect(BRIEFING.income).toBe(310000);
    expect(p.earnedIncomeCents).toBe(300000);
    expect(p.incomePercentage).toBe(100);
  });

  it('mede o gasto comprometido contra o limite', () => {
    expect(p.committedSpendingCents).toBe(261000);
    expect(p.spendingLimitCents).toBe(250000);
    expect(p.isOverLimit).toBe(true);
    expect(p.remainingToSpendCents).toBe(-11000);
    expect(p.overLimitCents).toBe(11000);
  });

  it('pago e pendente sempre somam o comprometido', () => {
    // A invariante que impede dupla contagem, em qualquer repartição.
    expect(p.paidSpendingCents + p.pendingSpendingCents).toBe(p.committedSpendingCents);
  });

  it('separa pago de pendente quando ha os dois', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 300000, date: '2026-10-01' }),
      makeExpense({ amountCents: 147100, date: '2026-10-05', status: 'paid' }),
      makeExpense({ amountCents: 113900, date: '2026-10-28', status: 'pending' }),
    ]);

    const comPendencia = calculatePlanProgress(totais, PLANO);

    expect(comPendencia.paidSpendingCents).toBe(147100);
    expect(comPendencia.pendingSpendingCents).toBe(113900);
    expect(comPendencia.committedSpendingCents).toBe(261000);
    // O limite ja estourou pelo comprometido, embora o pago ainda caiba.
    expect(comPendencia.paidSpendingCents).toBeLessThan(comPendencia.spendingLimitCents);
    expect(comPendencia.isOverLimit).toBe(true);
  });

  it('mede a meta contra a ECONOMIA DO MES, nao contra o saldo', () => {
    // Lote 10: era 49000 (o saldo, que contava os R$ 100 da reserva).
    // Economia = renda gerada 3.000 - gastos operacionais 2.610 = 390.
    expect(p.projectedSavingsCents).toBe(39000);
    expect(p.savingsPercentage).toBe(78);
    expect(p.savingsDifferenceCents).toBe(-11000);
    expect(p.isGoalReached).toBe(false);
    // O saldo de caixa continua 490: as duas grandezas coexistem.
    expect(BRIEFING.balance).toBe(49000);
  });
});

describe('progresso da renda — numerador zero nao e divisao por zero', () => {
  it('esperado 3.000 e recebido 0 devolve 0%, nao null', () => {
    // Informacao real: a pessoa nao recebeu nada ainda. Dizer "—" esconderia
    // isso atras de uma ausencia que nao existe.
    const p = calculatePlanProgress(EMPTY_TOTALS, PLANO);

    expect(p.incomePercentage).toBe(0);
    expect(p.incomePercentage).not.toBeNull();
  });

  it('renda esperada zero devolve null', () => {
    // Sem meta declarada nao existe progresso a medir.
    const p = calculatePlanProgress(BRIEFING, makePlan({ expectedIncomeCents: 0 }));
    expect(p.incomePercentage).toBeNull();
  });

  it('os dois casos convivem no mesmo plano', () => {
    const semRendaEsperada = calculatePlanProgress(EMPTY_TOTALS, makePlan({ expectedIncomeCents: 0 }));
    const comRendaEsperada = calculatePlanProgress(EMPTY_TOTALS, makePlan({ expectedIncomeCents: 300000 }));

    expect(semRendaEsperada.incomePercentage).toBeNull();
    expect(comRendaEsperada.incomePercentage).toBe(0);
  });

  it('reserva nao infla o progresso da renda', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 300000, date: '2026-10-05' }),
      makeIncome({ amountCents: 100000, date: '2026-10-06', flow: 'transfer' }),
    ]);

    const p = calculatePlanProgress(totais, PLANO);

    // R$ 400.000 de caixa, mas so R$ 300.000 de renda gerada.
    expect(totais.income).toBe(400000);
    expect(p.earnedIncomeCents).toBe(300000);
    expect(p.incomePercentage).toBe(100);
  });

  it('recebido acima do esperado passa de 100%', () => {
    const totais = calculateTotals([makeIncome({ amountCents: 450000, date: '2026-10-05' })]);
    const p = calculatePlanProgress(totais, PLANO);

    expect(p.incomePercentage).toBe(150);
    expect(p.incomeDifferenceCents).toBe(150000);
  });
});

describe('quanto ainda posso gastar', () => {
  it('e limite menos comprometido', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 200000, date: '2026-10-05' })]);
    const p = calculatePlanProgress(totais, PLANO);

    expect(p.remainingToSpendCents).toBe(50000);
  });

  it('NAO muda ao dar baixa numa conta pendente', () => {
    /**
     * A invariante mais importante do lote.
     *
     * Pagar o que ja estava lancado nao libera dinheiro novo: o valor ja
     * estava comprometido. Se este numero mudasse, a pessoa gastaria duas
     * vezes o mesmo dinheiro achando que podia.
     */
    const pendente = [
      makeExpense({ amountCents: 140000, date: '2026-10-05', status: 'paid' }),
      makeExpense({ amountCents: 60000, date: '2026-10-20', status: 'pending' }),
    ];
    const paga = [
      makeExpense({ amountCents: 140000, date: '2026-10-05', status: 'paid' }),
      makeExpense({ amountCents: 60000, date: '2026-10-20', status: 'paid' }),
    ];

    const antes = calculatePlanProgress(calculateTotals(pendente), PLANO);
    const depois = calculatePlanProgress(calculateTotals(paga), PLANO);

    expect(antes.remainingToSpendCents).toBe(50000);
    expect(depois.remainingToSpendCents).toBe(antes.remainingToSpendCents);

    // O que MUDA e so a repartição entre pago e pendente.
    expect(antes.paidSpendingCents).toBe(140000);
    expect(depois.paidSpendingCents).toBe(200000);
    expect(depois.committedSpendingCents).toBe(antes.committedSpendingCents);
  });

  it('um gasto novo reduz imediatamente', () => {
    const antes = calculatePlanProgress(
      calculateTotals([makeExpense({ amountCents: 200000, date: '2026-10-05' })]),
      PLANO,
    );
    const depois = calculatePlanProgress(
      calculateTotals([
        makeExpense({ amountCents: 200000, date: '2026-10-05' }),
        makeExpense({ amountCents: 30000, date: '2026-10-06' }),
      ]),
      PLANO,
    );

    expect(antes.remainingToSpendCents).toBe(50000);
    expect(depois.remainingToSpendCents).toBe(20000);
  });

  it('fica NEGATIVO quando estoura, sem mascarar em zero', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 261000, date: '2026-10-05' })]);
    const p = calculatePlanProgress(totais, PLANO);

    expect(p.remainingToSpendCents).toBe(-11000);
    expect(p.remainingToSpendCents).toBeLessThan(0);
    expect(p.overLimitCents).toBe(11000);
    expect(p.isOverLimit).toBe(true);
  });

  it('nao acusa estouro quando nao ha limite definido', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 100000, date: '2026-10-05' })]);
    const p = calculatePlanProgress(totais, makePlan({ spendingLimitCents: 0 }));

    expect(p.isOverLimit).toBe(false);
    expect(p.spendingPercentage).toBeNull();
  });

  it('limite zero com gasto zero nao produz percentual falso', () => {
    const p = calculatePlanProgress(EMPTY_TOTALS, makePlan({ spendingLimitCents: 0 }));
    expect(p.spendingPercentage).toBeNull();
    expect(p.paidSpendingPercentage).toBeNull();
  });
});

describe('meta de economia — o sinal nunca se perde', () => {
  it('saldo projetado negativo produz percentual NEGATIVO', () => {
    /**
     * Correcao explicita: a barra pode renderizar vazia, mas -22% e -22%.
     * Zerar aqui faria "nao economizou nada" e "ficou R$ 110 no vermelho"
     * virarem o mesmo numero.
     */
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000, date: '2026-10-01' }),
      makeExpense({ amountCents: 111000, date: '2026-10-05' }),
    ]);

    const p = calculatePlanProgress(totais, PLANO);

    expect(p.projectedSavingsCents).toBe(-11000);
    expect(p.savingsPercentage).toBe(-22);
    expect(p.savingsDifferenceCents).toBe(-61000);
    expect(p.isGoalReached).toBe(false);
  });

  it('meta zero devolve null', () => {
    const p = calculatePlanProgress(BRIEFING, makePlan({ savingsGoalCents: 0 }));

    expect(p.savingsPercentage).toBeNull();
    expect(p.isGoalReached).toBe(false);
  });

  it('meta superada passa de 100% e reporta a sobra', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 300000, date: '2026-10-01' }),
      makeExpense({ amountCents: 230000, date: '2026-10-05' }),
    ]);

    const p = calculatePlanProgress(totais, PLANO);

    expect(p.projectedSavingsCents).toBe(70000);
    expect(p.savingsPercentage).toBe(140);
    expect(p.savingsDifferenceCents).toBe(20000);
    expect(p.isGoalReached).toBe(true);
  });

  it('meta exatamente atingida conta como alcancada', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 300000, date: '2026-10-01' }),
      makeExpense({ amountCents: 250000, date: '2026-10-05' }),
    ]);

    const p = calculatePlanProgress(totais, PLANO);

    expect(p.projectedSavingsCents).toBe(50000);
    expect(p.savingsPercentage).toBe(100);
    expect(p.isGoalReached).toBe(true);
  });

  it('nunca produz -0', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000, date: '2026-10-01' }),
      makeExpense({ amountCents: 100000, date: '2026-10-05' }),
    ]);

    const p = calculatePlanProgress(totais, PLANO);

    expect(p.projectedSavingsCents).toBe(0);
    expect(Object.is(p.projectedSavingsCents, -0)).toBe(false);
  });
});

describe('coerencia das tres metas', () => {
  it('plano coerente tem folga zero', () => {
    const c = calculatePlanCoherence(
      makePlan({ expectedIncomeCents: 300000, savingsGoalCents: 50000, spendingLimitCents: 250000 }),
    );

    expect(c.plannedBudgetCents).toBe(250000);
    expect(c.slackCents).toBe(0);
    expect(c.isInconsistent).toBe(false);
  });

  it('detecta o plano que se contradiz', () => {
    // Renda 3.000, meta 500, limite 2.900: gastando tudo, sobram 100.
    const c = calculatePlanCoherence(
      makePlan({ expectedIncomeCents: 300000, savingsGoalCents: 50000, spendingLimitCents: 290000 }),
    );

    expect(c.plannedBudgetCents).toBe(250000);
    expect(c.slackCents).toBe(-40000);
    expect(c.isInconsistent).toBe(true);
  });

  it('folga positiva nao e inconsistencia', () => {
    const c = calculatePlanCoherence(
      makePlan({ expectedIncomeCents: 300000, savingsGoalCents: 50000, spendingLimitCents: 200000 }),
    );

    expect(c.slackCents).toBe(50000);
    expect(c.isInconsistent).toBe(false);
  });

  it('meta maior que a renda e permitida, com folga negativa', () => {
    const c = calculatePlanCoherence(
      makePlan({ expectedIncomeCents: 100000, savingsGoalCents: 150000, spendingLimitCents: 0 }),
    );

    expect(c.plannedBudgetCents).toBe(-50000);
    expect(c.isInconsistent).toBe(true);
  });

  it('plano todo zerado nao e inconsistente', () => {
    const c = calculatePlanCoherence(
      makePlan({ expectedIncomeCents: 0, savingsGoalCents: 0, spendingLimitCents: 0 }),
    );

    expect(c.slackCents).toBe(0);
    expect(c.isInconsistent).toBe(false);
  });
});

describe('ausencia de plano', () => {
  it('nao e um plano de zeros', () => {
    const p = calculatePlanProgress(BRIEFING, null);

    expect(p.hasPlan).toBe(false);
    expect(p.incomePercentage).toBeNull();
    expect(p.spendingPercentage).toBeNull();
    expect(p.savingsPercentage).toBeNull();
  });

  it('ainda reporta se o mes tem movimento', () => {
    // A tela precisa saber se o mes esta vazio ou so sem planejamento.
    expect(calculatePlanProgress(BRIEFING, null).hasActivity).toBe(true);
    expect(calculatePlanProgress(EMPTY_TOTALS, null).hasActivity).toBe(false);
  });

  it('mes vazio sem plano equivale ao progresso vazio', () => {
    expect(calculatePlanProgress(EMPTY_TOTALS, null)).toEqual(EMPTY_PLAN_PROGRESS);
  });

  it('um plano com zeros NAO equivale a nao ter plano', () => {
    const semPlano = calculatePlanProgress(EMPTY_TOTALS, null);
    const planoZerado = calculatePlanProgress(
      EMPTY_TOTALS,
      makePlan({ expectedIncomeCents: 0, spendingLimitCents: 0, savingsGoalCents: 0 }),
    );

    expect(semPlano.hasPlan).toBe(false);
    expect(planoZerado.hasPlan).toBe(true);
  });
});

describe('mes sem atividade', () => {
  it('distingue "nada lancado" de "0% utilizado"', () => {
    const p = calculatePlanProgress(EMPTY_TOTALS, PLANO);

    expect(p.hasActivity).toBe(false);
    // Os percentuais existem e sao 0 — mas `hasActivity` permite a tela dizer
    // "nada lancado ainda" em vez de fingir progresso.
    expect(p.spendingPercentage).toBe(0);
    expect(p.remainingToSpendCents).toBe(250000);
  });
});

describe('limite de gastos mede consumo — guardar dinheiro nao e gastar', () => {
  /**
   * Correcao do Lote 9. O limite usava `totals.expense`, que inclui
   * transferencias: mandar R$ 500 para a reserva fazia o mes "estourar".
   */
  const LIMITE_1000 = makePlan({
    expectedIncomeCents: 300000,
    spendingLimitCents: 100000,
    savingsGoalCents: 0,
  });

  const SETEMBRO = [
    makeIncome({ amountCents: 300000, date: '2026-09-05' }),
    makeExpense({ amountCents: 80000, date: '2026-09-12' }),
    makeExpense({ amountCents: 9000, status: 'pending', date: '2026-09-30' }),
    makeExpense({ amountCents: 50000, flow: 'transfer', date: '2026-09-28' }),
  ];

  it('exemplo obrigatorio: limite 1.000, gasto 890, reserva 500 -> R$ 110 disponiveis', () => {
    const p = calculatePlanProgress(calculateTotals(SETEMBRO), LIMITE_1000);

    expect(p.committedSpendingCents).toBe(89000);
    expect(p.remainingToSpendCents).toBe(11000);
    expect(p.isOverLimit).toBe(false);
    expect(p.overLimitCents).toBe(0);
    expect(p.spendingPercentage).toBe(89);
  });

  it('gasto operacional reduz "ainda posso gastar"', () => {
    const antes = calculatePlanProgress(calculateTotals(SETEMBRO), LIMITE_1000);
    const depois = calculatePlanProgress(
      calculateTotals([...SETEMBRO, makeExpense({ amountCents: 4000, date: '2026-09-29' })]),
      LIMITE_1000,
    );
    expect(depois.remainingToSpendCents).toBe(antes.remainingToSpendCents - 4000);
  });

  it('transferencia para a reserva NAO reduz "ainda posso gastar"', () => {
    const antes = calculatePlanProgress(calculateTotals(SETEMBRO), LIMITE_1000);
    const depois = calculatePlanProgress(
      calculateTotals([
        ...SETEMBRO,
        makeExpense({ amountCents: 70000, flow: 'transfer', date: '2026-09-29' }),
      ]),
      LIMITE_1000,
    );
    expect(depois.remainingToSpendCents).toBe(antes.remainingToSpendCents);
    expect(depois.committedSpendingCents).toBe(antes.committedSpendingCents);
    expect(depois.isOverLimit).toBe(false);
  });

  it('transferencia VINDA da reserva nao aumenta a renda, paga ou pendente', () => {
    const totais = calculateTotals([
      ...SETEMBRO,
      makeIncome({ amountCents: 10000, flow: 'transfer', date: '2026-09-06' }),
      makeIncome({ amountCents: 20000, flow: 'transfer', status: 'pending', date: '2026-09-07' }),
    ]);
    const p = calculatePlanProgress(totais, LIMITE_1000);

    expect(p.earnedIncomeCents).toBe(300000);
    expect(p.incomePercentage).toBe(100);
    // O caixa, sim, recebeu os R$ 300.
    expect(totais.income).toBe(330000);
  });

  it('pago e pendente sao so a parte operacional e somam o comprometido', () => {
    const p = calculatePlanProgress(calculateTotals(SETEMBRO), LIMITE_1000);

    expect(p.paidSpendingCents).toBe(80000);
    expect(p.pendingSpendingCents).toBe(9000);
    expect(p.paidSpendingCents + p.pendingSpendingCents).toBe(p.committedSpendingCents);
    expect(p.paidSpendingPercentage).toBe(80);
  });

  it('pendente -> pago e pago -> pendente nao mudam o comprometido nem o disponivel', () => {
    const pendente = makeExpense({ amountCents: 9000, status: 'pending', date: '2026-09-30' });
    const base = SETEMBRO.slice(0, 2);
    const comPendente = calculatePlanProgress(
      calculateTotals([...base, pendente, SETEMBRO[3]!]),
      LIMITE_1000,
    );
    const comPago = calculatePlanProgress(
      calculateTotals([...base, { ...pendente, status: 'paid' }, SETEMBRO[3]!]),
      LIMITE_1000,
    );

    expect(comPago.committedSpendingCents).toBe(comPendente.committedSpendingCents);
    expect(comPago.remainingToSpendCents).toBe(comPendente.remainingToSpendCents);
    // Muda apenas a reparticao.
    expect(comPago.paidSpendingCents).toBe(comPendente.paidSpendingCents + 9000);
    expect(comPago.pendingSpendingCents).toBe(comPendente.pendingSpendingCents - 9000);
  });

  it('o saldo continua mudando com transferencias', () => {
    const sem = calculateTotals(SETEMBRO.slice(0, 3));
    const com = calculateTotals(SETEMBRO);

    expect(com.balance).toBe(sem.balance - 50000);
    expect(com.realizedBalance).toBe(sem.realizedBalance - 50000);
    expect(com.expense).toBe(sem.expense + 50000);
    // E so o orcamento de consumo que ignora a reserva.
    expect(com.operationalExpense).toBe(sem.operationalExpense);
  });

  it('so transferencia no mes: comprometido zero e percentual 0, nunca NaN', () => {
    const p = calculatePlanProgress(
      calculateTotals([makeExpense({ amountCents: 50000, flow: 'transfer', date: '2026-09-28' })]),
      LIMITE_1000,
    );

    expect(p.committedSpendingCents).toBe(0);
    expect(p.spendingPercentage).toBe(0);
    expect(p.paidSpendingPercentage).toBe(0);
    expect(p.remainingToSpendCents).toBe(100000);
    expect(p.hasActivity).toBe(true);
  });

  it('sem limite definido, os percentuais sao null — nunca NaN nem falso zero', () => {
    const p = calculatePlanProgress(
      calculateTotals(SETEMBRO),
      makePlan({ spendingLimitCents: 0, expectedIncomeCents: 0, savingsGoalCents: 0 }),
    );

    for (const value of [p.spendingPercentage, p.paidSpendingPercentage, p.incomePercentage, p.savingsPercentage]) {
      expect(value).toBeNull();
    }
    expect(p.isOverLimit).toBe(false);
  });
});
