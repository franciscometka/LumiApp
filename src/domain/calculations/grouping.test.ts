import { describe, expect, it } from 'vitest';

import { date, makeExpense, makeIncome, makeTransaction } from '../__testing__/factories';

import { countInGroups, groupByDay, splitByToday } from './grouping';

describe('groupByDay', () => {
  it('agrupa por data e ordena do dia mais recente para o mais antigo', () => {
    const groups = groupByDay([
      makeExpense({ date: '2026-10-08', description: 'Carro' }),
      makeExpense({ date: '2026-10-10', description: 'Internet' }),
      makeIncome({ date: '2026-10-10', description: 'Salário' }),
    ]);

    expect(groups.map((group) => group.date)).toEqual(['2026-10-10', '2026-10-08']);
    expect(groups[0]?.transactions).toHaveLength(2);
    expect(groups[1]?.transactions).toHaveLength(1);
  });

  it('soma entradas, saidas e saldo de cada dia', () => {
    const groups = groupByDay([
      makeIncome({ date: '2026-10-10', amountCents: 230000 }),
      makeExpense({ date: '2026-10-10', amountCents: 12000 }),
      makeExpense({ date: '2026-10-10', amountCents: 8000 }),
    ]);

    const day = groups[0];
    expect(day?.incomeCents).toBe(230000);
    expect(day?.expenseCents).toBe(20000);
    expect(day?.netCents).toBe(210000);
  });

  it('aceita saldo negativo no dia, sem mascarar', () => {
    const groups = groupByDay([
      makeIncome({ date: '2026-10-10', amountCents: 5000 }),
      makeExpense({ date: '2026-10-10', amountCents: 30000 }),
    ]);

    expect(groups[0]?.netCents).toBe(-25000);
  });

  it('nao devolve R$ -0,00 quando entradas e saidas se anulam', () => {
    // `negateMoney(0)` ja produziu `-0` neste projeto, e o Intl formata isso
    // como "-R$ 0,00". A normalizacao de `toMoney` precisa continuar valendo.
    const groups = groupByDay([
      makeIncome({ date: '2026-10-10', amountCents: 10000 }),
      makeExpense({ date: '2026-10-10', amountCents: 10000 }),
    ]);

    expect(groups[0]?.netCents).toBe(0);
    expect(Object.is(groups[0]?.netCents, -0)).toBe(false);
  });

  it('coloca o lancamento criado mais recentemente no topo do dia', () => {
    // E onde o olho da pessoa ja esta depois de salvar.
    const groups = groupByDay([
      makeTransaction({
        date: '2026-10-10',
        description: 'Antiga',
        createdAt: '2026-10-10T09:00:00.000Z',
      }),
      makeTransaction({
        date: '2026-10-10',
        description: 'Recente',
        createdAt: '2026-10-10T18:00:00.000Z',
      }),
    ]);

    expect(groups[0]?.transactions.map((item) => item.description)).toEqual([
      'Recente',
      'Antiga',
    ]);
  });

  it('e estavel quando createdAt empata', () => {
    const transactions = [
      makeTransaction({ id: 'tx-b', date: '2026-10-10', createdAt: '2026-10-10T12:00:00.000Z' }),
      makeTransaction({ id: 'tx-a', date: '2026-10-10', createdAt: '2026-10-10T12:00:00.000Z' }),
    ];

    const once = groupByDay(transactions)[0]?.transactions.map((item) => item.id);
    const twice = groupByDay(transactions)[0]?.transactions.map((item) => item.id);

    expect(once).toEqual(['tx-a', 'tx-b']);
    expect(twice).toEqual(once);
  });

  it('nao muta a lista recebida', () => {
    const transactions = [
      makeExpense({ date: '2026-10-08' }),
      makeExpense({ date: '2026-10-10' }),
    ];
    const snapshot = [...transactions];

    groupByDay(transactions);

    expect(transactions).toEqual(snapshot);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(groupByDay([])).toEqual([]);
    expect(countInGroups([])).toBe(0);
  });

  it('conta o total de lancamentos de todos os grupos', () => {
    const groups = groupByDay([
      makeExpense({ date: '2026-10-08' }),
      makeExpense({ date: '2026-10-10' }),
      makeIncome({ date: '2026-10-10' }),
    ]);

    expect(countInGroups(groups)).toBe(3);
  });

  it('atravessa a virada de mes sem reordenar errado', () => {
    const groups = groupByDay([
      makeExpense({ date: '2026-09-30' }),
      makeExpense({ date: '2026-10-01' }),
    ]);

    expect(groups.map((group) => group.date)).toEqual(['2026-10-01', '2026-09-30']);
  });
});

describe('splitByToday', () => {
  const hoje = date('2026-10-08');
  const grupos = groupByDay([
    makeExpense({ date: '2026-10-31', description: 'Academia' }),
    makeExpense({ date: '2026-10-08', description: 'Mercado' }),
    makeExpense({ date: '2026-10-18', description: 'Cartao Inter' }),
    makeExpense({ date: '2026-10-05', description: 'Farmacia' }),
    makeExpense({ date: '2026-10-28', description: 'Cartao Magalu' }),
    makeExpense({ date: '2026-10-07', description: 'Padaria' }),
  ]);

  it('extrato ate hoje, do mais recente ao mais antigo', () => {
    expect(splitByToday(grupos, hoje).recorded.map((g) => g.date)).toEqual([
      '2026-10-08',
      '2026-10-07',
      '2026-10-05',
    ]);
  });

  it('proximos depois de hoje, em ordem de chegada', () => {
    expect(splitByToday(grupos, hoje).upcoming.map((g) => g.date)).toEqual([
      '2026-10-18',
      '2026-10-28',
      '2026-10-31',
    ]);
  });

  it('hoje pertence ao extrato, nao aos proximos', () => {
    const { recorded, upcoming } = splitByToday(grupos, hoje);
    expect(recorded.some((g) => g.date === hoje)).toBe(true);
    expect(upcoming.some((g) => g.date === hoje)).toBe(false);
  });

  it('nao perde nem duplica nenhum dia', () => {
    const { recorded, upcoming } = splitByToday(grupos, hoje);
    expect(recorded.length + upcoming.length).toBe(grupos.length);
  });

  it('mes encerrado: tudo e extrato', () => {
    expect(splitByToday(grupos, date('2026-11-02')).upcoming).toEqual([]);
  });

  it('mes futuro: tudo e proximo, em ordem crescente', () => {
    const { recorded, upcoming } = splitByToday(grupos, date('2026-09-30'));
    expect(recorded).toEqual([]);
    expect(upcoming[0]?.date).toBe('2026-10-05');
    expect(upcoming.at(-1)?.date).toBe('2026-10-31');
  });

  it('atravessa a virada do mes: amanha no mes seguinte e proximo', () => {
    const virada = groupByDay([
      makeExpense({ date: '2026-10-31' }),
      makeExpense({ date: '2026-11-01' }),
    ]);
    const { recorded, upcoming } = splitByToday(virada, date('2026-10-31'));
    expect(recorded.map((g) => g.date)).toEqual(['2026-10-31']);
    expect(upcoming.map((g) => g.date)).toEqual(['2026-11-01']);
  });
});
