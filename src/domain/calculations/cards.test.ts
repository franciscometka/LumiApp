import { describe, expect, it } from 'vitest';

import { date, makeExpense, makeIncome } from '../__testing__/factories';
import type { Card } from '../entities/card';
import { calculateTotals } from './totals';

import {
  buildCardOverview,
  sortCardsByDueDate,
  trackedExpenseCents,
  transactionsOfCard,
} from './cards';

type CardOverrides = Partial<Omit<Card, 'limitCents' | 'currentInvoiceCents'>> & {
  id: string;
  name: string;
  limitCents?: number;
  currentInvoiceCents?: number;
};

function makeCard(overrides: CardOverrides): Card {
  return {
    userId: 'user-teste',
    limitCents: 500000,
    closingDay: 20,
    dueDay: 28,
    currentInvoiceCents: 113900,
    colorToken: 'chart-1',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  } as Card;
}

const HOJE = date('2026-10-06');

describe('REGRA CENTRAL: fatura informada e transacoes nunca se somam', () => {
  it('a fatura do cartao nao entra em nenhum total do Dashboard', () => {
    // O Dashboard sai exclusivamente das transacoes. Um cartao com fatura de
    // R$ 1.139 nao pode alterar nada aqui — se alterasse, o mesmo dinheiro
    // seria contado pelo extrato e pelo banco ao mesmo tempo.
    const transactions = [
      makeIncome({ amountCents: 300000, date: '2026-10-01' }),
      makeExpense({ amountCents: 113900, date: '2026-10-15', cardId: 'card-inter' }),
    ];

    const totals = calculateTotals(transactions);

    expect(totals.expense).toBe(113900);
    expect(totals.balance).toBe(186100);

    // O overview do cartao conhece a fatura; os totais, nao.
    const overview = buildCardOverview(makeCard({ id: 'card-inter', name: 'Inter' }), HOJE);
    expect(overview.invoiceCents).toBe(113900);
    expect(totals.expense).not.toBe(overview.invoiceCents + 113900);
  });

  it('o gasto rastreado tem nome proprio e nao se chama fatura', () => {
    // `trackedExpenseCents` e `invoiceCents` podem ate coincidir; sao
    // grandezas diferentes e o codigo nao oferece como soma-las.
    const transactions = [
      makeExpense({ amountCents: 37400, cardId: 'card-inter' }),
      makeExpense({ amountCents: 76500, cardId: 'card-inter' }),
      makeExpense({ amountCents: 50000, cardId: 'card-magalu' }),
    ];

    expect(trackedExpenseCents(transactions, 'card-inter')).toBe(113900);
    expect(trackedExpenseCents(transactions, 'card-magalu')).toBe(50000);
  });

  it('o modulo nao expoe nenhuma funcao que combine as duas grandezas', async () => {
    // Trava de regressao: se alguem adicionar um `invoicePlusTracked`, este
    // teste quebra e obriga a conversa em vez de deixar passar.
    const exported = Object.keys(await import('./cards'));

    expect(exported.sort()).toEqual([
      'buildCardOverview',
      'sortCardsByDueDate',
      'trackedExpenseCents',
      'transactionsOfCard',
    ]);
  });

  it('gasto rastreado ignora entradas', () => {
    const transactions = [
      makeIncome({ amountCents: 100000, cardId: 'card-inter' }),
      makeExpense({ amountCents: 30000, cardId: 'card-inter' }),
    ];

    expect(trackedExpenseCents(transactions, 'card-inter')).toBe(30000);
  });

  it('cartao sem transacao rastreada devolve zero, nao a fatura', () => {
    expect(trackedExpenseCents([], 'card-inter')).toBe(0);
    expect(transactionsOfCard([], 'card-inter')).toEqual([]);
  });
});

