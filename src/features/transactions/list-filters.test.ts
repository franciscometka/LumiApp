import { describe, expect, it } from 'vitest';

import { makeExpense, makeIncome } from '@/domain/__testing__/factories';
import type { ID } from '@/domain/shared/id';

import {
  ALL,
  EMPTY_FILTERS,
  applyListFilters,
  buildFilterQuery,
  filtersFromParams,
  hasActiveFilters,
} from './list-filters';

const NOMES: Record<string, string> = {
  'cat-carro': 'Carro',
  'cat-mercado': 'Mercado',
  'cat-salario': 'Salário',
};

const nome = (id: ID) => NOMES[id] ?? null;

const LANCAMENTOS = [
  makeExpense({ description: 'Gasolina', categoryId: 'cat-carro', date: '2026-10-08' }),
  makeExpense({
    description: 'Compra do mês',
    categoryId: 'cat-mercado',
    date: '2026-10-10',
    status: 'pending',
  }),
  makeIncome({ description: 'Salário', categoryId: 'cat-salario', date: '2026-10-05' }),
];

describe('applyListFilters', () => {
  it('sem filtro, devolve tudo', () => {
    expect(applyListFilters(LANCAMENTOS, EMPTY_FILTERS, nome)).toHaveLength(3);
  });

  it('filtra por tipo', () => {
    const gastos = applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, type: 'expense' }, nome);
    expect(gastos.map((t) => t.description)).toEqual(['Gasolina', 'Compra do mês']);

    const entradas = applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, type: 'income' }, nome);
    expect(entradas.map((t) => t.description)).toEqual(['Salário']);
  });

  it('filtra por situacao', () => {
    const pendentes = applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, status: 'pending' }, nome);
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0]?.description).toBe('Compra do mês');
  });

  it('filtra por categoria', () => {
    const carro = applyListFilters(
      LANCAMENTOS,
      { ...EMPTY_FILTERS, categoryId: 'cat-carro' as ID },
      nome,
    );
    expect(carro).toHaveLength(1);
  });

  it('combina filtros', () => {
    const result = applyListFilters(
      LANCAMENTOS,
      { ...EMPTY_FILTERS, type: 'expense', status: 'pending' },
      nome,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe('Compra do mês');
  });

  it('busca por descricao, sem caixa e sem acento', () => {
    for (const termo of ['gasolina', 'GASOLINA', 'gaso']) {
      expect(applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, search: termo }, nome)).toHaveLength(
        1,
      );
    }

    // "mes" tem de encontrar "mês".
    expect(
      applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, search: 'compra do mes' }, nome),
    ).toHaveLength(1);
  });

  it('busca tambem pelo nome da categoria', () => {
    // O dominio so conhece o id; o nome e resolvido pela feature.
    const result = applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, search: 'mercado' }, nome);
    expect(result).toHaveLength(1);
    expect(result[0]?.description).toBe('Compra do mês');
  });

  it('busca nas observacoes', () => {
    const comNota = [makeExpense({ description: 'Almoço', notes: 'reunião com cliente' })];
    expect(applyListFilters(comNota, { ...EMPTY_FILTERS, search: 'cliente' }, nome)).toHaveLength(1);
  });

  it('busca vazia ou so espacos nao filtra nada', () => {
    expect(applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, search: '   ' }, nome)).toHaveLength(3);
  });

  it('busca sem resultado devolve lista vazia, nao a lista inteira', () => {
    expect(applyListFilters(LANCAMENTOS, { ...EMPTY_FILTERS, search: 'xyz' }, nome)).toEqual([]);
  });

  it('tolera categoria sem nome resolvido', () => {
    const orfa = [makeExpense({ description: 'Sem categoria', categoryId: 'cat-sumiu' })];
    expect(applyListFilters(orfa, { ...EMPTY_FILTERS, search: 'sem' }, nome)).toHaveLength(1);
  });

  it('exclui transacoes com exclusao logica', () => {
    const comExcluida = [
      ...LANCAMENTOS,
      makeExpense({ description: 'Apagada', deletedAt: '2026-10-11T12:00:00.000Z' }),
    ];

    const result = applyListFilters(comExcluida, EMPTY_FILTERS, nome);
    expect(result.map((t) => t.description)).not.toContain('Apagada');
  });
});

describe('hasActiveFilters', () => {
  it('reconhece o estado limpo', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '  ' })).toBe(false);
  });

  it('reconhece cada filtro ativo', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, type: 'income' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, status: 'paid' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, categoryId: 'cat-carro' as ID })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'x' })).toBe(true);
  });
});

describe('filtros na URL', () => {
  it('le os parametros', () => {
    const params = new URLSearchParams(
      'tipo=expense&situacao=pending&categoria=cat-carro&busca=gaso',
    );
    expect(filtersFromParams(params)).toEqual({
      type: 'expense',
      status: 'pending',
      categoryId: 'cat-carro',
      search: 'gaso',
    });
  });

  it('parametro invalido cai no padrao, nunca em erro', () => {
    const params = new URLSearchParams('tipo=qualquer&situacao=inventado&categoria=');
    expect(filtersFromParams(params)).toEqual(EMPTY_FILTERS);
  });

  it('URL sem parametro nenhum devolve o estado limpo', () => {
    expect(filtersFromParams(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
  });

  it('preserva o mes ao escrever filtros', () => {
    // O mes e navegacao global: nenhum filtro pode derruba-lo.
    const atual = new URLSearchParams('month=2026-09');
    const query = buildFilterQuery(atual, { ...EMPTY_FILTERS, type: 'expense' });

    const params = new URLSearchParams(query);
    expect(params.get('month')).toBe('2026-09');
    expect(params.get('tipo')).toBe('expense');
  });

  it('remove o parametro em vez de escrever "all"', () => {
    const atual = new URLSearchParams('month=2026-09&tipo=expense&busca=x');
    const query = buildFilterQuery(atual, EMPTY_FILTERS);

    const params = new URLSearchParams(query);
    expect(params.has('tipo')).toBe(false);
    expect(params.has('busca')).toBe(false);
    expect(params.get('month')).toBe('2026-09');
  });

  it('ida e volta pela URL preserva os filtros', () => {
    const original = {
      type: 'income' as const,
      status: 'paid' as const,
      categoryId: 'cat-salario' as ID,
      search: 'salário',
    };

    const query = buildFilterQuery(new URLSearchParams(''), original);
    expect(filtersFromParams(new URLSearchParams(query))).toEqual(original);
  });

  it('nao grava busca com espacos nas pontas', () => {
    const query = buildFilterQuery(new URLSearchParams(''), {
      ...EMPTY_FILTERS,
      search: '  gaso  ',
    });
    expect(new URLSearchParams(query).get('busca')).toBe('gaso');
  });

  it('ALL nunca aparece na URL', () => {
    const query = buildFilterQuery(new URLSearchParams(''), EMPTY_FILTERS);
    expect(query).not.toContain(ALL);
  });
});
