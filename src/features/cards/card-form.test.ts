import { describe, expect, it } from 'vitest';

import type { Card } from '@/domain/entities/card';
import { findCardNameConflict, normalizeCardName } from '@/domain/entities/card';

import {
  cardValuesFrom,
  emptyCardValues,
  validateCardForm,
  validateInvoice,
} from './card-form';
import type { CardFormValues } from './card-form';

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

function values(overrides: Partial<CardFormValues> = {}): CardFormValues {
  return {
    ...emptyCardValues(),
    name: 'Inter',
    limit: '5.000,00',
    invoice: '1.139,00',
    closingDay: '20',
    dueDay: '28',
    ...overrides,
  };
}

describe('valores do cartao', () => {
  it('converte pelo caminho canonico, sem float', () => {
    const result = validateCardForm(values({ limit: '5000', invoice: '1.139,00' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.limitCents).toBe(500000);
      expect(result.draft.currentInvoiceCents).toBe(113900);
    }
  });

  it('aceita zero: um cartao sem fatura aberta e um fato normal', () => {
    // Diferente da transacao, onde zero e invalido. Aqui zero e informacao.
    const result = validateCardForm(values({ invoice: '0', limit: '0' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.currentInvoiceCents).toBe(0);
      expect(result.draft.limitCents).toBe(0);
    }
  });

  it('campo vazio vale zero, nao erro', () => {
    const result = validateCardForm(values({ invoice: '', limit: '' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.currentInvoiceCents).toBe(0);
      expect(result.draft.limitCents).toBe(0);
    }
  });

  it('recusa negativo', () => {
    expect(validateCardForm(values({ invoice: '-100' })).ok).toBe(false);
    expect(validateCardForm(values({ limit: '-1' })).ok).toBe(false);
  });

  it('recusa texto sem numero', () => {
    const result = validateCardForm(values({ invoice: 'abc' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.invoice).toBeDefined();
  });

  it('nao perde centavos em valores classicos de erro de float', () => {
    for (const [texto, esperado] of [
      ['0,07', 7],
      ['0,29', 29],
      ['1.234,56', 123456],
    ] as const) {
      const result = validateCardForm(values({ invoice: texto }));
      if (result.ok) expect(result.draft.currentInvoiceCents).toBe(esperado);
    }
  });
});

describe('nome e dias', () => {
  it('exige nome e corta espacos', () => {
    expect(validateCardForm(values({ name: '   ' })).ok).toBe(false);

    const result = validateCardForm(values({ name: '  Inter  ' }));
    if (result.ok) expect(result.draft.name).toBe('Inter');
  });

  it('aceita dia 31 nos dois campos — o dominio ajusta em fevereiro', () => {
    const result = validateCardForm(values({ closingDay: '31', dueDay: '31' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.closingDay).toBe(31);
      expect(result.draft.dueDay).toBe(31);
    }
  });

  it('recusa dia fora de 1-31', () => {
    for (const dia of ['0', '32', '', 'x', '100']) {
      expect(validateCardForm(values({ dueDay: dia })).ok, dia).toBe(false);
      expect(validateCardForm(values({ closingDay: dia })).ok, dia).toBe(false);
    }
  });

  it('fechamento depois do vencimento e permitido', () => {
    // Fecha dia 28 e vence dia 5 do mes seguinte e arranjo comum; o app nao
    // tem por que opinar sobre a politica do banco.
    expect(validateCardForm(values({ closingDay: '28', dueDay: '5' })).ok).toBe(true);
  });

  it('acumula todos os erros de uma vez', () => {
    const result = validateCardForm(
      values({ name: '', invoice: 'x', limit: 'y', closingDay: '0', dueDay: '99' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'closingDay',
        'dueDay',
        'invoice',
        'limit',
        'name',
      ]);
    }
  });
});

describe('ida e volta', () => {
  it('a edicao mostra valores em reais, nao centavos', () => {
    const card = makeCard({ id: 'c1', name: 'Inter', currentInvoiceCents: 113900 });
    expect(cardValuesFrom(card).invoice).toBe('1.139,00');
  });

  it('editar e salvar sem mudar nada devolve os mesmos dados', () => {
    const card = makeCard({
      id: 'c1',
      name: 'Magalu',
      limitCents: 300000,
      currentInvoiceCents: 76500,
      closingDay: 10,
      dueDay: 18,
      colorToken: 'chart-3',
    });

    const result = validateCardForm(cardValuesFrom(card));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft).toEqual({
        name: 'Magalu',
        limitCents: 300000,
        currentInvoiceCents: 76500,
        closingDay: 10,
        dueDay: 18,
        colorToken: 'chart-3',
      });
    }
  });
});

describe('validateInvoice — atualizacao rapida', () => {
  it('aceita os mesmos formatos do formulario completo', () => {
    expect(validateInvoice('1.139,00')).toBe(113900);
    expect(validateInvoice('1139')).toBe(113900);
    expect(validateInvoice('0')).toBe(0);
    expect(validateInvoice('')).toBe(0);
  });

  it('recusa negativo e texto invalido', () => {
    expect(validateInvoice('-10')).toBeNull();
    expect(validateInvoice('abc')).toBeNull();
  });
});

describe('nome unico entre cartoes ativos', () => {
  const nubank = makeCard({ id: 'c-nu', name: 'Nubank' });
  const existentes = [nubank, makeCard({ id: 'c-inter', name: 'Inter' })];

  it('normaliza caixa, acento e espacos', () => {
    expect(normalizeCardName('  NÚBANK ')).toBe('nubank');
    expect(normalizeCardName('Nu   Bank')).toBe('nu bank');
    expect(normalizeCardName('Crédito Itaú')).toBe('credito itau');
  });

  it('bloqueia o mesmo nome escrito de outro jeito', () => {
    for (const nome of ['Nubank', 'nubank', 'NÚBANK', '  Nubank  ', 'nUbAnK']) {
      const result = validateCardForm(values({ name: nome }), existentes);
      expect(result.ok, nome).toBe(false);
      if (!result.ok) expect(result.errors.name).toContain('Já existe um cartão chamado "Nubank"');
    }
  });

  it('nome diferente passa', () => {
    expect(validateCardForm(values({ name: 'Nubank PJ' }), existentes).ok).toBe(true);
  });

  it('o proprio cartao em edicao nao conflita consigo', () => {
    expect(validateCardForm(values({ name: 'NUBANK' }), existentes, 'c-nu').ok).toBe(true);
  });

  it('editar um cartao para o nome de OUTRO e bloqueado', () => {
    expect(validateCardForm(values({ name: 'inter' }), existentes, 'c-nu').ok).toBe(false);
  });

  it('cartao excluido nao bloqueia o nome', () => {
    const excluido = makeCard({ id: 'c-old', name: 'Magalu', deletedAt: '2026-10-01T00:00:00.000Z' });
    expect(validateCardForm(values({ name: 'Magalu' }), [excluido]).ok).toBe(true);
    expect(findCardNameConflict('Magalu', [excluido])).toBeNull();
  });

  it('cartao arquivado nao e ativo e nao bloqueia', () => {
    const arquivado = makeCard({ id: 'c-arq', name: 'Magalu', archivedAt: '2026-10-01T00:00:00.000Z' });
    expect(findCardNameConflict('magalu', [arquivado])).toBeNull();
  });

  it('sem lista de comparacao, nao ha conflito a apontar', () => {
    expect(validateCardForm(values({ name: 'Nubank' })).ok).toBe(true);
  });
});
