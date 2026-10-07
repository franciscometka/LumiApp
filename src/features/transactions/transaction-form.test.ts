import { describe, expect, it } from 'vitest';

import type { Category } from '@/domain/entities/category';
import { toPlainDate } from '@/domain/shared/plain-date';

import {
  categoriesForType,
  changeType,
  emptyFormValues,
  formValuesFromTransaction,
  hasOrphanCategory,
  needsAdvancedSection,
  validateForm,
} from './transaction-form';
import type { TransactionFormValues } from './transaction-form';

import { makeExpense } from '@/domain/__testing__/factories';

/* ------------------------------------------------------------------ *
 * Apoio
 * ------------------------------------------------------------------ */

function makeCategory(overrides: Partial<Category> & { id: string }): Category {
  return {
    userId: 'user-teste',
    name: 'Categoria',
    kind: 'expense',
    icon: 'circle',
    colorToken: 'chart-1',
    isSystem: false,
    order: 0,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  } as Category;
}

const CARRO = makeCategory({ id: 'cat-carro', name: 'Carro', kind: 'expense', order: 1 });
const SALARIO = makeCategory({ id: 'cat-salario', name: 'Salário', kind: 'income', order: 2 });
const OUTROS = makeCategory({ id: 'cat-outros', name: 'Outros', kind: 'both', order: 3 });
const ARQUIVADA = makeCategory({
  id: 'cat-velha',
  name: 'Antiga',
  kind: 'expense',
  order: 0,
  archivedAt: '2026-09-01T12:00:00.000Z',
});

const CATEGORIES = [ARQUIVADA, CARRO, SALARIO, OUTROS];

const HOJE = toPlainDate('2026-10-05');

function values(overrides: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return { ...emptyFormValues(HOJE), description: 'Internet', categoryId: 'cat-carro', ...overrides };
}

/* ------------------------------------------------------------------ *
 * Valor
 * ------------------------------------------------------------------ */

