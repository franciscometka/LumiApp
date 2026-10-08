import { describe, expect, it } from 'vitest';

import { resolveWindowParam } from './window-param';

describe('resolveWindowParam', () => {
  it('padrao e 6 meses', () => {
    expect(resolveWindowParam(null)).toBe(6);
    expect(resolveWindowParam(undefined)).toBe(6);
  });

  it('aceita exatamente 6 e 12', () => {
    expect(resolveWindowParam('6')).toBe(6);
    expect(resolveWindowParam('12')).toBe(12);
  });

  it('qualquer outro valor cai no padrao', () => {
    for (const raw of ['3', '24', '0', '-6', 'abc', '', '6.0', '12abc', '1e1']) {
      expect(resolveWindowParam(raw), raw).toBe(6);
    }
  });
});
