import { describe, expect, it } from 'vitest';

import type { Debt } from '@/domain/entities/debt';
import { hasSchedule, progressPercentage, remainingAmount } from '@/domain/entities/debt';

import {
  advancePaidInstallments,
  debtValuesFrom,
  emptyDebtValues,
  validateDebtForm,
} from './debt-form';
import type { DebtFormValues } from './debt-form';

type DebtOverrides = Partial<Omit<Debt, 'installmentCents' | 'startDate'>> & {
  id: string;
  name: string;
  installmentCents?: number;
  startDate?: string;
};

function makeDebt(overrides: DebtOverrides): Debt {
  return {
    userId: 'user-teste',
    installmentCents: 44000,
    dueDay: 20,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  } as Debt;
}

function values(overrides: Partial<DebtFormValues> = {}): DebtFormValues {
  return {
    ...emptyDebtValues(),
    name: 'Empréstimo',
    installment: '440,00',
    dueDay: '20',
    ...overrides,
  };
}

describe('cronograma ausente nao vira zero', () => {
  it('sem "sei o prazo", os tres campos sao OMITIDOS do rascunho', () => {
    // Gravar zero seria uma afirmacao: "zero parcelas pagas de zero".
    // Omitir e outra coisa: "nao sei".
    const result = validateDebtForm(values({ knowsSchedule: false }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('totalInstallments' in result.draft).toBe(false);
      expect('paidInstallments' in result.draft).toBe(false);
      expect('startDate' in result.draft).toBe(false);
    }
  });

  it('ignora o que foi digitado nos campos de prazo quando o interruptor esta desligado', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: false, totalInstallments: '24', paidInstallments: '9' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect('totalInstallments' in result.draft).toBe(false);
  });

  it('a divida resultante devolve null em tudo que depende de prazo', () => {
    const result = validateDebtForm(values({ knowsSchedule: false }));
    if (!result.ok) throw new Error('rascunho deveria ser valido');

    const debt = makeDebt({ id: 'd1', ...result.draft });

    expect(hasSchedule(debt)).toBe(false);
    expect(progressPercentage(debt)).toBeNull();
    expect(remainingAmount(debt)).toBeNull();
  });

  it('o padrao do formulario novo e NAO saber o prazo', () => {
    expect(emptyDebtValues().knowsSchedule).toBe(false);
  });
});

