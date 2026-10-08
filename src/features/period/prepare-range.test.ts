import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalStack } from '@/data/adapters/local/local-data-source';
import { createMemoryStorageDriver } from '@/data/adapters/local/storage-driver';
import type { StorageDriver } from '@/data/adapters/local/storage-driver';
import type { DataSource } from '@/data/ports/data-source';
import { resolveHistoryWindow } from '@/domain/calculations/history';
import { monthsToPrepare, occurrenceId } from '@/domain/calculations/materialization';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';
import { toMonthKey } from '@/domain/shared/plain-date';

import { queryKeys } from '../app/query-keys';

import { materializationQuery } from './use-month-ready';

/**
 * Preparacao de um intervalo de meses, pelo MESMO caminho que os hooks usam:
 * `materializationQuery(mes)` executada pelo QueryClient, um mes por query.
 * `usePeriodsReady(janela)` e exatamente isso dentro de `useQueries`.
 *
 * O que estes testes NAO afirmam: atomicidade entre abas. O `localStorage`
 * nao tem lock nem transacao entre abas, e o que existe ali e a protecao do
 * id determinstico (ver `features/recurring/materialize.ts`). A garantia forte
 * entre clientes vira com o Supabase: PRIMARY KEY + ON CONFLICT DO NOTHING.
 */

const m = (value: string) => toMonthKey(value) as MonthKey;
const OUTUBRO = m('2026-10');
const JANELA_6 = resolveHistoryWindow(civilMonthResolver, OUTUBRO, 6).months;
const JANELA_12 = resolveHistoryWindow(civilMonthResolver, OUTUBRO, 12).months;

let driver: StorageDriver;
let dataSource: DataSource;
let userId: string;

function abrirSessao() {
  // Mesmo storage, nova pilha: equivale a recarregar a pagina.
  const stack = createLocalStack({ driver });
  dataSource = stack.dataSource;
  userId = stack.userId;
  return stack.dataSource;
}

beforeEach(() => {
  driver = createMemoryStorageDriver();
  abrirSessao();
});

async function criarRecorrencia(overrides: Record<string, unknown> = {}) {
  return dataSource.recurringBills.create({
    userId,
    description: 'Internet',
    amountCents: 12000,
    type: 'expense',
    categoryId: 'cat-internet',
    dueDay: 31,
    paymentMethod: 'boleto',
    isActive: true,
    startMonth: m('2025-01'),
    ...overrides,
  } as Parameters<typeof dataSource.recurringBills.create>[0]);
}

/** O que `usePeriodsReady(meses)` dispara: uma query por mes, em paralelo. */
function preparar(client: QueryClient, months: readonly MonthKey[], source = dataSource) {
  return Promise.all(
    months.map((month) => client.fetchQuery(materializationQuery(source, client, month))),
  );
}

