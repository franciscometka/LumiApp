import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalStack } from '@/data/adapters/local/local-data-source';
import { createMemoryStorageDriver } from '@/data/adapters/local/storage-driver';
import type { DataSource } from '@/data/ports/data-source';
import { occurrenceId } from '@/domain/calculations/materialization';
import { calculateTotals } from '@/domain/calculations/totals';
import { toMonthKey, toPlainDate } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import { materializeMonth } from './materialize';

/**
 * Integracao contra o storage real (em memoria, mesmo adapter).
 *
 * Os testes do dominio provam que o PLANO esta certo; estes provam que a
 * gravacao tambem esta — que `insertManyIgnoringExisting` de fato ignora, que
 * os excluidos continuam bloqueando, e que repetir a operacao nao acumula
 * linha nenhuma.
 */

const OUTUBRO = toMonthKey('2026-10') as MonthKey;
const NOVEMBRO = toMonthKey('2026-11') as MonthKey;
const SETEMBRO = toMonthKey('2026-09') as MonthKey;

let dataSource: DataSource;
let userId: string;

async function criarRecorrencia(overrides: Record<string, unknown> = {}) {
  return dataSource.recurringBills.create({
    userId,
    description: 'Internet',
    amountCents: 12000,
    type: 'expense',
    categoryId: 'cat-internet',
    dueDay: 10,
    paymentMethod: 'boleto',
    isActive: true,
    startMonth: toMonthKey('2026-01'),
    ...overrides,
  } as Parameters<typeof dataSource.recurringBills.create>[0]);
}

async function transacoesDe(month: MonthKey, includeDeleted = false) {
  const todas = await dataSource.transactions.findAll({ includeDeleted });
  return todas.filter((t) => t.date.startsWith(month));
}

beforeEach(() => {
  const stack = createLocalStack({ driver: createMemoryStorageDriver() });
  dataSource = stack.dataSource;
  userId = stack.userId;
});

describe('idempotencia contra o storage', () => {
  it('materializar outubro cinco vezes cria UMA ocorrencia', async () => {
    await criarRecorrencia();

    for (let i = 0; i < 5; i += 1) {
      await materializeMonth(dataSource, OUTUBRO);
    }

    const outubro = await transacoesDe(OUTUBRO);
    expect(outubro).toHaveLength(1);
    expect(outubro[0]?.description).toBe('Internet');
    expect(outubro[0]?.amountCents).toBe(12000);
  });

  it('so a primeira chamada reporta criacao', async () => {
    await criarRecorrencia();

    expect((await materializeMonth(dataSource, OUTUBRO)).created).toBe(1);
    expect((await materializeMonth(dataSource, OUTUBRO)).created).toBe(0);
    expect((await materializeMonth(dataSource, OUTUBRO)).created).toBe(0);
  });

  it('chamadas concorrentes com Promise.all nao duplicam', async () => {
    await criarRecorrencia();

    const resultados = await Promise.all([
      materializeMonth(dataSource, OUTUBRO),
      materializeMonth(dataSource, OUTUBRO),
      materializeMonth(dataSource, OUTUBRO),
      materializeMonth(dataSource, OUTUBRO),
      materializeMonth(dataSource, OUTUBRO),
    ]);

    expect(await transacoesDe(OUTUBRO)).toHaveLength(1);

    // Exatamente uma chamada reporta ter criado; as demais, zero.
    const criadas = resultados.reduce((total, r) => total + r.created, 0);
    expect(criadas).toBe(1);
  });

  it('a ocorrencia recebe o id determinstico', async () => {
    const bill = await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    const [ocorrencia] = await transacoesDe(OUTUBRO);
    expect(ocorrencia?.id).toBe(occurrenceId(bill.id, OUTUBRO));
    expect(ocorrencia?.recurringBillId).toBe(bill.id);
  });

  it('nasce pendente', async () => {
    await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    const [ocorrencia] = await transacoesDe(OUTUBRO);
    expect(ocorrencia?.status).toBe('pending');
  });
});

