import { describe, expect, it } from 'vitest';

import { briefingScenario, makeExpense } from '@/domain/__testing__/factories';
import { toMoney } from '@/domain/shared/money';

import { DataError } from '../ports/errors';
import { cardCodec, createCodec, transactionCodec } from './codecs';

describe('fronteira JSON <-> dominio', () => {
  it('serializa e reconstroi sem perder nada', () => {
    for (const original of briefingScenario()) {
      const json = transactionCodec.serialize(original);
      const texto = JSON.stringify(json);
      const reconstruida = transactionCodec.parse(JSON.parse(texto));

      expect(reconstruida).toEqual(original);
    }
  });

  it('preserva os tipos nominais na volta', () => {
    const original = makeExpense({ amountCents: 91100, date: '2026-10-08' });
    const volta = transactionCodec.parse(JSON.parse(JSON.stringify(transactionCodec.serialize(original))));

    // `Money` e `PlainDate` so existem no sistema de tipos; o que importa e que
    // a reconstrucao passou pela validacao e os valores saem corretos.
    expect(volta.amountCents).toBe(91100);
    expect(volta.date).toBe('2026-10-08');
    expect(Number.isSafeInteger(volta.amountCents)).toBe(true);
  });

  it('remove chaves undefined em vez de depender do JSON.stringify', () => {
    const semOpcionais = makeExpense();
    const json = transactionCodec.serialize(semOpcionais) as Record<string, unknown>;

    expect('notes' in json).toBe(false);
    expect('cardId' in json).toBe(false);
    expect('deletedAt' in json).toBe(false);
    expect(json.description).toBe('Lancamento');
  });

  it('mantem os campos opcionais presentes', () => {
    const comOpcionais = makeExpense({ notes: 'Mercado do mês', cardId: 'card-1' });
    const json = transactionCodec.serialize(comOpcionais) as Record<string, unknown>;

    expect(json.notes).toBe('Mercado do mês');
    expect(json.cardId).toBe('card-1');
  });
});

describe('validacao na entrada', () => {
  it('recusa registro invalido ao parsear', () => {
    expect(() => transactionCodec.parse({ ...makeExpense(), amountCents: -1 })).toThrow(DataError);
    expect(() => transactionCodec.parse(null)).toThrow(DataError);
    expect(() => transactionCodec.parse('texto')).toThrow(DataError);
  });

  it('safeParse nao lanca e localiza o problema', () => {
    const resultado = transactionCodec.safeParse({ ...makeExpense(), date: '2026-02-30' }, 7);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;

    expect(resultado.issues[0]?.collection).toBe('transactions');
    expect(resultado.issues[0]?.index).toBe(7);
    expect(resultado.issues[0]?.path).toBe('date');
    expect(resultado.issues[0]?.id).not.toBeNull();
  });

  it('reporta registro sem id sem quebrar', () => {
    const resultado = transactionCodec.safeParse({ qualquerCoisa: true }, 0);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.issues[0]?.id).toBeNull();
  });
});

describe('validacao na saida', () => {
  it('recusa serializar entidade corrompida em memoria', () => {
    // Nada invalido pode chegar ao storage, mesmo vindo de dentro do app.
    const corrompida = { ...makeExpense(), amountCents: Number.NaN as never };
    expect(() => transactionCodec.serialize(corrompida)).toThrow(DataError);
  });

  it('recusa numero nao finito', () => {
    const codec = createCodec('teste', cardCodec as never);
    expect(codec).toBeDefined();

    const cartao = {
      id: 'card-1',
      userId: 'user-1',
      name: 'Inter',
      limitCents: toMoney(300000),
      closingDay: 20,
      dueDay: 28,
      currentInvoiceCents: Number.POSITIVE_INFINITY as never,
      colorToken: 'chart-1' as const,
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-01T09:00:00.000Z',
    };

    expect(() => cardCodec.serialize(cartao)).toThrow(DataError);
  });
});
