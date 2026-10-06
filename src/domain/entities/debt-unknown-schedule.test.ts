import { describe, expect, it } from 'vitest';

import { toMoney } from '../shared/money';
import * as debtRules from './debt';
import { debtSchema } from './debt';

const agora = '2026-10-10T12:00:00.000Z';

/**
 * Caso real do briefing: sabe-se que o emprestimo custa R$ 440 por mes e
 * vence no dia 20. Nada mais. O dominio precisa dizer "nao sei" em vez de
 * fabricar um prazo.
 */
const semPrazo = debtSchema.parse({
  id: 'debt-1',
  userId: 'user-1',
  name: 'Empréstimo',
  installmentCents: toMoney(44000),
  dueDay: 20,
  createdAt: agora,
  updatedAt: agora,
});

const comPrazo = debtSchema.parse({
  ...semPrazo,
  totalInstallments: 24,
  paidInstallments: 9,
  startDate: '2026-02-20',
});

describe('divida com prazo desconhecido', () => {
  it('e um registro valido', () => {
    expect(debtSchema.safeParse({ ...semPrazo }).success).toBe(true);
    expect(debtRules.hasSchedule(semPrazo)).toBe(false);
  });

  it('devolve null em tudo que dependeria de um prazo inventado', () => {
    expect(debtRules.remainingInstallments(semPrazo)).toBeNull();
    expect(debtRules.totalAmount(semPrazo)).toBeNull();
    expect(debtRules.paidAmount(semPrazo)).toBeNull();
    expect(debtRules.remainingAmount(semPrazo)).toBeNull();
    expect(debtRules.progressPercentage(semPrazo)).toBeNull();
    expect(debtRules.finalMonth(semPrazo)).toBeNull();
  });

  it('nunca e tratada como quitada', () => {
    // Na duvida, o compromisso continua valendo.
    expect(debtRules.isSettled(semPrazo)).toBe(false);
    expect(debtRules.nextDueDate(semPrazo, '2026-10-01' as never)).toBe('2026-10-20');
  });

  it('continua comprometendo o orcamento mensal', () => {
    // A unica informacao real — R$ 440/mes — segue utilizavel.
    expect(debtRules.monthlyCommitment([semPrazo])).toBe(44000);
  });

  it('aceita prazo parcialmente conhecido sem derivar o resto', () => {
    const soTotal = debtSchema.parse({ ...semPrazo, totalInstallments: 24 });

    expect(debtRules.totalAmount(soTotal)).toBe(1056000);
    expect(debtRules.paidAmount(soTotal)).toBeNull();
    expect(debtRules.progressPercentage(soTotal)).toBeNull();
    expect(debtRules.remainingInstallments(soTotal)).toBeNull();
    expect(debtRules.finalMonth(soTotal)).toBeNull(); // falta startDate
  });
});

describe('divida com prazo conhecido', () => {
  it('passa a derivar tudo normalmente', () => {
    expect(debtRules.hasSchedule(comPrazo)).toBe(true);
    expect(debtRules.remainingInstallments(comPrazo)).toBe(15);
    expect(debtRules.progressPercentage(comPrazo)).toBe(37.5);
    expect(debtRules.remainingAmount(comPrazo)).toBe(660000);
    expect(debtRules.finalMonth(comPrazo)).toBe('2028-01');
  });

  it('mantem a validacao de parcelas pagas acima do total', () => {
    expect(
      debtSchema.safeParse({ ...comPrazo, paidInstallments: 25, totalInstallments: 24 }).success,
    ).toBe(false);
  });

  it('completar o cadastro depois nao exige migracao', () => {
    // O registro sem prazo continua valido; adicionar os campos tambem.
    const completado = debtSchema.parse({
      ...semPrazo,
      totalInstallments: 36,
      paidInstallments: 0,
      startDate: '2026-10-20',
    });

    expect(debtRules.progressPercentage(completado)).toBe(0);
    expect(debtRules.finalMonth(completado)).toBe('2029-09');
  });
});