describe('valor digitado', () => {
  it('interpreta os formatos que o usuario brasileiro realmente digita', () => {
    const casos: readonly [string, number][] = [
      ['10', 1000],
      ['10,5', 1050],
      ['10,50', 1050],
      ['1.234,56', 123456],
      // Variacoes que aparecem na pratica.
      ['1234,56', 123456],
      ['0,99', 99],
      ['1.500', 150000],
      ['  42  ', 4200],
      ['999999,99', 99999999],
    ];

    for (const [texto, esperado] of casos) {
      const result = validateForm(values({ amount: texto }), CATEGORIES);
      expect(result.ok, `"${texto}" deveria ser aceito`).toBe(true);
      if (result.ok) expect(result.draft.amountCents, `"${texto}"`).toBe(esperado);
    }
  });

  it('recusa vazio com mensagem propria', () => {
    const result = validateForm(values({ amount: '' }), CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.amount).toBe('Informe um valor.');
  });

  it('recusa zero: um lancamento de R$ 0,00 nao e um lancamento', () => {
    for (const texto of ['0', '0,00', '0,0', '00']) {
      const result = validateForm(values({ amount: texto }), CATEGORIES);
      expect(result.ok, `"${texto}"`).toBe(false);
      if (!result.ok) {
        expect(result.errors.amount).toBe('O valor precisa ser maior que zero.');
      }
    }
  });

  it('recusa negativo: o sinal vem do tipo, nao do numero', () => {
    // "-50" num gasto seria uma entrada disfarcada de saida.
    const result = validateForm(values({ amount: '-50' }), CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.amount).toBe('O valor precisa ser maior que zero.');
  });

  it('recusa texto sem numero nenhum', () => {
    for (const texto of ['abc', ',', '.', 'R$', '--']) {
      const result = validateForm(values({ amount: texto }), CATEGORIES);
      expect(result.ok, `"${texto}"`).toBe(false);
      if (!result.ok) expect(result.errors.amount).toContain('não reconhecido');
    }
  });

  it('o valor nunca passa por float', () => {
    // 0,07 e 0,29 sao os casos classicos de erro de ponto flutuante:
    // 0.07 * 100 === 7.000000000000001 em IEEE 754.
    for (const [texto, esperado] of [
      ['0,07', 7],
      ['0,29', 29],
      ['1,15', 115],
      ['8,20', 820],
    ] as const) {
      const result = validateForm(values({ amount: texto }), CATEGORIES);
      if (result.ok) {
        expect(result.draft.amountCents).toBe(esperado);
        expect(Number.isInteger(result.draft.amountCents)).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * Demais campos
 * ------------------------------------------------------------------ */

describe('descricao, categoria e data', () => {
  it('exige descricao e corta espacos', () => {
    const vazio = validateForm(values({ amount: '10', description: '   ' }), CATEGORIES);
    expect(vazio.ok).toBe(false);
    if (!vazio.ok) expect(vazio.errors.description).toBe('Descreva o lançamento.');

    const comEspaco = validateForm(
      values({ amount: '10', description: '  Internet  ' }),
      CATEGORIES,
    );
    expect(comEspaco.ok).toBe(true);
    if (comEspaco.ok) expect(comEspaco.draft.description).toBe('Internet');
  });

  it('exige categoria', () => {
    const result = validateForm(values({ amount: '10', categoryId: '' }), CATEGORIES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.categoryId).toBe('Escolha uma categoria.');
  });

  it('recusa data invalida', () => {
    for (const data of ['', '2026-02-30', '2026-13-01', 'ontem']) {
      const result = validateForm(values({ amount: '10', date: data }), CATEGORIES);
      expect(result.ok, data).toBe(false);
      if (!result.ok) expect(result.errors.date).toBe('Data inválida.');
    }
  });

  it('aceita 29 de fevereiro em ano bissexto e recusa fora dele', () => {
    const bissexto = validateForm(values({ amount: '10', date: '2028-02-29' }), CATEGORIES);
    expect(bissexto.ok).toBe(true);

    const comum = validateForm(values({ amount: '10', date: '2027-02-29' }), CATEGORIES);
    expect(comum.ok).toBe(false);
  });

  it('acumula todos os erros de uma vez, nao um por envio', () => {
    const result = validateForm(
      values({ amount: '', description: '', categoryId: '', date: 'x' }),
      CATEGORIES,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'amount',
        'categoryId',
        'date',
        'description',
      ]);
    }
  });

  it('omite campos opcionais vazios em vez de gravar string vazia', () => {
    const result = validateForm(values({ amount: '10', notes: '   ' }), CATEGORIES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('notes' in result.draft).toBe(false);
      expect('cardId' in result.draft).toBe(false);
      expect('debtId' in result.draft).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Entrada x gasto
 * ------------------------------------------------------------------ */

describe('troca de tipo', () => {
  it('limpa a categoria incompativel em vez de mante-la em silencio', () => {
    // "Carro" num lancamento de entrada seria absurdo e nada na tela diria.
    const antes = values({ categoryId: 'cat-carro' });
    const depois = changeType(antes, 'income', CATEGORIES);

    expect(depois.type).toBe('income');
    expect(depois.categoryId).toBe('');
  });

  it('preserva a categoria que serve aos dois lados', () => {
    const depois = changeType(values({ categoryId: 'cat-outros' }), 'income', CATEGORIES);
    expect(depois.categoryId).toBe('cat-outros');
  });

  it('nao mexe em nada quando o tipo nao muda', () => {
    const antes = values({ categoryId: 'cat-carro' });
    expect(changeType(antes, 'expense', CATEGORIES)).toBe(antes);
  });

  it('volta a natureza para movimento do mes ao virar gasto', () => {
    const antes = values({ type: 'income', flow: 'transfer', categoryId: 'cat-outros' });
    expect(changeType(antes, 'expense', CATEGORIES).flow).toBe('operational');
  });

  it('a validacao tambem barra categoria incompativel', () => {
    const result = validateForm(
      values({ amount: '10', type: 'income', categoryId: 'cat-carro' }),
      CATEGORIES,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.categoryId).toContain('não serve');
  });

  it('detecta categoria orfa (excluida do repositorio)', () => {
    expect(hasOrphanCategory(values({ categoryId: 'cat-sumiu' }), CATEGORIES)).toBe(true);
    expect(hasOrphanCategory(values({ categoryId: 'cat-carro' }), CATEGORIES)).toBe(false);
    expect(hasOrphanCategory(values({ categoryId: '' }), CATEGORIES)).toBe(false);
  });
});

describe('categoriesForType', () => {
  it('oferece as do tipo mais as de ambos, em ordem', () => {
    expect(categoriesForType(CATEGORIES, 'expense').map((c) => c.id)).toEqual([
      'cat-carro',
      'cat-outros',
    ]);
    expect(categoriesForType(CATEGORIES, 'income').map((c) => c.id)).toEqual([
      'cat-salario',
      'cat-outros',
    ]);
  });

  it('esconde categoria arquivada', () => {
    expect(categoriesForType(CATEGORIES, 'expense').map((c) => c.id)).not.toContain('cat-velha');
  });
});

/* ------------------------------------------------------------------ *
 * Ida e volta
 * ------------------------------------------------------------------ */

describe('criacao e edicao', () => {
  it('o padrao de criacao e um gasto pago de hoje', () => {
    const inicial = emptyFormValues(HOJE);
    expect(inicial.type).toBe('expense');
    expect(inicial.status).toBe('paid');
    expect(inicial.date).toBe('2026-10-05');
    expect(inicial.amount).toBe('');
  });

  it('a edicao mostra o valor em reais, nao em centavos', () => {
    const transaction = makeExpense({ amountCents: 113900, description: 'Cartão' });
    expect(formValuesFromTransaction(transaction).amount).toBe('1.139,00');
  });

  it('editar e salvar sem tocar em nada devolve os mesmos dados', () => {
    const transaction = makeExpense({
      amountCents: 44000,
      description: 'Empréstimo',
      categoryId: 'cat-carro',
      date: '2026-10-20',
      status: 'pending',
    });

    const result = validateForm(formValuesFromTransaction(transaction), CATEGORIES);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.amountCents).toBe(44000);
      expect(result.draft.description).toBe('Empréstimo');
      expect(result.draft.date).toBe('2026-10-20');
      expect(result.draft.status).toBe('pending');
      expect(result.draft.type).toBe('expense');
    }
  });

  it('preserva vinculos existentes na edicao', () => {
    const transaction = makeExpense({
      amountCents: 44000,
      categoryId: 'cat-carro',
      debtId: 'debt-1',
      notes: 'parcela 3',
    });

    const result = validateForm(formValuesFromTransaction(transaction), CATEGORIES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.debtId).toBe('debt-1');
      expect(result.draft.notes).toBe('parcela 3');
    }
  });

  it('abre "Mais opções" quando a transacao depende desses campos', () => {
    expect(needsAdvancedSection(emptyFormValues(HOJE))).toBe(false);
    expect(needsAdvancedSection(values({ notes: 'alguma coisa' }))).toBe(true);
    expect(needsAdvancedSection(values({ debtId: 'debt-1' }))).toBe(true);
    expect(needsAdvancedSection(values({ flow: 'transfer' }))).toBe(true);
  });
});
