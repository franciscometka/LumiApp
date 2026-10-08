import { describe, expect, it } from 'vitest';

import { toPlainDate } from '@/domain/shared/plain-date';

import { backupFileName, describeImportPreview, parseSalaryDay } from './settings-form';

describe('parseSalaryDay', () => {
  it('aceita de 1 a 31', () => {
    expect(parseSalaryDay('1')).toBe(1);
    expect(parseSalaryDay(' 5 ')).toBe(5);
    expect(parseSalaryDay('31')).toBe(31);
  });

  it('recusa fora do intervalo e lixo', () => {
    for (const raw of ['0', '32', '', 'abc', '5.5', '-1', '005']) {
      expect(parseSalaryDay(raw), raw).toBeNull();
    }
  });
});

describe('backupFileName', () => {
  it('leva a data no nome', () => {
    expect(backupFileName(toPlainDate('2026-10-08'))).toBe('lumi-backup-2026-10-08.json');
  });
});

describe('describeImportPreview', () => {
  it('lista tudo que o backup traz, com plural certo', () => {
    expect(
      describeImportPreview({
        schemaVersion: 1,
        hasSettings: true,
        counts: {
          transactions: 12,
          monthlyPlans: 1,
          cards: 2,
          debts: 0,
          recurringBills: 3,
          categories: 15,
        },
      }),
    ).toBe('12 transações, 1 plano, 2 cartões, 0 dívidas, 3 contas recorrentes e 15 categorias');
  });
});