describe('cronograma informado', () => {
  it('grava total e pagas', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: true, totalInstallments: '24', paidInstallments: '9' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.totalInstallments).toBe(24);
      expect(result.draft.paidInstallments).toBe(9);
    }
  });

  it('aceita zero parcelas pagas como afirmacao legitima', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: true, totalInstallments: '24', paidInstallments: '0' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.paidInstallments).toBe(0);
  });

  it('recusa pagas maiores que o total', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: true, totalInstallments: '10', paidInstallments: '11' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.paidInstallments).toContain('não podem passar');
  });

  it('exige os dois campos quando o prazo e conhecido', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: true, totalInstallments: '', paidInstallments: '' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.totalInstallments).toBeDefined();
      expect(result.errors.paidInstallments).toBeDefined();
    }
  });

  it('a data de inicio continua opcional mesmo com prazo conhecido', () => {
    const result = validateDebtForm(
      values({ knowsSchedule: true, totalInstallments: '24', paidInstallments: '9', startDate: '' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect('startDate' in result.draft).toBe(false);
  });

  it('recusa data de inicio invalida', () => {
    const result = validateDebtForm(
      values({
        knowsSchedule: true,
        totalInstallments: '24',
        paidInstallments: '9',
        startDate: '2026-02-30',
      }),
    );

    expect(result.ok).toBe(false);
  });
});

describe('parcela e vencimento', () => {
  it('usa o caminho canonico de dinheiro', () => {
    for (const [texto, esperado] of [
      ['440', 44000],
      ['440,5', 44050],
      ['1.234,56', 123456],
    ] as const) {
      const result = validateDebtForm(values({ installment: texto }));
      if (result.ok) expect(result.draft.installmentCents).toBe(esperado);
    }
  });

  it('recusa parcela vazia, zero ou negativa', () => {
    for (const texto of ['', '0', '0,00', '-10']) {
      expect(validateDebtForm(values({ installment: texto })).ok, texto).toBe(false);
    }
  });

  it('aceita dia 31 — o dominio ajusta em fevereiro', () => {
    const result = validateDebtForm(values({ dueDay: '31' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.dueDay).toBe(31);
  });

  it('recusa dia fora de 1-31', () => {
    for (const dia of ['0', '32', '', 'x', '99']) {
      expect(validateDebtForm(values({ dueDay: dia })).ok, dia).toBe(false);
    }
  });
});

describe('ida e volta', () => {
  it('editar e salvar sem mudar nada preserva o cronograma', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Carro',
      installmentCents: 44000,
      totalInstallments: 24,
      paidInstallments: 9,
      startDate: '2025-01-20',
    });

    const result = validateDebtForm(debtValuesFrom(debt));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft).toMatchObject({
        name: 'Carro',
        installmentCents: 44000,
        totalInstallments: 24,
        paidInstallments: 9,
        startDate: '2025-01-20',
      });
    }
  });

  it('editar uma divida sem prazo mantem o interruptor desligado', () => {
    const debt = makeDebt({ id: 'd1', name: 'Sem prazo' });
    expect(debtValuesFrom(debt).knowsSchedule).toBe(false);
  });

  it('desligar o interruptor numa divida que tinha prazo apaga o cronograma', () => {
    // E o caso em que o patch PRECISA limpar os campos: deixar o cronograma
    // antigo gravado mostraria um progresso que a pessoa acabou de negar.
    const debt = makeDebt({
      id: 'd1',
      name: 'Carro',
      totalInstallments: 24,
      paidInstallments: 9,
    });

    const result = validateDebtForm({ ...debtValuesFrom(debt), knowsSchedule: false });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('totalInstallments' in result.draft).toBe(false);
      expect('paidInstallments' in result.draft).toBe(false);
    }
  });
});

describe('advancePaidInstallments — a unica fonte de verdade do progresso', () => {
  it('avanca e retrocede dentro do intervalo', () => {
    const debt = makeDebt({ id: 'd1', name: 'X', totalInstallments: 24, paidInstallments: 9 });

    expect(advancePaidInstallments(debt, 1)).toBe(10);
    expect(advancePaidInstallments(debt, -1)).toBe(8);
  });

  it('nao passa do total nem fica negativo', () => {
    const quitada = makeDebt({ id: 'd1', name: 'X', totalInstallments: 24, paidInstallments: 24 });
    expect(advancePaidInstallments(quitada, 1)).toBeNull();

    const zerada = makeDebt({ id: 'd2', name: 'Y', totalInstallments: 24, paidInstallments: 0 });
    expect(advancePaidInstallments(zerada, -1)).toBeNull();
  });

  it('nao avanca o que nao se sabe', () => {
    // Sem prazo conhecido nao existe "proxima parcela" a marcar.
    const semPrazo = makeDebt({ id: 'd1', name: 'X' });
    expect(advancePaidInstallments(semPrazo, 1)).toBeNull();
    expect(advancePaidInstallments(semPrazo, -1)).toBeNull();
  });

  it('devolve apenas um numero — nunca uma transacao', () => {
    // Trava da decisao do lote: dar baixa altera so o contador. Se um dia
    // alguem fizer esta funcao criar lancamento, o tipo quebra aqui.
    const debt = makeDebt({ id: 'd1', name: 'X', totalInstallments: 24, paidInstallments: 9 });
    const result = advancePaidInstallments(debt, 1);

    expect(typeof result).toBe('number');
  });
});