describe('buildCardOverview', () => {
  it('deriva disponivel, uso e datas', () => {
    const overview = buildCardOverview(
      makeCard({ id: 'c1', name: 'Inter', limitCents: 500000, currentInvoiceCents: 113900 }),
      HOJE,
    );

    expect(overview.invoiceCents).toBe(113900);
    expect(overview.availableCents).toBe(386100);
    expect(overview.usagePercentage).toBeCloseTo(22.78, 2);
    expect(overview.isOverLimit).toBe(false);
    expect(overview.nextClosing).toBe('2026-10-20');
    expect(overview.nextDue).toBe('2026-10-28');
  });

  it('disponivel nunca fica negativo, mas o estouro e sinalizado', () => {
    const overview = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', limitCents: 100000, currentInvoiceCents: 150000 }),
      HOJE,
    );

    expect(overview.availableCents).toBe(0);
    expect(overview.isOverLimit).toBe(true);
    expect(overview.usagePercentage).toBe(150);
  });

  it('sem limite cadastrado o uso e null, nunca 0%', () => {
    const overview = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', limitCents: 0, currentInvoiceCents: 0 }),
      HOJE,
    );

    expect(overview.usagePercentage).toBeNull();
  });

  it('empurra vencimento e fechamento ja passados para o mes seguinte', () => {
    const overview = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', closingDay: 1, dueDay: 5 }),
      date('2026-10-06'),
    );

    expect(overview.nextClosing).toBe('2026-11-01');
    expect(overview.nextDue).toBe('2026-11-05');
  });

  it('dia 31 cai no ultimo dia de fevereiro, sem transbordar para marco', () => {
    const comum = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', closingDay: 31, dueDay: 31 }),
      date('2027-02-01'),
    );
    expect(comum.nextDue).toBe('2027-02-28');

    const bissexto = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', closingDay: 31, dueDay: 31 }),
      date('2028-02-01'),
    );
    expect(bissexto.nextDue).toBe('2028-02-29');
  });

  it('dia 30 em fevereiro tambem e ajustado', () => {
    const overview = buildCardOverview(
      makeCard({ id: 'c1', name: 'X', dueDay: 30, closingDay: 29 }),
      date('2027-02-10'),
    );

    expect(overview.nextDue).toBe('2027-02-28');
  });
});

describe('sortCardsByDueDate', () => {
  it('ordena pelo proximo vencimento', () => {
    const cards = [
      makeCard({ id: 'c1', name: 'Vence 28', dueDay: 28 }),
      makeCard({ id: 'c2', name: 'Vence 10', dueDay: 10 }),
      makeCard({ id: 'c3', name: 'Vence 15', dueDay: 15 }),
    ];

    expect(sortCardsByDueDate(cards, HOJE).map((c) => c.name)).toEqual([
      'Vence 10',
      'Vence 15',
      'Vence 28',
    ]);
  });

  it('um vencimento ja passado vai para o fim, porque e do mes que vem', () => {
    const cards = [
      makeCard({ id: 'c1', name: 'Dia 2', dueDay: 2 }),
      makeCard({ id: 'c2', name: 'Dia 20', dueDay: 20 }),
    ];

    // Hoje e 06/10: o dia 2 ja passou e so volta em novembro.
    expect(sortCardsByDueDate(cards, HOJE).map((c) => c.name)).toEqual(['Dia 20', 'Dia 2']);
  });

  it('empate resolvido pelo nome, para a lista nao dancar entre renders', () => {
    const cards = [
      makeCard({ id: 'c1', name: 'Zeta', dueDay: 15 }),
      makeCard({ id: 'c2', name: 'Alfa', dueDay: 15 }),
    ];

    const uma = sortCardsByDueDate(cards, HOJE).map((c) => c.name);
    expect(uma).toEqual(['Alfa', 'Zeta']);
    expect(sortCardsByDueDate(cards, HOJE).map((c) => c.name)).toEqual(uma);
  });

  it('nao muta a lista recebida', () => {
    const cards = [
      makeCard({ id: 'c1', name: 'B', dueDay: 28 }),
      makeCard({ id: 'c2', name: 'A', dueDay: 5 }),
    ];
    const antes = cards.map((c) => c.id);

    sortCardsByDueDate(cards, HOJE);

    expect(cards.map((c) => c.id)).toEqual(antes);
  });
});
