import { describe, expect, it } from 'vitest';

import { briefingScenario, date, makeExpense, makeIncome } from '../__testing__/factories';
import { buildSnapshot } from '../calculations/snapshot';
import type { PeriodSnapshot } from '../calculations/snapshot';
import type { Transaction } from '../entities/transaction';
import { civilMonthResolver } from '../shared/period';
import { toMonthKey } from '../shared/plain-date';
import type { MonthKey, PlainDate } from '../shared/plain-date';

import { generateInsights } from './engine';

const NOMES: Record<string, string> = {
  'cat-carro': 'Carro',
  'cat-cartao': 'Cartão',
  'cat-internet': 'Internet',
  'cat-emprestimo': 'Empréstimo',
};

function snapshotDe(
  transactions: readonly Transaction[],
  options: { month?: string; today?: string } = {},
): PeriodSnapshot {
  const month = toMonthKey(options.month ?? '2026-10') as MonthKey;
  return buildSnapshot({
    transactions,
    resolver: civilMonthResolver,
    period: civilMonthResolver.resolve(month),
    today: date(options.today ?? '2026-10-20') as PlainDate,
  });
}

function textos(snapshot: PeriodSnapshot, limit = 2): string[] {
  return generateInsights(snapshot, {
    categoryName: (id) => NOMES[id] ?? null,
    limit,
  }).map((insight) => insight.text);
}

describe('escassez', () => {
  it('devolve no maximo o limite pedido', () => {
    const snapshot = snapshotDe(briefingScenario());

    expect(textos(snapshot, 2)).toHaveLength(2);
    expect(textos(snapshot, 1)).toHaveLength(1);
    expect(textos(snapshot, 0)).toHaveLength(0);
  });

  it('ordena por relevancia, nao por ordem de registro', () => {
    // Saldo negativo tem prioridade maxima e precisa chegar na frente.
    const snapshot = snapshotDe([
      makeIncome({ amountCents: 100000, date: '2026-10-05' }),
      makeExpense({ amountCents: 300000, date: '2026-10-06', categoryId: 'cat-carro' }),
    ]);

    expect(textos(snapshot, 1)[0]).toContain('passaram as entradas');
  });

  it('nao diz nada em um mes vazio', () => {
    expect(textos(snapshotDe([]))).toEqual([]);
  });
});

