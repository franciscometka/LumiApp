import { beforeEach, describe, expect, it } from 'vitest';

import { civilMonthResolver } from '@/domain/shared/period';
import { toMoney } from '@/domain/shared/money';
import { toMonthKey, toPlainDate } from '@/domain/shared/plain-date';

import type { DataSource } from '../../ports/data-source';
import { DataError } from '../../ports/errors';
import type { LocalStack } from './local-data-source';
import { createLocalStack } from './local-data-source';
import { createMemoryStorageDriver } from './storage-driver';

const NOW = '2026-10-15T12:00:00.000Z';

function makeStack(): LocalStack {
  let sequence = 0;
  return createLocalStack({
    driver: createMemoryStorageDriver(),
    key: 'finan:test',
    clock: () => NOW,
    createId: () => `id-${String((sequence += 1)).padStart(3, '0')}`,
  });
}

const transacaoBase = {
  userId: 'local-user',
  description: 'Internet',
  amountCents: toMoney(12000),
  type: 'expense' as const,
  flow: 'operational' as const,
  categoryId: 'cat-internet',
  date: toPlainDate('2026-10-10'),
  status: 'paid' as const,
  paymentMethod: 'boleto' as const,
};

describe('contrato assincrono', () => {
  it('toda leitura devolve Promise, mesmo com adapter sincrono', () => {
    const { dataSource } = makeStack();

    expect(dataSource.transactions.findAll()).toBeInstanceOf(Promise);
    expect(dataSource.categories.findAll()).toBeInstanceOf(Promise);
    expect(dataSource.settings.get()).toBeInstanceOf(Promise);
    expect(dataSource.maintenance.status()).toBeInstanceOf(Promise);
  });
});

describe('CRUD', () => {
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = makeStack().dataSource;
  });

  it('cria gerando id e timestamps', async () => {
    const criada = await dataSource.transactions.create(transacaoBase);

    expect(criada.id).toBe('id-001');
    expect(criada.createdAt).toBe(NOW);
    expect(criada.updatedAt).toBe(NOW);
    expect(criada.amountCents).toBe(12000);
    expect(await dataSource.transactions.count()).toBe(1);
  });

  it('le de volta pelo id', async () => {
    const criada = await dataSource.transactions.create(transacaoBase);
    expect(await dataSource.transactions.findById(criada.id)).toEqual(criada);
    expect(await dataSource.transactions.findById('inexistente')).toBeNull();
  });

  it('atualiza preservando id e createdAt', async () => {
    const criada = await dataSource.transactions.create(transacaoBase);
    const atualizada = await dataSource.transactions.update(criada.id, {
      amountCents: toMoney(15000),
      status: 'pending',
    });

    expect(atualizada.id).toBe(criada.id);
    expect(atualizada.createdAt).toBe(criada.createdAt);
    expect(atualizada.amountCents).toBe(15000);
    expect(atualizada.status).toBe('pending');
  });

  it('recusa alteracao que viole o schema, sem gravar', async () => {
    const criada = await dataSource.transactions.create(transacaoBase);

    await expect(
      dataSource.transactions.update(criada.id, { amountCents: -100 as never }),
    ).rejects.toThrow(DataError);

    expect((await dataSource.transactions.findById(criada.id))?.amountCents).toBe(12000);
  });

  it('recusa criar entidade invalida', async () => {
    await expect(
      dataSource.transactions.create({ ...transacaoBase, amountCents: 0 as never }),
    ).rejects.toThrow(DataError);

    expect(await dataSource.transactions.count()).toBe(0);
  });

  it('rejeita operacao sobre id inexistente', async () => {
    await expect(dataSource.transactions.update('nada', {})).rejects.toThrow(DataError);
    await expect(dataSource.transactions.remove('nada')).rejects.toThrow(DataError);
    await expect(dataSource.transactions.restore('nada')).rejects.toThrow(DataError);
  });
});

