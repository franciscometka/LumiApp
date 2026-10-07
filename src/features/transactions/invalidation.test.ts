import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { toMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import { queryKeys } from '../app/query-keys';

import { invalidateMonth, invalidateMonths } from './invalidation';

/**
 * A invalidacao e o ponto onde um CRUD correto ainda consegue mostrar numero
 * velho na tela. Estes testes fixam as tres regras que importam:
 *
 * - nunca global;
 * - sempre o mes seguinte tambem, por causa da comparacao do Dashboard;
 * - mudanca de mes invalida os dois.
 */

const m = (value: string) => toMonthKey(value) as MonthKey;

function spy() {
  const client = new QueryClient();
  const calls: unknown[][] = [];

  vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
    calls.push(filters?.queryKey as unknown[]);
  });

  return { client, calls };
}

describe('invalidateMonth', () => {
  it('invalida a lista e o snapshot do mes', async () => {
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-10'));

    expect(calls).toContainEqual(queryKeys.transactionsByMonth(m('2026-10')));
    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2026-10')));
  });

  it('invalida tambem o snapshot do mes SEGUINTE', async () => {
    /**
     * `loadMonthlySnapshot(novembro)` busca outubro para a comparacao. Sem
     * esta invalidacao, mexer em outubro deixaria o "x% a mais que no mês
     * passado" de novembro exibindo um numero obsoleto — sem erro na tela,
     * so um dado errado.
     */
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-10'));

    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2026-11')));
  });

  it('atravessa a virada de ano ao calcular o mes seguinte', async () => {
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-12'));

    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2027-01')));
  });

  it('nao invalida o mes anterior: ele nao depende deste', async () => {
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-10'));

    expect(calls).not.toContainEqual(queryKeys.monthlySnapshot(m('2026-09')));
    expect(calls).not.toContainEqual(queryKeys.transactionsByMonth(m('2026-09')));
  });

  it('nunca invalida tudo', async () => {
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-10'));

    // Uma chave `['finan']` derrubaria o diagnostico do storage, as categorias
    // e todos os meses visitados — recarregar o app para corrigir um
    // lancamento e a solucao preguicosa que o briefing proibiu.
    expect(calls).not.toContainEqual(queryKeys.all);
    expect(calls).not.toContainEqual(queryKeys.dashboard());
    expect(calls).not.toContainEqual(queryKeys.transactions());
    for (const key of calls) {
      expect(key, 'toda chave precisa ser especifica').toBeDefined();
      expect((key as unknown[]).length).toBeGreaterThan(2);
    }
  });

  it('nao toca em categorias nem no diagnostico do storage', async () => {
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-10'));

    expect(calls).not.toContainEqual(queryKeys.categories());
    expect(calls).not.toContainEqual(queryKeys.databaseStatus());
  });
});

describe('invalidateMonths', () => {
  it('edicao que muda de setembro para outubro invalida os dois meses', async () => {
    const { client, calls } = spy();
    await invalidateMonths(client, [m('2026-09'), m('2026-10')]);

    expect(calls).toContainEqual(queryKeys.transactionsByMonth(m('2026-09')));
    expect(calls).toContainEqual(queryKeys.transactionsByMonth(m('2026-10')));
    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2026-09')));
    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2026-10')));
    // E o seguinte de cada um, pela comparacao.
    expect(calls).toContainEqual(queryKeys.monthlySnapshot(m('2026-11')));
  });

  it('edicao dentro do mesmo mes invalida uma vez, nao duas', async () => {
    const { client, calls } = spy();
    await invalidateMonths(client, [m('2026-10'), m('2026-10')]);

    const lista = calls.filter(
      (key) => JSON.stringify(key) === JSON.stringify(queryKeys.transactionsByMonth(m('2026-10'))),
    );
    expect(lista).toHaveLength(1);
  });

  it('lista vazia nao invalida nada', async () => {
    const { client, calls } = spy();
    await invalidateMonths(client, []);
    expect(calls).toEqual([]);
  });
});