async function ocorrenciasPorMes(includeDeleted = false) {
  const todas = await dataSource.transactions.findAll({ includeDeleted });
  const porMes = new Map<string, number>();
  for (const t of todas) {
    const key = t.date.slice(0, 7);
    porMes.set(key, (porMes.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...porMes.entries()].sort());
}

describe('preparar a janela', () => {
  it('6 meses: uma ocorrencia em cada mes de maio a outubro', async () => {
    await criarRecorrencia();
    const resultados = await preparar(new QueryClient(), JANELA_6);

    expect(resultados.reduce((total, r) => total + r.created, 0)).toBe(6);
    expect(await ocorrenciasPorMes()).toEqual({
      '2026-05': 1,
      '2026-06': 1,
      '2026-07': 1,
      '2026-08': 1,
      '2026-09': 1,
      '2026-10': 1,
    });
  });

  it('12 meses atravessam a virada de ano', async () => {
    await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_12);

    const porMes = await ocorrenciasPorMes();
    expect(Object.keys(porMes)).toEqual(JANELA_12);
    expect(porMes['2025-12']).toBe(1);
    expect(porMes['2026-01']).toBe(1);
  });

  it('dia 31 respeita o fim de cada mes', async () => {
    await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);

    const datas = (await dataSource.transactions.findAll()).map((t) => t.date).sort();
    expect(datas).toContain('2026-06-30');
    expect(datas).toContain('2026-09-30');
    expect(datas).toContain('2026-10-31');
  });

  it('ocorrencias passadas nascem pendentes: nada de pagamento retroativo', async () => {
    await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);

    const todas = await dataSource.transactions.findAll();
    expect(todas.every((t) => t.status === 'pending')).toBe(true);
  });

  it('usa o id determinstico de cada mes', async () => {
    const bill = await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);

    const ids = new Set((await dataSource.transactions.findAll()).map((t) => t.id));
    for (const month of JANELA_6) {
      expect(ids.has(occurrenceId(bill.id, month))).toBe(true);
    }
  });

  it('nunca prepara meses depois do mes de referencia', async () => {
    await criarRecorrencia();
    const alemDeOutubro = resolveHistoryWindow(civilMonthResolver, m('2027-01'), 6).months;

    await preparar(new QueryClient(), monthsToPrepare(alemDeOutubro, OUTUBRO));

    const porMes = await ocorrenciasPorMes();
    expect(Object.keys(porMes)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});

describe('vigencia dentro da janela', () => {
  it('startMonth no meio da janela: nada antes do inicio', async () => {
    await criarRecorrencia({ startMonth: m('2026-08') });
    await preparar(new QueryClient(), JANELA_6);

    expect(Object.keys(await ocorrenciasPorMes())).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('endMonth no meio da janela: nada depois do fim', async () => {
    await criarRecorrencia({ endMonth: m('2026-07') });
    await preparar(new QueryClient(), JANELA_6);

    expect(Object.keys(await ocorrenciasPorMes())).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  it('recorrencia inativa ou excluida nao gera nada', async () => {
    await criarRecorrencia({ isActive: false });
    const excluida = await criarRecorrencia({ description: 'Academia' });
    await dataSource.recurringBills.remove(excluida.id);

    await preparar(new QueryClient(), JANELA_6);
    expect(await ocorrenciasPorMes()).toEqual({});
  });
});

describe('idempotencia', () => {
  it('chamadas sequenciais: a segunda nao cria nada', async () => {
    await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);
    const segunda = await preparar(new QueryClient(), JANELA_6);

    expect(segunda.every((r) => r.created === 0)).toBe(true);
    expect(Object.values(await ocorrenciasPorMes())).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('concorrentes na mesma execucao (Promise.all): sem duplicata', async () => {
    await criarRecorrencia();
    // Duas telas pedindo a mesma janela em clientes distintos, ao mesmo tempo.
    await Promise.all([
      preparar(new QueryClient(), JANELA_6),
      preparar(new QueryClient(), JANELA_6),
      preparar(new QueryClient(), JANELA_6),
    ]);

    expect(Object.values(await ocorrenciasPorMes())).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('StrictMode: montar duas vezes no mesmo cliente executa UMA vez por mes', async () => {
    await criarRecorrencia();
    const client = new QueryClient();
    const escrita = vi.spyOn(dataSource.transactions, 'insertManyIgnoringExisting');

    await Promise.all([preparar(client, JANELA_6), preparar(client, JANELA_6)]);

    // Um insert por mes, nao dois: o cache deduplica as queries em voo.
    expect(escrita).toHaveBeenCalledTimes(6);
    expect(Object.values(await ocorrenciasPorMes())).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('reabrir o app (nova sessao, mesmo storage) nao recria nada', async () => {
    await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);

    const novaSessao = abrirSessao();
    const resultados = await preparar(new QueryClient(), JANELA_12, novaSessao);

    // Os 6 meses novos da janela de 12 sao criados; os 6 antigos, nao.
    expect(resultados.reduce((total, r) => total + r.created, 0)).toBe(6);
    expect(Object.values(await ocorrenciasPorMes())).toEqual(Array(12).fill(1));
  });

  it('Historico e Dashboard compartilham o cache do mes', async () => {
    await criarRecorrencia();
    const client = new QueryClient();
    await preparar(client, JANELA_6);

    // O Dashboard de setembro pede M-1 e M: ja estao prontos, nada executa.
    const escrita = vi.spyOn(dataSource.transactions, 'insertManyIgnoringExisting');
    await preparar(client, [m('2026-08'), m('2026-09')]);
    expect(escrita).not.toHaveBeenCalled();
  });
});

describe('ocorrencia excluida', () => {
  it('nao volta ao preparar a janela de novo', async () => {
    const bill = await criarRecorrencia();
    await preparar(new QueryClient(), JANELA_6);

    await dataSource.transactions.remove(occurrenceId(bill.id, m('2026-07')));

    const resultados = await preparar(new QueryClient(), JANELA_12);
    // Junho a outubro ja existiam e julho esta excluido: so os 6 novos.
    expect(resultados.reduce((total, r) => total + r.created, 0)).toBe(6);

    expect((await ocorrenciasPorMes())['2026-07']).toBeUndefined();
    expect((await ocorrenciasPorMes(true))['2026-07']).toBe(1);
  });
});

describe('invalidacao apos materializar', () => {
  it('criar ocorrencias derruba as leituras daquele mes e o Historico', async () => {
    await criarRecorrencia({ startMonth: m('2026-09') });
    const client = new QueryClient();
    const invalidadas: unknown[] = [];
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      invalidadas.push(filters?.queryKey);
    });

    await preparar(client, [m('2026-09')]);

    expect(invalidadas).toContainEqual(queryKeys.transactionsByMonth(m('2026-09')));
    expect(invalidadas).toContainEqual(queryKeys.monthlySnapshot(m('2026-09')));
    expect(invalidadas).toContainEqual(queryKeys.history());
  });

  it('nada criado, nada invalidado', async () => {
    const client = new QueryClient();
    const invalidar = vi.spyOn(client, 'invalidateQueries');

    await preparar(client, JANELA_6);
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('recorrencia criada depois: a janela invalidada prepara de novo e lanca so o que falta', async () => {
    const client = new QueryClient();
    await preparar(client, JANELA_6);
    expect(await ocorrenciasPorMes()).toEqual({});

    await criarRecorrencia({ startMonth: m('2026-09') });
    // O que `invalidateRecurring` faz com a familia da materializacao.
    await client.invalidateQueries({ queryKey: queryKeys.materialization() });
    await preparar(client, JANELA_6);

    expect(await ocorrenciasPorMes()).toEqual({ '2026-09': 1, '2026-10': 1 });
  });
});
