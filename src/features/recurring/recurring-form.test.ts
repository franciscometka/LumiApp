import { describe, expect, it } from 'vitest';

import type { Category } from '@/domain/entities/category';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import { isActiveInMonth } from '@/domain/entities/recurring-bill';
import { toMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import {
  changeType,
  emptyRecurringValues,
  endMonthPatch,
  hasEnded,
  recurringValuesFrom,
  validateRecurringForm,
} from './recurring-form';
import type { RecurringFormValues } from './recurring-form';

const m = (value: string) => toMonthKey(value) as MonthKey;
const OUTUBRO = m('2026-10');

function makeCategory(overrides: Partial<Category> & { id: string }): Category {
  return {
    userId: 'user-teste',
    name: 'Categoria',
    kind: 'expense',
    icon: 'circle',
    colorToken: 'chart-1',
    isSystem: false,
    order: 0,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  } as Category;
}

const INTERNET = makeCategory({ id: 'cat-internet', name: 'Internet' });
const SALARIO = makeCategory({ id: 'cat-salario', name: 'Salário', kind: 'income' });
const CATEGORIES = [INTERNET, SALARIO];

function values(overrides: Partial<RecurringFormValues> = {}): RecurringFormValues {
  return {
    ...emptyRecurringValues(OUTUBRO),
    description: 'Internet',
    amount: '120,00',
    categoryId: 'cat-internet',
    dueDay: '10',
    ...overrides,
  };
}

describe('validacao', () => {
  it('aceita o cadastro minimo', () => {
    const result = validateRecurringForm(values(), CATEGORIES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.amountCents).toBe(12000);
      expect(result.draft.dueDay).toBe(10);
      expect(result.draft.startMonth).toBe(OUTUBRO);
      expect(result.draft.isActive).toBe(true);
      expect('endMonth' in result.draft).toBe(false);
    }
  });

  it('usa o caminho canonico de dinheiro', () => {
    for (const [texto, esperado] of [
      ['120', 12000],
      ['120,5', 12050],
      ['1.234,56', 123456],
    ] as const) {
      const result = validateRecurringForm(values({ amount: texto }), CATEGORIES);
      if (result.ok) expect(result.draft.amountCents).toBe(esperado);
    }
  });

  it('recusa valor vazio, zero e negativo', () => {
    for (const texto of ['', '0', '-50']) {
      expect(validateRecurringForm(values({ amount: texto }), CATEGORIES).ok, texto).toBe(false);
    }
  });

  it('recusa dia fora de 1-31 e aceita 31', () => {
    expect(validateRecurringForm(values({ dueDay: '31' }), CATEGORIES).ok).toBe(true);
    for (const dia of ['0', '32', '', 'x']) {
      expect(validateRecurringForm(values({ dueDay: dia }), CATEGORIES).ok, dia).toBe(false);
    }
  });

  it('recusa mes invalido', () => {
    expect(validateRecurringForm(values({ startMonth: '2026-13' }), CATEGORIES).ok).toBe(false);
    expect(validateRecurringForm(values({ startMonth: '' }), CATEGORIES).ok).toBe(false);
  });

  it('recusa categoria incompativel com o tipo', () => {
    const result = validateRecurringForm(
      values({ type: 'income', categoryId: 'cat-internet' }),
      CATEGORIES,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.categoryId).toContain('não serve');
  });
});

describe('endMonth', () => {
  it('em branco significa sem termino', () => {
    const result = validateRecurringForm(values({ endMonth: '' }), CATEGORIES);
    expect(result.ok).toBe(true);
    if (result.ok) expect('endMonth' in result.draft).toBe(false);
  });

  it('grava o ultimo mes quando informado', () => {
    const result = validateRecurringForm(values({ endMonth: '2026-12' }), CATEGORIES);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.endMonth).toBe('2026-12');
  });

  it('aceita encerrar no mesmo mes em que comeca', () => {
    // Uma conta que existiu por um mes so e legitima.
    const result = validateRecurringForm(
      values({ startMonth: '2026-10', endMonth: '2026-10' }),
      CATEGORIES,
    );
    expect(result.ok).toBe(true);
  });

  it('recusa terminar antes de comecar', () => {
    const result = validateRecurringForm(
      values({ startMonth: '2026-10', endMonth: '2026-09' }),
      CATEGORIES,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.endMonth).toContain('antes do primeiro');
  });
});

describe('hasEnded e a vigencia', () => {
  function makeBill(overrides: Partial<RecurringBill> = {}): RecurringBill {
    return {
      id: 'bill-1',
      userId: 'user-teste',
      description: 'Internet',
      amountCents: 12000,
      type: 'expense',
      categoryId: 'cat-internet',
      dueDay: 10,
      paymentMethod: 'boleto',
      isActive: true,
      startMonth: m('2026-01'),
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
      ...overrides,
    } as RecurringBill;
  }

  it('sem endMonth, nunca encerrada', () => {
    expect(hasEnded(makeBill(), m('2030-12'))).toBe(false);
  });

  it('nao esta encerrada NO proprio endMonth — ainda gera', () => {
    const bill = makeBill({ endMonth: OUTUBRO });

    expect(hasEnded(bill, OUTUBRO)).toBe(false);
    expect(isActiveInMonth(bill, OUTUBRO)).toBe(true);
  });

  it('esta encerrada no mes seguinte — nao gera mais', () => {
    const bill = makeBill({ endMonth: OUTUBRO });

    expect(hasEnded(bill, m('2026-11'))).toBe(true);
    expect(isActiveInMonth(bill, m('2026-11'))).toBe(false);
  });

  it('funciona na virada do ano', () => {
    const bill = makeBill({ endMonth: m('2026-12') });

    expect(hasEnded(bill, m('2026-12'))).toBe(false);
    expect(hasEnded(bill, m('2027-01'))).toBe(true);
    expect(isActiveInMonth(bill, m('2027-01'))).toBe(false);
  });

  it('endMonthPatch encerra no mes dado', () => {
    expect(endMonthPatch(OUTUBRO)).toEqual({ endMonth: OUTUBRO });
  });
});

describe('troca de tipo', () => {
  it('limpa a categoria incompativel', () => {
    const depois = changeType(values({ categoryId: 'cat-internet' }), 'income', CATEGORIES);
    expect(depois.type).toBe('income');
    expect(depois.categoryId).toBe('');
  });

  it('nao mexe quando o tipo e o mesmo', () => {
    const antes = values();
    expect(changeType(antes, 'expense', CATEGORIES)).toBe(antes);
  });
});

describe('ida e volta', () => {
  it('editar e salvar sem mudar nada preserva tudo', () => {
    const bill = {
      id: 'bill-1',
      userId: 'user-teste',
      description: 'Internet',
      amountCents: 12000,
      type: 'expense',
      categoryId: 'cat-internet',
      dueDay: 10,
      paymentMethod: 'boleto',
      isActive: true,
      startMonth: m('2026-01'),
      endMonth: m('2026-12'),
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
    } as RecurringBill;

    const result = validateRecurringForm(recurringValuesFrom(bill), CATEGORIES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft).toMatchObject({
        description: 'Internet',
        amountCents: 12000,
        dueDay: 10,
        startMonth: '2026-01',
        endMonth: '2026-12',
      });
    }
  });

  it('o novo cadastro comeca no mes que a pessoa esta vendo', () => {
    expect(emptyRecurringValues(m('2027-03')).startMonth).toBe('2027-03');
  });
});
