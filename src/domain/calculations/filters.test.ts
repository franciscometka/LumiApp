import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { civilMonthResolver } from '../shared/period';
import { toMonthKey } from '../shared/plain-date';
import { filterTransactions, matchesFilter, sortByDateAsc, sortByDateDesc } from './filters';

const outubro = civilMonthResolver.resolve(toMonthKey('2026-10'));
const setembro = civilMonthResolver.resolve(toMonthKey('2026-09'));

describe('filtro por periodo', () => {
  it('inclui as duas pontas do mes', () => {
    const transacoes = [
      makeExpense({ date: '2026-09-30' }),
      makeExpense({ date: '2026-10-01' }),
      makeExpense({ date: '2026-10-31' }),
      makeExpense({ date: '2026-11-01' }),
    ];

    expect(filterTransactions(transacoes, { period: outubro })).toHaveLength(2);
    expect(filterTransactions(transacoes, { period: setembro })).toHaveLength(1);
  });

  it('respeita o ultimo dia de fevereiro', () => {
    const fevereiro = civilMonthResolver.resolve(toMonthKey('2026-02'));
    const transacoes = [makeExpense({ date: '2026-02-28' }), makeExpense({ date: '2026-03-01' })];

    expect(filterTransactions(transacoes, { period: fevereiro })).toHaveLength(1);
  });
});

describe('filtros de atributo', () => {
  it('filtra por tipo, status e categoria', () => {
    const transacoes = briefingScenario();

    expect(filterTransactions(transacoes, { type: 'income' })).toHaveLength(4);
    expect(filterTransactions(transacoes, { type: 'expense' })).toHaveLength(5);
    expect(filterTransactions(transacoes, { status: 'paid' })).toHaveLength(9);
    expect(filterTransactions(transacoes, { categoryIds: ['cat-cartao'] })).toHaveLength(2);
    expect(
      filterTransactions(transacoes, { categoryIds: ['cat-carro', 'cat-internet'] }),
    ).toHaveLength(2);
  });

  it('filtra por forma de pagamento, cartao e divida', () => {
    const transacoes = briefingScenario();

    expect(filterTransactions(transacoes, { paymentMethods: ['credit'] })).toHaveLength(2);
    expect(filterTransactions(transacoes, { cardId: 'card-inter' })).toHaveLength(1);
    expect(filterTransactions(transacoes, { debtId: 'debt-emprestimo' })).toHaveLength(1);
  });

  it('combina filtros', () => {
    const resultado = filterTransactions(briefingScenario(), {
      period: outubro,
      type: 'expense',
      paymentMethods: ['credit'],
    });

    expect(resultado).toHaveLength(2);
  });

  it('nao filtra nada quando nenhum criterio e informado', () => {
    expect(filterTransactions(briefingScenario())).toHaveLength(9);
  });
});

describe('busca textual', () => {
  it('ignora acento e caixa', () => {
    const transacoes = [
      makeExpense({ description: 'Almoço no centro' }),
      makeExpense({ description: 'Farmácia' }),
    ];

    expect(filterTransactions(transacoes, { search: 'almoco' })).toHaveLength(1);
    expect(filterTransactions(transacoes, { search: 'ALMOÇO' })).toHaveLength(1);
    expect(filterTransactions(transacoes, { search: 'farmacia' })).toHaveLength(1);
  });

  it('procura tambem nas observacoes', () => {
    const transacoes = [makeExpense({ description: 'Mercado', notes: 'Compra do mês' })];
    expect(filterTransactions(transacoes, { search: 'mes' })).toHaveLength(1);
  });

  it('busca vazia ou so com espacos nao filtra', () => {
    expect(filterTransactions(briefingScenario(), { search: '' })).toHaveLength(9);
    expect(filterTransactions(briefingScenario(), { search: '   ' })).toHaveLength(9);
  });
});

describe('exclusao logica', () => {
  it('esconde transacoes excluidas por padrao', () => {
    const transacoes = [
      makeExpense({ amountCents: 10000 }),
      makeExpense({ amountCents: 20000, deletedAt: '2026-10-11T12:00:00.000Z' }),
    ];

    expect(filterTransactions(transacoes)).toHaveLength(1);
    expect(filterTransactions(transacoes, { includeDeleted: true })).toHaveLength(2);
  });
});

describe('ordenacao', () => {
  it('ordena por data nos dois sentidos', () => {
    const transacoes = [
      makeExpense({ date: '2026-10-20' }),
      makeExpense({ date: '2026-10-05' }),
      makeExpense({ date: '2026-10-15' }),
    ];

    expect(sortByDateDesc(transacoes).map((item) => item.date)).toEqual([
      '2026-10-20',
      '2026-10-15',
      '2026-10-05',
    ]);
    expect(sortByDateAsc(transacoes).map((item) => item.date)).toEqual([
      '2026-10-05',
      '2026-10-15',
      '2026-10-20',
    ]);
  });

  it('nao muta o array original', () => {
    const transacoes = [makeExpense({ date: '2026-10-20' }), makeExpense({ date: '2026-10-05' })];
    const copia = [...transacoes];

    sortByDateDesc(transacoes);
    expect(transacoes).toEqual(copia);
  });

  it('lida com lista vazia', () => {
    expect(sortByDateAsc([])).toEqual([]);
    expect(sortByDateDesc([])).toEqual([]);
  });
});

describe('matchesFilter', () => {
  it('avalia uma transacao isolada', () => {
    const transacao = makeIncome({ date: '2026-10-05', amountCents: 230000 });

    expect(matchesFilter(transacao, { period: outubro, type: 'income' })).toBe(true);
    expect(matchesFilter(transacao, { period: setembro })).toBe(false);
    expect(matchesFilter(transacao, { type: 'expense' })).toBe(false);
  });
});