describe('nenhuma frase sem base matematica', () => {
  it('nao fala de uso de renda quando nao houve renda gerada', () => {
    // So gastos: a divisao seria por zero.
    const snapshot = snapshotDe([makeExpense({ amountCents: 50000, date: '2026-10-05' })]);
    expect(textos(snapshot).join(' ')).not.toContain('renda');
  });

  it('nao chama reserva de renda', () => {
    // O mes inteiro bancado pela reserva: ha caixa, mas renda gerada e zero.
    const snapshot = snapshotDe([
      makeIncome({ amountCents: 100000, date: '2026-10-05', flow: 'transfer' }),
      makeExpense({ amountCents: 50000, date: '2026-10-06' }),
    ]);

    const frases = textos(snapshot).join(' ');
    expect(frases).not.toContain('da sua renda');
    expect(frases).toContain('veio da sua reserva');
  });

  it('usa a renda gerada, nao o caixa, no percentual de comprometimento', () => {
    // Briefing: R$ 3.100 de caixa, R$ 3.000 de renda, R$ 2.610 de gastos.
    // Sobre o caixa seriam 84%; sobre a renda sao 87%.
    const frases = textos(snapshotDe(briefingScenario()), 5).join(' ');
    expect(frases).toContain('87% da sua renda');
    expect(frases).not.toContain('84%');
  });

  it('nao compara com um mes anterior inexistente', () => {
    const snapshot = snapshotDe(briefingScenario());
    expect(textos(snapshot, 9).join(' ')).not.toContain('mês passado');
  });

  it('compara quando ha mes anterior com dados', () => {
    const frases = textos(
      snapshotDe([
        ...briefingScenario(),
        makeExpense({ amountCents: 230000, date: '2026-09-10' }),
      ]),
      9,
    ).join(' ');

    expect(frases).toContain('13,5% a mais que no mês passado');
  });

  it('ignora variacao irrelevante entre meses', () => {
    const frases = textos(
      snapshotDe([
        makeExpense({ amountCents: 102000, date: '2026-10-10' }),
        makeExpense({ amountCents: 100000, date: '2026-09-10' }),
      ]),
      9,
    ).join(' ');

    expect(frases).not.toContain('mês passado');
  });

  it('nao aponta "maior gasto" quando so existe uma categoria', () => {
    const snapshot = snapshotDe([
      makeIncome({ amountCents: 300000, date: '2026-10-01' }),
      makeExpense({ amountCents: 50000, date: '2026-10-05', categoryId: 'cat-carro' }),
    ]);

    expect(textos(snapshot, 9).join(' ')).not.toContain('maior gasto');
  });

  it('aponta o maior gasto quando ha o que comparar', () => {
    const frases = textos(snapshotDe(briefingScenario()), 9).join(' ');
    expect(frases).toContain('Cartão é seu maior gasto');
  });

  it('cala sobre cartoes quando a fatia e pequena', () => {
    const snapshot = snapshotDe([
      makeIncome({ amountCents: 500000, date: '2026-10-01' }),
      makeExpense({ amountCents: 400000, date: '2026-10-05', paymentMethod: 'pix' }),
      makeExpense({ amountCents: 10000, date: '2026-10-06', paymentMethod: 'credit' }),
    ]);

    expect(textos(snapshot, 9).join(' ')).not.toContain('cartões representam');
  });

  it('fala de cartoes quando a fatia pesa', () => {
    const frases = textos(snapshotDe(briefingScenario()), 9).join(' ');
    expect(frases).toContain('cartões representam 44% dos gastos');
  });

  it('nunca produz NaN, undefined, null ou percentual vazio', () => {
    const cenarios = [
      [],
      briefingScenario(),
      [makeExpense({ amountCents: 1, date: '2026-10-01' })],
      [makeIncome({ amountCents: 1, date: '2026-10-01', flow: 'transfer' })],
    ];

    for (const cenario of cenarios) {
      for (const frase of textos(snapshotDe(cenario), 9)) {
        expect(frase).not.toMatch(/NaN|undefined|null|Infinity/);
        expect(frase).not.toContain('R$ -0,00');
      }
    }
  });
});

describe('projecao respeita o tempo do periodo', () => {
  it('projeta no mes corrente', () => {
    const frases = textos(
      snapshotDe(briefingScenario(), { month: '2026-10', today: '2026-10-20' }),
      9,
    ).join(' ');

    expect(frases).toContain('fecha o mês com cerca de');
  });

  it('nao projeta um mes ja encerrado', () => {
    // "Voce terminara o mes com..." em setembro, estando em outubro, e absurdo.
    const frases = textos(
      snapshotDe(briefingScenario(), { month: '2026-10', today: '2026-11-15' }),
      9,
    ).join(' ');

    expect(frases).not.toContain('fecha o mês');
  });

  it('nao projeta um mes futuro', () => {
    const frases = textos(
      snapshotDe(briefingScenario(), { month: '2026-10', today: '2026-08-15' }),
      9,
    ).join(' ');

    expect(frases).not.toContain('fecha o mês');
  });

  it('nao projeta com poucos dias decorridos', () => {
    // Dois dias de ritmo nao sustentam uma previsao de 31.
    const frases = textos(
      snapshotDe(briefingScenario(), { month: '2026-10', today: '2026-10-02' }),
      9,
    ).join(' ');

    expect(frases).not.toContain('fecha o mês');
  });

  it('nao projeta no ultimo dia, quando nao resta dia nenhum', () => {
    const frases = textos(
      snapshotDe(briefingScenario(), { month: '2026-10', today: '2026-10-31' }),
      9,
    ).join(' ');

    expect(frases).not.toContain('fecha o mês');
  });
});

describe('determinismo', () => {
  it('mesmas entradas, mesma saida', () => {
    const snapshot = snapshotDe(briefingScenario());
    expect(textos(snapshot, 9)).toEqual(textos(snapshot, 9));
  });
});
