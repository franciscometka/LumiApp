import { describe, expect, it } from 'vitest';

import { toMoney } from './money';
import {
  changePercentage,
  clampPercentage,
  displayPercentages,
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

describe('displayPercentages', () => {
  const soma = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

  it('fecha 100 no cenario que antes somava 101', () => {
    // Outubro do briefing: Cartao 1.139 + Carro 911 + Emprestimo 440 +
    // Internet 120 = R$ 2.610. Arredondando cada fatia por conta propria da
    // 44 + 35 + 17 + 5 = 101 — era o que a legenda do donut exibia.
    const cents = [113900, 91100, 44000, 12000];

    const individuais = cents.map((value) => roundPercentage((value / 261000) * 100, 0));
    expect(soma(individuais)).toBe(101);

    const exibidos = displayPercentages(cents);
    expect(exibidos).toEqual([44, 35, 17, 4]);
    expect(soma(exibidos ?? [])).toBe(100);
  });

  it('devolve null quando nao ha percentual a distribuir', () => {
    expect(displayPercentages([])).toBeNull();
    expect(displayPercentages([0])).toBeNull();
    expect(displayPercentages([0, 0, 0])).toBeNull();
  });

  it('devolve null diante de valor negativo ou nao finito', () => {
    // Um conjunto com sinais mistos nao tem "fatia de um todo".
    expect(displayPercentages([-100, 500])).toBeNull();
    expect(displayPercentages([100, -100])).toBeNull();
    expect(displayPercentages([Number.NaN, 100])).toBeNull();
    expect(displayPercentages([Number.POSITIVE_INFINITY, 100])).toBeNull();
  });

  it('da 100% a uma fatia unica', () => {
    expect(displayPercentages([50000])).toEqual([100]);
    expect(displayPercentages([1])).toEqual([100]);
  });

  it('distribui tres fatias iguais fechando 100', () => {
    // 33,33 cada: o ponto que falta vai para a primeira, por desempate de
    // indice. O importante e que a soma feche e a escolha seja estavel.
    const exibidos = displayPercentages([1000, 1000, 1000]);
    expect(exibidos).toEqual([34, 33, 33]);
    expect(soma(exibidos ?? [])).toBe(100);
  });

  it('respeita decimals = 1', () => {
    const exibidos = displayPercentages([1000, 1000, 1000], 1);
    expect(exibidos).toEqual([33.4, 33.3, 33.3]);
    expect(soma(exibidos ?? [])).toBeCloseTo(100, 10);

    const briefing = displayPercentages([113900, 91100, 44000, 12000], 1);
    expect(soma(briefing ?? [])).toBeCloseTo(100, 10);
  });

  it('e deterministico quando os restos empatam', () => {
    // Sete fatias iguais: 14,2857 cada, restos identicos. Os dois pontos de
    // sobra precisam cair sempre nas mesmas fatias.
    const valores = [10, 10, 10, 10, 10, 10, 10];
    const exibidos = displayPercentages(valores);

    expect(exibidos).toEqual([15, 15, 14, 14, 14, 14, 14]);
    expect(soma(exibidos ?? [])).toBe(100);
    expect(displayPercentages(valores)).toEqual(exibidos);
  });

  it('nunca estoura nem falta, em muitos formatos de carteira', () => {
    const carteiras = [
      [1],
      [1, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [99999, 1],
      [1, 1, 99998],
      [12345, 6789, 101112, 131, 4],
      [333, 333, 334],
    ];

    for (const carteira of carteiras) {
      const exibidos = displayPercentages(carteira);
      expect(exibidos).not.toBeNull();
      expect(soma(exibidos ?? [])).toBe(100);
      expect(exibidos).toHaveLength(carteira.length);
      // Nenhuma fatia pode ficar negativa por causa do ajuste.
      expect((exibidos ?? []).every((value) => value >= 0)).toBe(true);
    }
  });
});
