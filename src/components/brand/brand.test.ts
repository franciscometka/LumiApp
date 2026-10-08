import { describe, expect, it } from 'vitest';

import { STORAGE_KEY } from '@/data/adapters/local/persisted-schema';
import { FINAN_NAMESPACE } from '@/domain/shared/uuid-v5';
import { queryKeys } from '@/features/app/query-keys';

import { BRAND_NAME } from './brand';
import { LOCKUP_SIZE, LOCKUP_VIEW_BOX, MARK_COMPACT_PATH, MARK_PATH } from './brand-geometry';

describe('marca', () => {
  it('o produto se chama Lumi', () => {
    expect(BRAND_NAME).toBe('Lumi');
  });

  it('a geometria gerada esta presente e coerente', () => {
    expect(MARK_PATH.startsWith('M')).toBe(true);
    expect(MARK_COMPACT_PATH.startsWith('M')).toBe(true);
    expect(LOCKUP_VIEW_BOX.split(' ').slice(2).map(Number)).toEqual([
      LOCKUP_SIZE.width,
      LOCKUP_SIZE.height,
    ]);
  });
});

/**
 * O rebrand NAO pode tocar nestes valores: sao legado estavel do nome antigo
 * (ver brand.ts). Mudar qualquer um abandona dados salvos, gera ids novos para
 * as mesmas recorrencias ou invalida o cache inteiro.
 */
describe('identificadores legados', () => {
  it('a chave do localStorage continua finan:db', () => {
    expect(STORAGE_KEY).toBe('finan:db');
  });

  it('o namespace UUID v5 continua o mesmo', () => {
    expect(FINAN_NAMESPACE).toBe('6f9b1e54-0c7d-4f3a-9a2b-8d5e1c0a7b43');
  });

  it('a raiz das query keys continua finan', () => {
    expect(queryKeys.all).toEqual(['finan']);
  });
});
