import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense, makeIncome } from '../__testing__/factories';
import { roundPercentage } from '../shared/percentage';
import {
  EMPTY_BREAKDOWN,
  OTHER_CATEGORIES_ID,
  calculateCategoryBreakdown,
  findCategoryShare,
  groupSmallCategories,
} from './by-category';

describe('calculateCategoryBreakdown', () => {
  it('ordena da maior para a menor e identifica o maior gasto', () => {
    const distribuicao = calculateCategoryBreakdown(briefingScenario());

    // Cartao (374 + 765 = 1.139) supera Carro (911).
    expect(distribuicao.items.map((item) => item.categoryId)).toEqual([
      'cat-cartao',
      'cat-carro',
      'cat-emprestimo',
      'cat-internet',
    ]);
    expect(distribuicao.largest?.categoryId).toBe('cat-cartao');
    expect(distribuicao.largest?.totalCents).toBe(113900);
    expect(distribuicao.totalCents).toBe(261000);
  });

  it('agrupa varias transacoes da mesma categoria', () => {
    const cartao = findCategoryShare(calculateCategoryBreakdown(briefingScenario()), 'cat-cartao');
    expect(cartao?.transactionCount).toBe(2);
    expect(cartao?.totalCents).toBe(37400 + 76500);
  });

  it('calcula a participacao de cada categoria', () => {
    const distribuicao = calculateCategoryBreakdown(briefingScenario());
    const carro = findCategoryShare(distribuicao, 'cat-carro');

    expect(roundPercentage(carro?.percentage as number, 1)).toBe(34.9);

    const soma = distribuicao.items.reduce((total, item) => total + (item.percentage ?? 0), 0);
    expect(roundPercentage(soma, 6)).toBe(100);
  });

  it('considera apenas saidas por padrao', () => {
    const distribuicao = calculateCategoryBreakdown(briefingScenario());
    expect(findCategoryShare(distribuicao, 'cat-salario')).toBeNull();
  });

  it('calcula a distribuicao de entradas quando pedido', () => {
    const distribuicao = calculateCategoryBreakdown(briefingScenario(), { type: 'income' });

    // Lote 10: era 310000. Os R$ 100 vindos da reserva nao sao renda e nao
    // entram na distribuicao por categoria.
    expect(distribuicao.totalCents).toBe(300000);
    expect(distribuicao.largest?.categoryId).toBe('cat-salario');
  });

  it('devolve estrutura vazia para periodo sem transacoes', () => {
    expect(calculateCategoryBreakdown([])).toEqual(EMPTY_BREAKDOWN);
    expect(calculateCategoryBreakdown([]).largest).toBeNull();
  });

  it('devolve estrutura vazia quando ha apenas entradas', () => {
    const distribuicao = calculateCategoryBreakdown([makeIncome({ amountCents: 100000 })]);
    expect(distribuicao.items).toHaveLength(0);
    expect(distribuicao.totalCents).toBe(0);
  });

  it('nao divide por zero quando todos os valores somam zero', () => {
    // Impossivel pelo schema (valor > 0), mas a funcao nao pode quebrar
    // se alguem construir esse estado na mao.
    const distribuicao = calculateCategoryBreakdown([]);
    expect(distribuicao.items.every((item) => item.percentage !== undefined)).toBe(true);
  });

  it('desempata por categoria para que a ordem seja estavel', () => {
    const primeiro = calculateCategoryBreakdown([
      makeExpense({ amountCents: 10000, categoryId: 'cat-b' }),
      makeExpense({ amountCents: 10000, categoryId: 'cat-a' }),
    ]);
    const segundo = calculateCategoryBreakdown([
      makeExpense({ amountCents: 10000, categoryId: 'cat-a' }),
      makeExpense({ amountCents: 10000, categoryId: 'cat-b' }),
    ]);

    expect(primeiro.items.map((item) => item.categoryId)).toEqual(['cat-a', 'cat-b']);
    expect(segundo.items.map((item) => item.categoryId)).toEqual(['cat-a', 'cat-b']);
  });
});

describe('groupSmallCategories', () => {
  const muitasCategorias = [
    makeExpense({ amountCents: 100000, categoryId: 'cat-1' }),
    makeExpense({ amountCents: 80000, categoryId: 'cat-2' }),
    makeExpense({ amountCents: 60000, categoryId: 'cat-3' }),
    makeExpense({ amountCents: 40000, categoryId: 'cat-4' }),
    makeExpense({ amountCents: 20000, categoryId: 'cat-5' }),
    makeExpense({ amountCents: 10000, categoryId: 'cat-6' }),
    makeExpense({ amountCents: 5000, categoryId: 'cat-7' }),
  ];

  it('reduz a cauda a uma fatia "Outros" sem perder dinheiro', () => {
    const distribuicao = calculateCategoryBreakdown(muitasCategorias);
    const agrupada = groupSmallCategories(distribuicao, 5);

    expect(agrupada.items).toHaveLength(5);
    expect(agrupada.items.at(-1)?.categoryId).toBe(OTHER_CATEGORIES_ID);
    expect(agrupada.items.at(-1)?.totalCents).toBe(20000 + 10000 + 5000);
    expect(agrupada.items.at(-1)?.transactionCount).toBe(3);

    const soma = agrupada.items.reduce((total, item) => total + item.totalCents, 0);
    expect(soma).toBe(distribuicao.totalCents);
  });

  it('nao altera distribuicoes que ja cabem no limite', () => {
    const distribuicao = calculateCategoryBreakdown(briefingScenario());
    expect(groupSmallCategories(distribuicao, 5)).toBe(distribuicao);
  });

  it('preserva a maior categoria original', () => {
    const distribuicao = calculateCategoryBreakdown(muitasCategorias);
    expect(groupSmallCategories(distribuicao, 3).largest?.categoryId).toBe('cat-1');
  });

  it('lida com distribuicao vazia e recusa limite invalido', () => {
    expect(groupSmallCategories(EMPTY_BREAKDOWN, 5).items).toHaveLength(0);
    expect(() => groupSmallCategories(EMPTY_BREAKDOWN, 0)).toThrow(RangeError);
  });
});
