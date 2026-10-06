import { describe, expect, it } from 'vitest';

import { calculateCommitments } from '@/domain/calculations/commitments';
import { calculateTotals } from '@/domain/calculations/totals';
import * as debtRules from '@/domain/entities/debt';
import { formatMoney } from '@/domain/shared/money';
import { toMonthKey, toPlainDate } from '@/domain/shared/plain-date';

import { LocalDatabase } from '../adapters/local/local-database';
import { createMemoryStorageDriver } from '../adapters/local/storage-driver';
import type { StorageDriver } from '../adapters/local/storage-driver';
import { LOCAL_USER_ID, createLocalStack } from '../adapters/local/local-data-source';
import { SEED_IDS, buildSeedData } from './demo-data';
import { seedIfEmpty } from './seed';

const KEY = 'finan:test';
const NOW = '2026-10-01T09:00:00.000Z';
const MES = toMonthKey('2026-10');

function makeDatabase(driver: StorageDriver = createMemoryStorageDriver()) {
  return { driver, database: new LocalDatabase({ key: KEY, driver, clock: () => NOW }) };
}

describe('buildSeedData', () => {
  const dados = buildSeedData({ userId: LOCAL_USER_ID, month: MES, now: NOW });

  it('reproduz exatamente os numeros do briefing', () => {
    const totais = calculateTotals([...dados.transactions]);

    expect(formatMoney(totais.income)).toBe('R$ 3.100,00');
    expect(formatMoney(totais.expense)).toBe('R$ 2.610,00');
    expect(formatMoney(totais.balance)).toBe('R$ 490,00');
  });

  it('traz as faturas e a divida do briefing', () => {
    expect(dados.cards.map((card) => card.currentInvoiceCents)).toEqual([37400, 76500]);
    expect(dados.debts[0]?.installmentCents).toBe(44000);
    expect(dados.monthlyPlans[0]?.spendingLimitCents).toBe(250000);
  });

  it('nao inventa o prazo do emprestimo', () => {
    // O briefing informa apenas "Emprestimo: R$ 440". Nada alem disso pode
    // aparecer como se fosse dado do usuario.
    const emprestimo = dados.debts[0];

    expect(emprestimo?.installmentCents).toBe(44000);
    expect(emprestimo?.totalInstallments).toBeUndefined();
    expect(emprestimo?.paidInstallments).toBeUndefined();
    expect(emprestimo?.startDate).toBeUndefined();

    expect(debtRules.progressPercentage(emprestimo as never)).toBeNull();
    expect(debtRules.remainingAmount(emprestimo as never)).toBeNull();
    expect(debtRules.finalMonth(emprestimo as never)).toBeNull();
    expect(debtRules.isSettled(emprestimo as never)).toBe(false);
  });

  it('separa renda gerada de dinheiro vindo da reserva', () => {
    const totais = calculateTotals([...dados.transactions]);

    expect(formatMoney(totais.income)).toBe('R$ 3.100,00');
    expect(formatMoney(totais.earnedIncome)).toBe('R$ 3.000,00');
    expect(formatMoney(totais.transferIn)).toBe('R$ 100,00');
    expect(totais.transferCount).toBe(1);
  });

  it('vincula transacoes a cartoes e divida', () => {
    const comprometimento = calculateCommitments([...dados.transactions]);
    expect(comprometimento.cardCents).toBe(113900);
    expect(comprometimento.debtCents).toBe(44000);
  });

  it('e deterministica: duas construcoes produzem os mesmos ids', () => {
    const outra = buildSeedData({ userId: LOCAL_USER_ID, month: MES, now: NOW });
    expect(outra.transactions.map((item) => item.id)).toEqual(
      dados.transactions.map((item) => item.id),
    );
  });

  it('usa ids fixos, nunca indice de array', () => {
    const ids = dados.transactions.map((item) => item.id);
    expect(ids).toContain(SEED_IDS.transactions.salario);
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marca as recorrentes como ja geradas no mes do seed', () => {
    // Sem isso, a primeira materializacao criaria uma segunda conta de
    // internet por cima da que o seed acabou de inserir.
    expect(dados.recurringBills.every((bill) => bill.lastGeneratedMonth === MES)).toBe(true);
  });

  it('limita os dias ao ultimo dia do mes', () => {
    const fevereiro = buildSeedData({
      userId: LOCAL_USER_ID,
      month: toMonthKey('2026-02'),
      now: NOW,
    });

    expect(fevereiro.transactions.every((item) => item.date <= '2026-02-28')).toBe(true);
    expect(fevereiro.transactions.some((item) => item.date === '2026-02-28')).toBe(true);
  });
});

