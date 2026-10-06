import { describe, expect, it } from 'vitest';

import { toMonthKey, toPlainDate } from '@/domain/shared/plain-date';

import { MONTH_PARAM, buildMonthQuery, isCurrentMonth, resolveMonthParam } from './selected-month';

const hoje = toPlainDate('2026-10-15');

describe('resolveMonthParam', () => {
  it('usa o mes da URL quando ele e valido', () => {
    expect(resolveMonthParam('2026-09', hoje)).toBe('2026-09');
    expect(resolveMonthParam('2025-01', hoje)).toBe('2025-01');
    expect(resolveMonthParam('2027-12', hoje)).toBe('2027-12');
  });

  it('cai no mes de hoje quando o parametro esta ausente', () => {
    expect(resolveMonthParam(null, hoje)).toBe('2026-10');
    expect(resolveMonthParam(undefined, hoje)).toBe('2026-10');
  });

  it('cai no mes de hoje em vez de quebrar com parametro invalido', () => {
    // Um link antigo ou uma URL digitada a mao nao pode derrubar a aplicacao.
    expect(resolveMonthParam('xpto', hoje)).toBe('2026-10');
    expect(resolveMonthParam('2026-13', hoje)).toBe('2026-10');
    expect(resolveMonthParam('2026-00', hoje)).toBe('2026-10');
    expect(resolveMonthParam('2026-10-15', hoje)).toBe('2026-10');
    expect(resolveMonthParam('', hoje)).toBe('2026-10');
    expect(resolveMonthParam('../../etc', hoje)).toBe('2026-10');
  });

  it('respeita o ultimo dia do mes como referencia', () => {
    expect(resolveMonthParam(null, toPlainDate('2026-02-28'))).toBe('2026-02');
    expect(resolveMonthParam(null, toPlainDate('2026-12-31'))).toBe('2026-12');
    expect(resolveMonthParam(null, toPlainDate('2027-01-01'))).toBe('2027-01');
  });
});

describe('buildMonthQuery', () => {
  it('define o mes preservando os demais parametros', () => {
    const atual = new URLSearchParams('categoria=carro&busca=posto');
    const query = new URLSearchParams(buildMonthQuery(atual, toMonthKey('2026-09')));

    expect(query.get(MONTH_PARAM)).toBe('2026-09');
    expect(query.get('categoria')).toBe('carro');
    expect(query.get('busca')).toBe('posto');
  });

  it('substitui um mes ja presente em vez de duplicar', () => {
    const atual = new URLSearchParams('month=2026-10');
    const query = new URLSearchParams(buildMonthQuery(atual, toMonthKey('2026-11')));

    expect(query.getAll(MONTH_PARAM)).toEqual(['2026-11']);
  });

  it('nao muta os parametros recebidos', () => {
    const atual = new URLSearchParams('month=2026-10');
    buildMonthQuery(atual, toMonthKey('2026-11'));

    expect(atual.get(MONTH_PARAM)).toBe('2026-10');
  });

  it('funciona a partir de uma query vazia', () => {
    expect(buildMonthQuery(new URLSearchParams(), toMonthKey('2026-10'))).toBe('month=2026-10');
  });
});

describe('isCurrentMonth', () => {
  it('reconhece o mes corrente', () => {
    expect(isCurrentMonth(toMonthKey('2026-10'), hoje)).toBe(true);
    expect(isCurrentMonth(toMonthKey('2026-09'), hoje)).toBe(false);
    expect(isCurrentMonth(toMonthKey('2026-11'), hoje)).toBe(false);
  });

  it('atravessa a virada de ano', () => {
    expect(isCurrentMonth(toMonthKey('2026-12'), toPlainDate('2026-12-31'))).toBe(true);
    expect(isCurrentMonth(toMonthKey('2026-12'), toPlainDate('2027-01-01'))).toBe(false);
  });
});

describe('ida e volta pela URL', () => {
  it('o que foi escrito e lido de volta identico', () => {
    for (const mes of ['2025-01', '2026-02', '2026-10', '2027-12']) {
      const query = new URLSearchParams(buildMonthQuery(new URLSearchParams(), toMonthKey(mes)));
      expect(resolveMonthParam(query.get(MONTH_PARAM), hoje)).toBe(mes);
    }
  });
});