describe('ocorrencia excluida', () => {
  it('nao e recriada, por mais que se materialize', async () => {
    await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    const [ocorrencia] = await transacoesDe(OUTUBRO);
    await dataSource.transactions.remove(ocorrencia?.id ?? '');

    for (let i = 0; i < 3; i += 1) {
      const resultado = await materializeMonth(dataSource, OUTUBRO);
      expect(resultado.created).toBe(0);
    }

    expect(await transacoesDe(OUTUBRO)).toHaveLength(0);
    // Continua la, apenas excluida — e e isso que bloqueia a regeneracao.
    expect(await transacoesDe(OUTUBRO, true)).toHaveLength(1);
  });

  it('restaurar devolve a MESMA ocorrencia', async () => {
    const bill = await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    const id = occurrenceId(bill.id, OUTUBRO);
    await dataSource.transactions.remove(id);
    await dataSource.transactions.restore(id);

    const outubro = await transacoesDe(OUTUBRO);
    expect(outubro).toHaveLength(1);
    expect(outubro[0]?.id).toBe(id);
  });
});

describe('vigencia', () => {
  it('encerrada: gera no endMonth e nao no mes seguinte', async () => {
    await criarRecorrencia({ endMonth: toMonthKey('2026-10') });

    await materializeMonth(dataSource, OUTUBRO);
    await materializeMonth(dataSource, NOVEMBRO);

    expect(await transacoesDe(OUTUBRO)).toHaveLength(1);
    expect(await transacoesDe(NOVEMBRO)).toHaveLength(0);
  });

  it('recorrencia excluida para de gerar, sem apagar o que gerou', async () => {
    const bill = await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    await dataSource.recurringBills.remove(bill.id);
    await materializeMonth(dataSource, NOVEMBRO);

    // Historico preservado; nada novo.
    expect(await transacoesDe(OUTUBRO)).toHaveLength(1);
    expect(await transacoesDe(NOVEMBRO)).toHaveLength(0);
  });
});

describe('navegacao fora de ordem', () => {
  it('visitar novembro e depois setembro materializa os dois', async () => {
    /**
     * O cenario que a regra antiga (`month > lastGeneratedMonth`) quebrava:
     * setembro ficaria sem suas contas para sempre.
     */
    await criarRecorrencia();

    await materializeMonth(dataSource, NOVEMBRO);
    await materializeMonth(dataSource, SETEMBRO);
    await materializeMonth(dataSource, OUTUBRO);

    expect(await transacoesDe(NOVEMBRO)).toHaveLength(1);
    expect(await transacoesDe(SETEMBRO)).toHaveLength(1);
    expect(await transacoesDe(OUTUBRO)).toHaveLength(1);
  });

  it('meses perdidos NAO sao preenchidos em lote', async () => {
    // Politica: visitar novembro materializa novembro e so.
    await criarRecorrencia();
    await materializeMonth(dataSource, NOVEMBRO);

    expect(await transacoesDe(SETEMBRO)).toHaveLength(0);
    expect(await transacoesDe(OUTUBRO)).toHaveLength(0);
  });
});

describe('historico nao muda', () => {
  it('alterar o valor da recorrencia nao altera o mes ja materializado', async () => {
    const bill = await criarRecorrencia();
    await materializeMonth(dataSource, OUTUBRO);

    await dataSource.recurringBills.update(bill.id, { amountCents: 15000 as never });

    // Re-materializar outubro nao toca na ocorrencia existente...
    await materializeMonth(dataSource, OUTUBRO);
    const [outubro] = await transacoesDe(OUTUBRO);
    expect(outubro?.amountCents).toBe(12000);

    // ...e novembro, ainda nao gerado, nasce com o valor novo.
    await materializeMonth(dataSource, NOVEMBRO);
    const [novembro] = await transacoesDe(NOVEMBRO);
    expect(novembro?.amountCents).toBe(15000);
  });

  it('mudar o dia de vencimento nao move a ocorrencia existente', async () => {
    const bill = await criarRecorrencia({ dueDay: 10 });
    await materializeMonth(dataSource, OUTUBRO);

    await dataSource.recurringBills.update(bill.id, { dueDay: 15 });
    await materializeMonth(dataSource, OUTUBRO);

    const [outubro] = await transacoesDe(OUTUBRO);
    expect(outubro?.date).toBe(toPlainDate('2026-10-10'));

    await materializeMonth(dataSource, NOVEMBRO);
    const [novembro] = await transacoesDe(NOVEMBRO);
    expect(novembro?.date).toBe(toPlainDate('2026-11-15'));
  });
});

