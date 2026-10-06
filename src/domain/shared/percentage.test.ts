import { describe, expect, it } from 'vitest';

import { toMoney } from './money';
import {
  changePercentage,
  clampPercentage,
  formatPercentage,
  roundPercentage,
  safePercentage,
} from './percentage';

describe('safePercentage', () => {
  it('calcula a participacao', () => {
    expect(safePercentage(toMoney(261000), toMoney(310000))).toBeCloseTo(84.19, 2);
    expect(safePercentage(toMoney(50), toMoney(200))).toBe(25);
    expect(safePercentage(toMoney(200), toMoney(200))).toBe(100);
  });

  it('devolve null em divisao por zero, nunca 0', () => {
    // "0% da renda utilizada" seria falso quando nao ha renda registrada.
    expect(safePercentage(toMoney(261000), toMoney(0))).toBeNull();
    expect(safePercentage(toMoney(0), toMoney(0))).toBeNull();
  });

  it('permite passar de 100% e lida com sinais', () => {
    expect(safePercentage(toMoney(300), toMoney(200))).toBe(150);
    expect(safePercentage(toMoney(-100), toMoney(200))).toBe(-50);
    expect(safePercentage(toMoney(100), toMoney(-200))).toBe(-50);
  });

  it('devolve 0 quando a parte e zero mas a base existe', () => {
    expect(safePercentage(toMoney(0), toMoney(200))).toBe(0);
  });
});

describe('changePercentage', () => {
  it('reproduz a variacao do briefing', () => {
    // Setembro R$ 2.300 -> Outubro R$ 2.610 = +13,5%
    const variacao = changePercentage(toMoney(261000), toMoney(230000));
    expect(variacao).not.toBeNull();
    expect(roundPercentage(variacao as number, 1)).toBe(13.5);
  });

  it('devolve null quando nao ha base de comparacao', () => {
    // Sair de R$ 0 para R$ 100 nao e "+100%", e um comeco.
    expect(changePercentage(toMoney(10000), toMoney(0))).toBeNull();
    expect(changePercentage(toMoney(0), toMoney(0))).toBeNull();
  });

  it('calcula queda e estabilidade', () => {
    expect(changePercentage(toMoney(50), toMoney(100))).toBe(-50);
    expect(changePercentage(toMoney(100), toMoney(100))).toBe(0);
    expect(changePercentage(toMoney(0), toMoney(100))).toBe(-100);
  });

  it('mantem a direcao correta com base negativa', () => {
    // Saldo saiu de -100 para -50: melhorou, logo variacao positiva.
    expect(changePercentage(toMoney(-50), toMoney(-100))).toBe(50);
    // Saldo saiu de -100 para -150: piorou.
    expect(changePercentage(toMoney(-150), toMoney(-100))).toBe(-50);
  });
});

describe('roundPercentage e clampPercentage', () => {
  it('arredonda para exibicao', () => {
    expect(roundPercentage(84.1935, 1)).toBe(84.2);
    expect(roundPercentage(84.1935, 0)).toBe(84);
    expect(roundPercentage(84.1935, 2)).toBe(84.19);
  });

  it('limita barras de progresso a 0-100', () => {
    expect(clampPercentage(150)).toBe(100);
    expect(clampPercentage(-20)).toBe(0);
    expect(clampPercentage(42)).toBe(42);
  });
});

describe('formatPercentage', () => {
  it('formata no padrao pt-BR', () => {
    expect(formatPercentage(84)).toBe('84%');
    expect(formatPercentage(13.5, { decimals: 1 })).toBe('13,5%');
    expect(formatPercentage(-13.5, { decimals: 1 })).toBe('-13,5%');
    expect(formatPercentage(13.5, { decimals: 1, showSign: true })).toBe('+13,5%');
    expect(formatPercentage(0, { showSign: true })).toBe('0%');
  });

  it('usa o fallback quando nao ha percentual definido', () => {
    expect(formatPercentage(null)).toBe('—');
    expect(formatPercentage(null, { fallback: 'sem dados' })).toBe('sem dados');
    expect(formatPercentage(Number.NaN)).toBe('—');
    expect(formatPercentage(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