describe('exclusao logica', () => {
  it('marca deletedAt em vez de remover a linha', async () => {
    const { dataSource } = makeStack();
    const criada = await dataSource.transactions.create(transacaoBase);

    await dataSource.transactions.remove(criada.id);

    expect(await dataSource.transactions.count()).toBe(0);
    expect(await dataSource.transactions.findById(criada.id)).toBeNull();

    const comExcluidas = await dataSource.transactions.findAll({ includeDeleted: true });
    expect(comExcluidas).toHaveLength(1);
    expect(comExcluidas[0]?.deletedAt).toBe(NOW);
  });

  it('restaura o registro excluido', async () => {
    const { dataSource } = makeStack();
    const criada = await dataSource.transactions.create(transacaoBase);

    await dataSource.transactions.remove(criada.id);
    const restaurada = await dataSource.transactions.restore(criada.id);

    expect(restaurada.deletedAt).toBeUndefined();
    expect(await dataSource.transactions.count()).toBe(1);
  });

  it('excluir duas vezes nao altera a marcacao original', async () => {
    const { dataSource } = makeStack();
    const criada = await dataSource.transactions.create(transacaoBase);

    await dataSource.transactions.remove(criada.id);
    await dataSource.transactions.remove(criada.id);

    const todas = await dataSource.transactions.findAll({ includeDeleted: true });
    expect(todas).toHaveLength(1);
  });
});

describe('consultas de transacao', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = makeStack().dataSource;
    await dataSource.transactions.createMany([
      { ...transacaoBase, description: 'Carro', amountCents: toMoney(91100), categoryId: 'cat-carro', date: toPlainDate('2026-10-08') },
      { ...transacaoBase, description: 'Cartao Inter', amountCents: toMoney(37400), paymentMethod: 'credit', cardId: 'card-inter', date: toPlainDate('2026-10-15') },
      { ...transacaoBase, description: 'Emprestimo', amountCents: toMoney(44000), debtId: 'debt-1', date: toPlainDate('2026-10-20') },
      { ...transacaoBase, description: 'Mes anterior', amountCents: toMoney(10000), date: toPlainDate('2026-09-10') },
    ]);
  });

  it('createMany grava o lote inteiro', async () => {
    expect(await dataSource.transactions.count()).toBe(4);
  });

  it('createMany e tudo-ou-nada', async () => {
    const antes = await dataSource.transactions.count();

    await expect(
      dataSource.transactions.createMany([
        { ...transacaoBase, description: 'Valida' },
        { ...transacaoBase, description: 'Invalida', amountCents: -1 as never },
      ]),
    ).rejects.toThrow(DataError);

    expect(await dataSource.transactions.count()).toBe(antes);
  });

  it('createMany com lista vazia nao faz nada', async () => {
    expect(await dataSource.transactions.createMany([])).toEqual([]);
  });

  it('findByFilter usa o mesmo filtro do dominio', async () => {
    const outubro = civilMonthResolver.resolve(toMonthKey('2026-10'));

    expect(await dataSource.transactions.findByFilter({ period: outubro })).toHaveLength(3);
    expect(await dataSource.transactions.findByFilter({ paymentMethods: ['credit'] })).toHaveLength(1);
    expect(await dataSource.transactions.findByFilter({ search: 'cartao' })).toHaveLength(1);
  });

  it('findByCardId e findByDebtId', async () => {
    expect(await dataSource.transactions.findByCardId('card-inter')).toHaveLength(1);
    expect(await dataSource.transactions.findByDebtId('debt-1')).toHaveLength(1);
    expect(await dataSource.transactions.findByDebtId('inexistente')).toHaveLength(0);
  });
});