describe('seedIfEmpty', () => {
  it('insere em base vazia', () => {
    const { database } = makeDatabase();
    const resultado = seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    expect(resultado.outcome).toBe('seeded');
    expect(resultado.recordsInserted).toBe(15 + 2 + 1 + 2 + 9 + 1);
    expect(database.load().meta.seededAt).toBe(NOW);
  });

  it('nao duplica nada ao rodar de novo', () => {
    const { database } = makeDatabase();

    seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });
    const primeira = database.load();

    const segunda = seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });
    const depois = database.load();

    expect(segunda.outcome).toBe('already_seeded');
    expect(segunda.recordsInserted).toBe(0);
    expect(depois.collections.transactions).toHaveLength(primeira.collections.transactions.length);
    expect(depois.collections.categories).toHaveLength(primeira.collections.categories.length);
    expect(depois.collections.cards).toHaveLength(2);
    expect(depois.collections.debts).toHaveLength(1);
    expect(depois.collections.recurringBills).toHaveLength(2);
  });

  it('nao duplica mesmo recarregando o app varias vezes', () => {
    // Cada iteracao simula uma nova sessao sobre o MESMO storage.
    const driver = createMemoryStorageDriver();

    for (let abertura = 0; abertura < 5; abertura += 1) {
      const database = new LocalDatabase({ key: KEY, driver, clock: () => NOW });
      seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });
    }

    const final = new LocalDatabase({ key: KEY, driver, clock: () => NOW }).load();

    expect(final.collections.transactions).toHaveLength(9);
    expect(final.collections.categories).toHaveLength(15);
    expect(final.collections.cards).toHaveLength(2);
    expect(final.collections.debts).toHaveLength(1);
    expect(final.collections.recurringBills).toHaveLength(2);
    expect(final.collections.monthlyPlans).toHaveLength(1);

    const totais = calculateTotals(final.collections.transactions);
    expect(formatMoney(totais.income)).toBe('R$ 3.100,00');
    expect(formatMoney(totais.expense)).toBe('R$ 2.610,00');
  });

  it('nao reinsere apos o usuario apagar tudo', () => {
    // O marcador `seededAt` sobrevive: o app nao desfaz o que o usuario fez.
    const { database } = makeDatabase();
    seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    database.mutate((draft) => {
      draft.collections.transactions = [];
      draft.collections.categories = [];
      draft.collections.cards = [];
      draft.collections.debts = [];
      draft.collections.recurringBills = [];
      draft.collections.monthlyPlans = [];
    });

    const resultado = seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    expect(resultado.outcome).toBe('already_seeded');
    expect(database.load().collections.transactions).toHaveLength(0);
  });

  it('nao sobrescreve dados reais quando o marcador nao existe', () => {
    const { database } = makeDatabase();
    const dados = buildSeedData({ userId: LOCAL_USER_ID, month: MES, now: NOW });

    database.mutate((draft) => {
      draft.collections.transactions = [dados.transactions[0] as never];
    });

    const resultado = seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    expect(resultado.outcome).toBe('not_empty');
    expect(database.load().collections.transactions).toHaveLength(1);
  });

  it('considera configuracoes gravadas como base nao vazia', () => {
    const { database } = makeDatabase();
    const dados = buildSeedData({ userId: LOCAL_USER_ID, month: MES, now: NOW });

    database.mutate((draft) => {
      draft.settings = dados.settings;
    });

    expect(seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES }).outcome).toBe('not_empty');
  });

  it('volta a semear depois de um reset explicito', () => {
    const { database } = makeDatabase();
    seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    database.reset();

    expect(seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES }).outcome).toBe('seeded');
  });

  it('usa o mes da data de referencia quando nenhum mes e informado', () => {
    const { database } = makeDatabase();
    seedIfEmpty({ database, userId: LOCAL_USER_ID, today: toPlainDate('2027-03-14') });

    expect(database.load().collections.monthlyPlans[0]?.month).toBe('2027-03');
  });

  it('grava tudo em uma unica escrita', () => {
    let escritas = 0;
    const memoria = createMemoryStorageDriver();
    const driver: StorageDriver = {
      ...memoria,
      write: (key, value) => {
        escritas += 1;
        memoria.write(key, value);
      },
    };

    const { database } = makeDatabase(driver);
    seedIfEmpty({ database, userId: LOCAL_USER_ID, month: MES });

    // Nao existe estado intermediario com metade do seed no storage.
    expect(escritas).toBe(1);
  });
});

describe('seed atraves do DataSource', () => {
  it('os dados ficam acessiveis pelos repositorios', async () => {
    const driver = createMemoryStorageDriver();
    const stack = createLocalStack({ driver, key: KEY, clock: () => NOW });

    seedIfEmpty({ database: stack.database, userId: stack.userId, month: MES });

    expect(await stack.dataSource.transactions.count()).toBe(9);
    expect(await stack.dataSource.categories.count()).toBe(15);
    expect(await stack.dataSource.cards.count()).toBe(2);
    expect(await stack.dataSource.settings.exists()).toBe(true);
    expect(await stack.dataSource.monthlyPlans.findByMonth(MES)).not.toBeNull();
    expect(await stack.dataSource.categories.findByName('Alimentação')).not.toBeNull();
  });
});
