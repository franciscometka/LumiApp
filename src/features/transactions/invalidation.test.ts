import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { toMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import { queryKeys } from '../app/query-keys';

import {
  invalidateCards,
  invalidateDebts,
  invalidateMonth,
  invalidateMonths,
  invalidatePlan,
  invalidateRecurring,
} from './invalidation';

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
      // A familia do Historico e a unica excecao, e e deliberada: nao ha como
      // saber daqui quais janelas em cache contem o mes alterado.
      if (JSON.stringify(key) === JSON.stringify(queryKeys.history())) continue;
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

describe('cartoes e dividas sao globais, nao mensais', () => {
  it('alterar um cartao invalida apenas a lista de cartoes', async () => {
    /**
     * Nenhuma metrica do Dashboard le `card.currentInvoiceCents`, e a
     * classificacao de um gasto depende do `cardId` gravado NA TRANSACAO, nao
     * da existencia do cartao. Logo, mexer num cartao nao muda um centavo de
     * nenhum total — invalidar meses aqui seria recarregar a aplicacao
     * inteira para corrigir a cor de uma etiqueta.
     */
    const { client, calls } = spy();
    await invalidateCards(client);

    expect(calls).toEqual([queryKeys.cards()]);
    expect(calls).not.toContainEqual(queryKeys.monthlySnapshot(m('2026-10')));
    expect(calls).not.toContainEqual(queryKeys.transactionsByMonth(m('2026-10')));
  });

  it('alterar uma divida invalida apenas a lista de dividas', async () => {
    const { client, calls } = spy();
    await invalidateDebts(client);

    expect(calls).toEqual([queryKeys.debts()]);
  });

  it('nenhuma das duas toca no diagnostico do storage nem em categorias', async () => {
    const { client, calls } = spy();
    await invalidateCards(client);
    await invalidateDebts(client);

    expect(calls).not.toContainEqual(queryKeys.databaseStatus());
    expect(calls).not.toContainEqual(queryKeys.categories());
    expect(calls).not.toContainEqual(queryKeys.all);
  });
});

describe('Historico', () => {
  const HISTORY = queryKeys.history();

  it('qualquer mutation de transacao derruba o Historico', async () => {
    // Criar, editar, excluir, restaurar e mudar status passam todos por
    // invalidateMonth / invalidateMonths.
    const { client, calls } = spy();
    await invalidateMonth(client, m('2026-07'));
    expect(calls).toContainEqual(HISTORY);
  });

  it('edicao que troca o mes tambem derruba o Historico', async () => {
    const { client, calls } = spy();
    await invalidateMonths(client, [m('2026-09'), m('2026-10')]);
    expect(calls).toContainEqual(HISTORY);
  });

  it('mudar o planejamento derruba o Historico, mas nao a lista de transacoes', async () => {
    const { client, calls } = spy();
    await invalidatePlan(client, m('2026-10'));
    expect(calls).toContainEqual(HISTORY);
    expect(calls).not.toContainEqual(queryKeys.transactionsByMonth(m('2026-10')));
  });

  it('mudar uma recorrencia derruba o Historico e a materializacao', async () => {
    const { client, calls } = spy();
    await invalidateRecurring(client);
    expect(calls).toContainEqual(HISTORY);
    expect(calls).toContainEqual(queryKeys.materialization());
  });

  it('cartoes e dividas nao tocam no Historico', async () => {
    const { client, calls } = spy();
    await invalidateCards(client);
    await invalidateDebts(client);
    expect(calls).not.toContainEqual(HISTORY);
  });

  it('a familia cobre todas as janelas em cache', () => {
    const prefix = JSON.stringify(HISTORY).slice(0, -1);
    expect(JSON.stringify(queryKeys.historyWindow(6, m('2026-10'))).startsWith(prefix)).toBe(true);
    expect(JSON.stringify(queryKeys.historyWindow(12, m('2027-03'))).startsWith(prefix)).toBe(true);
  });
});

describe('chave da janela do Historico', () => {
  it('6 meses de outubro nao e o mesmo cache que 6 meses de novembro', () => {
    expect(queryKeys.historyWindow(6, m('2026-10'))).not.toEqual(
      queryKeys.historyWindow(6, m('2026-11')),
    );
  });

  it('6 e 12 meses terminando no mesmo mes sao caches diferentes', () => {
    expect(queryKeys.historyWindow(6, m('2026-10'))).not.toEqual(
      queryKeys.historyWindow(12, m('2026-10')),
    );
  });

  it('tem o formato combinado: finan / history / tamanho / mes de referencia', () => {
    expect(queryKeys.historyWindow(6, m('2026-10'))).toEqual(['finan', 'history', 6, '2026-10']);
  });
});