describe('varias recorrencias', () => {
  it('gera as duas e nao reporta falso positivo na segunda rodada', async () => {
    await criarRecorrencia({ description: 'Internet', dueDay: 10 });
    await criarRecorrencia({ description: 'Aluguel', amountCents: 150000, dueDay: 5 });

    const primeira = await materializeMonth(dataSource, OUTUBRO);
    expect(primeira.created).toBe(2);
    expect([...primeira.createdDescriptions].sort()).toEqual(['Aluguel', 'Internet']);

    const segunda = await materializeMonth(dataSource, OUTUBRO);
    expect(segunda.created).toBe(0);
    expect(await transacoesDe(OUTUBRO)).toHaveLength(2);
  });

  it('adicionar uma recorrencia depois completa so o que falta', async () => {
    await criarRecorrencia({ description: 'Internet' });
    await materializeMonth(dataSource, OUTUBRO);

    await criarRecorrencia({ description: 'Aluguel', amountCents: 150000, dueDay: 5 });
    const resultado = await materializeMonth(dataSource, OUTUBRO);

    expect(resultado.created).toBe(1);
    expect(resultado.createdDescriptions).toEqual(['Aluguel']);
    expect(await transacoesDe(OUTUBRO)).toHaveLength(2);
  });
});

describe('sem recorrencias', () => {
  it('nao cria nada e nao falha', async () => {
    const resultado = await materializeMonth(dataSource, OUTUBRO);

    expect(resultado.created).toBe(0);
    expect(resultado.createdDescriptions).toEqual([]);
    expect(await transacoesDe(OUTUBRO)).toHaveLength(0);
  });
});

describe('Dashboard: recorrencia NAO e gasto', () => {
  it('o total do mes conta a ocorrencia uma vez, e ignora a recorrencia', async () => {
    /**
     * A recorrencia e um MOLDE que cria uma Transaction; so a Transaction
     * entra nos totais. Somar as duas contaria o mesmo dinheiro duas vezes —
     * R$ 240 onde ha R$ 120.
     *
     * Este teste quebra se alguem fizer qualquer total ler `recurringBills`.
     */
    await criarRecorrencia({ description: 'Internet', amountCents: 12000 });
    await criarRecorrencia({ description: 'Aluguel', amountCents: 150000, dueDay: 5 });

    await materializeMonth(dataSource, OUTUBRO);

    const ocorrencias = await transacoesDe(OUTUBRO);
    const totais = calculateTotals(ocorrencias);

    expect(totais.expense).toBe(162000);

    // O valor somado das recorrencias e o mesmo — e e exatamente por isso que
    // somar os dois conjuntos daria o dobro.
    const bills = await dataSource.recurringBills.findAll();
    const somaDosMoldes = bills.reduce((total, bill) => total + bill.amountCents, 0);

    expect(somaDosMoldes).toBe(162000);
    expect(totais.expense).not.toBe(somaDosMoldes + totais.expense);
    expect(totais.expense).toBe(somaDosMoldes);
  });

  it('materializar de novo nao muda nenhum total', async () => {
    await criarRecorrencia({ amountCents: 12000 });
    await materializeMonth(dataSource, OUTUBRO);

    const antes = calculateTotals(await transacoesDe(OUTUBRO));

    for (let i = 0; i < 4; i += 1) {
      await materializeMonth(dataSource, OUTUBRO);
    }

    const depois = calculateTotals(await transacoesDe(OUTUBRO));

    expect(depois.expense).toBe(antes.expense);
    expect(depois.balance).toBe(antes.balance);
    expect(depois.transactionCount).toBe(antes.transactionCount);
  });

  it('entrada recorrente nao conta como recebida ate dar baixa', async () => {
    await criarRecorrencia({
      description: 'Salário',
      type: 'income',
      amountCents: 230000,
      categoryId: 'cat-salario',
      dueDay: 5,
    });

    await materializeMonth(dataSource, OUTUBRO);
    const totais = calculateTotals(await transacoesDe(OUTUBRO));

    // Entrou no caixa previsto do mes...
    expect(totais.income).toBe(230000);
    // ...mas nao no realizado: ninguem confirmou o recebimento.
    expect(totais.paidIncome).toBe(0);
    expect(totais.pendingIncome).toBe(230000);
    expect(totais.realizedBalance).toBe(0);
  });
});