describe('consultas das demais entidades', () => {
  it('categoria por nome, sem distincao de caixa', async () => {
    const { dataSource } = makeStack();
    await dataSource.categories.create({
      userId: 'local-user',
      name: 'Alimentação',
      kind: 'expense',
      icon: 'utensils',
      colorToken: 'chart-4',
      isSystem: false,
      order: 0,
    });

    expect(await dataSource.categories.findByName('alimentação')).not.toBeNull();
    expect(await dataSource.categories.findByName('  ALIMENTAÇÃO  ')).not.toBeNull();
    expect(await dataSource.categories.findByName('Lazer')).toBeNull();
  });

  it('plano por mes', async () => {
    const { dataSource } = makeStack();
    await dataSource.monthlyPlans.create({
      userId: 'local-user',
      month: toMonthKey('2026-10'),
      expectedIncomeCents: toMoney(300000),
      spendingLimitCents: toMoney(250000),
      savingsGoalCents: toMoney(50000),
    });

    expect(await dataSource.monthlyPlans.findByMonth(toMonthKey('2026-10'))).not.toBeNull();
    expect(await dataSource.monthlyPlans.findByMonth(toMonthKey('2026-11'))).toBeNull();
  });

  it('contas recorrentes ativas', async () => {
    const { dataSource } = makeStack();
    const base = {
      userId: 'local-user',
      description: 'Internet',
      amountCents: toMoney(12000),
      type: 'expense' as const,
      categoryId: 'cat-internet',
      dueDay: 10,
      paymentMethod: 'boleto' as const,
      startMonth: toMonthKey('2026-01'),
    };

    await dataSource.recurringBills.create({ ...base, isActive: true });
    await dataSource.recurringBills.create({ ...base, description: 'Academia', isActive: false });

    expect(await dataSource.recurringBills.findActive()).toHaveLength(1);
    expect(await dataSource.recurringBills.findAll()).toHaveLength(2);
  });
});

describe('configuracoes', () => {
  it('devolve padroes sem gravar nada', async () => {
    const { dataSource } = makeStack();
    const settings = await dataSource.settings.get();

    expect(settings.currency).toBe('BRL');
    expect(settings.locale).toBe('pt-BR');
    expect(settings.periodResolverId).toBe('civil-month');
    expect(await dataSource.settings.exists()).toBe(false);
  });

  it('grava e passa a existir', async () => {
    const { dataSource } = makeStack();
    const padrao = await dataSource.settings.get();

    await dataSource.settings.save({ ...padrao, salaryDay: 10, theme: 'light' });

    expect(await dataSource.settings.exists()).toBe(true);
    expect((await dataSource.settings.get()).salaryDay).toBe(10);
  });
});

describe('persistencia entre instancias', () => {
  it('o que foi gravado sobrevive a uma nova abertura da mesma chave', async () => {
    const driver = createMemoryStorageDriver();
    const primeira = createLocalStack({ driver, key: 'finan:test', clock: () => NOW });

    await primeira.dataSource.transactions.create(transacaoBase);

    const segunda = createLocalStack({ driver, key: 'finan:test', clock: () => NOW });
    expect(await segunda.dataSource.transactions.count()).toBe(1);
  });
});

describe('API de manutencao', () => {
  it('status, exportacao e reset confirmado', async () => {
    const { dataSource } = makeStack();
    await dataSource.transactions.create(transacaoBase);

    expect((await dataSource.maintenance.status()).state).toBe('ready');
    expect(await dataSource.maintenance.exportRaw()).toContain('Internet');
    expect(JSON.parse(await dataSource.maintenance.exportJson())).toHaveProperty('schemaVersion');

    await dataSource.maintenance.reset('apagar-tudo');
    expect((await dataSource.maintenance.status()).state).toBe('empty');
  });

  it('reset exige a confirmacao exata', async () => {
    const { dataSource } = makeStack();
    await dataSource.transactions.create(transacaoBase);

    await expect(dataSource.maintenance.reset('sim' as never)).rejects.toThrow(DataError);
    expect(await dataSource.transactions.count()).toBe(1);
  });
});
