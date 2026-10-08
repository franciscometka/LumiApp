import { describe, expect, it } from 'vitest';

import { createLocalStack } from '@/data/adapters/local/local-data-source';
import { createMemoryStorageDriver } from '@/data/adapters/local/storage-driver';
import { findCardNameConflict } from '@/domain/entities/card';

/**
 * A regra contra o storage real: o que a gravacao (`assertUniqueName`) le e o
 * mesmo `findAll` sem excluidos, entao um cartao apagado libera o nome.
 */
describe('nome de cartao contra o storage', () => {
  it('excluir libera o nome; restaurar o devolve', async () => {
    const { dataSource, userId } = createLocalStack({ driver: createMemoryStorageDriver() });
    const base = {
      userId,
      limitCents: 0,
      currentInvoiceCents: 0,
      closingDay: 1,
      dueDay: 10,
      colorToken: 'chart-1',
    };
    const card = await dataSource.cards.create({ ...base, name: 'Nubank' } as Parameters<
      typeof dataSource.cards.create
    >[0]);

    expect(findCardNameConflict('NÚBANK', await dataSource.cards.findAll())).not.toBeNull();

    await dataSource.cards.remove(card.id);
    expect(findCardNameConflict('NÚBANK', await dataSource.cards.findAll())).toBeNull();
    // Mesmo pedindo os excluidos, a regra os ignora.
    expect(
      findCardNameConflict('NÚBANK', await dataSource.cards.findAll({ includeDeleted: true })),
    ).toBeNull();
  });
});
