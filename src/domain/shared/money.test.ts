import { describe, expect, it } from 'vitest';

import {
  MONEY_MAX_CENTS,
  ZERO_MONEY,
  absMoney,
  addMoney,
  allocateMoney,
  clampMoneyToZero,
  compareMoney,
  divideMoney,
  formatMoney,
  formatMoneyPlain,
  formatMoneySigned,
  isMoney,
  maxMoney,
  minMoney,
  moneyFromReais,
  moneyToReais,
  multiplyMoney,
  negateMoney,
  parseMoney,
  subtractMoney,
  sumMoney,
  toMoney,
  tryToMoney,
} from './money';

describe('isMoney / toMoney', () => {
  it('aceita inteiros dentro do limite, inclusive negativos e zero', () => {
    expect(isMoney(0)).toBe(true);
    expect(isMoney(230000)).toBe(true);
    expect(isMoney(-44000)).toBe(true);
    expect(isMoney(MONEY_MAX_CENTS)).toBe(true);
    expect(isMoney(-MONEY_MAX_CENTS)).toBe(true);
  });

  it('recusa fracoes, valores nao numericos e estouro de limite', () => {
    expect(isMoney(10.5)).toBe(false);
    expect(isMoney(Number.NaN)).toBe(false);
    expect(isMoney(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isMoney(MONEY_MAX_CENTS + 1)).toBe(false);
    expect(isMoney('100')).toBe(false);
    expect(isMoney(null)).toBe(false);
    expect(isMoney(undefined)).toBe(false);
  });

  it('toMoney lanca em valor invalido e tryToMoney devolve null', () => {
    expect(() => toMoney(1.5)).toThrow(RangeError);
    expect(() => toMoney(Number.NaN)).toThrow(RangeError);
    expect(tryToMoney(1.5)).toBeNull();
    expect(tryToMoney(500)).toBe(500);
  });
});

describe('conversao reais <-> centavos', () => {
  it('converte valores que o float representa mal', () => {
    // 19.99 * 100 === 1998.9999999999998 em IEEE 754.
    expect(moneyFromReais(19.99)).toBe(1999);
    expect(moneyFromReais(0.1 + 0.2)).toBe(30);
    expect(moneyFromReais(2300)).toBe(230000);
    expect(moneyFromReais(0)).toBe(0);
  });

  it('arredonda afastando do zero nos dois sinais', () => {
    expect(moneyFromReais(1.005)).toBe(100); // limite real do float na entrada
    expect(moneyFromReais(0.125)).toBe(13);
    expect(moneyFromReais(-0.125)).toBe(-13);
    expect(moneyFromReais(-19.99)).toBe(-1999);
  });

  it('recusa entrada nao finita', () => {
    expect(() => moneyFromReais(Number.NaN)).toThrow(RangeError);
    expect(() => moneyFromReais(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('volta para reais sem perder o valor', () => {
    expect(moneyToReais(toMoney(230000))).toBe(2300);
    expect(moneyToReais(toMoney(-37400))).toBe(-374);
  });
});

describe('parseMoney', () => {
  it('interpreta o formato pt-BR completo', () => {
    expect(parseMoney('R$ 2.300,00')).toBe(230000);
    expect(parseMoney('2.300,00')).toBe(230000);
    expect(parseMoney('1.234.567,89')).toBe(123456789);
    expect(parseMoney('911,00')).toBe(91100);
    expect(parseMoney('0,01')).toBe(1);
  });

  it('trata o ponto como milhar apenas quando sobram 3 digitos', () => {
    expect(parseMoney('1.500')).toBe(150000);
    expect(parseMoney('1.50')).toBe(150);
    expect(parseMoney('1.5')).toBe(150);
    expect(parseMoney('1234.56')).toBe(123456);
  });

  it('aceita valores sem casas decimais e sem parte inteira', () => {
    expect(parseMoney('440')).toBe(44000);
    expect(parseMoney(',56')).toBe(56);
    expect(parseMoney('0')).toBe(0);
  });

  it('arredonda a terceira casa sem usar float, propagando o vai-um', () => {
    expect(parseMoney('1,234')).toBe(123);
    expect(parseMoney('1,235')).toBe(124);
    expect(parseMoney('1,999')).toBe(200);
    expect(parseMoney('9,999')).toBe(1000);
    expect(parseMoney('0,005')).toBe(1);
  });

  it('entende sinal negativo e ignora ruido ao redor', () => {
    expect(parseMoney('-R$ 374,00')).toBe(-37400);
    expect(parseMoney('  R$   765,00  ')).toBe(76500);
    expect(parseMoney('R$ 120,00')).toBe(12000);
  });

  it('devolve null para entrada invalida ou fora do limite', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('R$')).toBeNull();
    expect(parseMoney(',')).toBeNull();
    expect(parseMoney('999999999999999999999')).toBeNull();
  });

  it('nao perde precisao em valores grandes', () => {
    expect(parseMoney('9.999.999.999,99')).toBe(999999999999);
    expect(parseMoney('99.999.999.999,99')).toBeNull(); // acima de MONEY_MAX_CENTS
  });
});

describe('formatacao', () => {
  it('formata em BRL com espaco comum', () => {
    expect(formatMoney(toMoney(230000))).toBe('R$ 2.300,00');
    expect(formatMoney(toMoney(49000))).toBe('R$ 490,00');
    expect(formatMoney(ZERO_MONEY)).toBe('R$ 0,00');
    expect(formatMoney(toMoney(230000))).not.toContain(' ');
  });

  it('formata valores grandes sem erro de arredondamento', () => {
    expect(formatMoney(toMoney(MONEY_MAX_CENTS))).toBe('R$ 9.999.999.999,99');
    expect(formatMoney(toMoney(1))).toBe('R$ 0,01');
    expect(formatMoney(toMoney(999))).toBe('R$ 9,99');
  });

  it('formata sem simbolo e com sinal explicito', () => {
    expect(formatMoneyPlain(toMoney(261000))).toBe('2.610,00');
    expect(formatMoneySigned(toMoney(30000))).toBe('+ R$ 300,00');
    expect(formatMoneySigned(toMoney(-30000))).toBe('- R$ 300,00');
    expect(formatMoneySigned(toMoney(-30000), { minusSign: '−' })).toBe('− R$ 300,00');
    expect(formatMoneySigned(toMoney(30000), { showPlusSign: false })).toBe('R$ 300,00');
    expect(formatMoneySigned(ZERO_MONEY)).toBe('+ R$ 0,00');
  });
});

describe('aritmetica', () => {
  it('soma e subtrai em inteiros', () => {
    expect(addMoney(toMoney(230000), toMoney(30000))).toBe(260000);
    expect(subtractMoney(toMoney(310000), toMoney(261000))).toBe(49000);
    expect(subtractMoney(toMoney(100), toMoney(300))).toBe(-200);
  });

  it('soma listas, inclusive vazias', () => {
    expect(sumMoney([])).toBe(0);
    const valores = [91100, 12000, 37400, 76500, 44000].map(toMoney);
    expect(sumMoney(valores)).toBe(261000);
  });

  it('nao acumula erro de ponto flutuante em somas repetidas', () => {
    const umCentavo = toMoney(1);
    const valores = Array.from({ length: 10_000 }, () => umCentavo);
    expect(sumMoney(valores)).toBe(10_000);
  });

  it('nega, absolutiza e compara', () => {
    expect(negateMoney(toMoney(500))).toBe(-500);
    expect(absMoney(toMoney(-500))).toBe(500);
    expect(compareMoney(toMoney(1), toMoney(2))).toBe(-1);
    expect(compareMoney(toMoney(2), toMoney(2))).toBe(0);
    expect(compareMoney(toMoney(3), toMoney(2))).toBe(1);
    expect(maxMoney(toMoney(1), toMoney(2))).toBe(2);
    expect(minMoney(toMoney(1), toMoney(2))).toBe(1);
  });

  it('multiplica e divide voltando a centavo inteiro', () => {
    expect(multiplyMoney(toMoney(44000), 12)).toBe(528000);
    expect(multiplyMoney(toMoney(100), 0.5)).toBe(50);
    expect(multiplyMoney(toMoney(101), 0.5)).toBe(51); // 50,5 -> afasta do zero
    expect(multiplyMoney(toMoney(-101), 0.5)).toBe(-51);
    expect(divideMoney(toMoney(1000), 3)).toBe(333);
    expect(divideMoney(toMoney(-1000), 3)).toBe(-333);
  });

  it('recusa divisao por zero e fatores invalidos', () => {
    expect(() => divideMoney(toMoney(1000), 0)).toThrow(RangeError);
    expect(() => divideMoney(toMoney(1000), Number.NaN)).toThrow(RangeError);
    expect(() => multiplyMoney(toMoney(1000), Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('estoura ao ultrapassar o limite representavel', () => {
    expect(() => addMoney(toMoney(MONEY_MAX_CENTS), toMoney(1))).toThrow(RangeError);
  });
});

describe('allocateMoney', () => {
  it('reparte sem perder nem inventar centavos', () => {
    const partes = allocateMoney(toMoney(1000), 3);
    expect(partes).toEqual([334, 333, 333]);
    expect(sumMoney(partes)).toBe(1000);
  });

  it('mantem a soma exata em divisoes dificeis', () => {
    for (const total of [100, 101, 999, 1_000_000, 123_457]) {
      for (const partes of [2, 3, 7, 12, 13]) {
        const alocado = allocateMoney(toMoney(total), partes);
        expect(alocado).toHaveLength(partes);
        expect(sumMoney(alocado)).toBe(total);
      }
    }
  });

  it('preserva o sinal em valores negativos', () => {
    const partes = allocateMoney(toMoney(-1000), 3);
    expect(partes).toEqual([-334, -333, -333]);
    expect(sumMoney(partes)).toBe(-1000);
  });

  it('lida com zero e com uma unica parte', () => {
    expect(allocateMoney(ZERO_MONEY, 3)).toEqual([0, 0, 0]);
    expect(allocateMoney(toMoney(777), 1)).toEqual([777]);
  });

  it('recusa quantidade de partes invalida', () => {
    expect(() => allocateMoney(toMoney(100), 0)).toThrow(RangeError);
    expect(() => allocateMoney(toMoney(100), -1)).toThrow(RangeError);
    expect(() => allocateMoney(toMoney(100), 2.5)).toThrow(RangeError);
  });
});

describe('zero negativo', () => {
  it('nunca escapa de nenhuma operacao', () => {
    // `Object.is` distingue -0 de 0; `toBe` usa essa mesma comparacao.
    expect(negateMoney(ZERO_MONEY)).toBe(0);
    expect(multiplyMoney(ZERO_MONEY, -1)).toBe(0);
    expect(multiplyMoney(toMoney(-1), 0)).toBe(0);
    expect(divideMoney(ZERO_MONEY, -5)).toBe(0);
    expect(subtractMoney(ZERO_MONEY, ZERO_MONEY)).toBe(0);
    expect(absMoney(ZERO_MONEY)).toBe(0);
    expect(parseMoney('-0,00')).toBe(0);
    expect(allocateMoney(ZERO_MONEY, 2).every((part) => Object.is(part, 0))).toBe(true);
  });

  it('por isso o zero nunca aparece formatado como negativo', () => {
    expect(formatMoney(negateMoney(ZERO_MONEY))).toBe('R$ 0,00');
    expect(formatMoneySigned(negateMoney(ZERO_MONEY))).toBe('+ R$ 0,00');
  });
});

describe('clampMoneyToZero', () => {
  it('zera negativos e preserva o resto', () => {
    expect(clampMoneyToZero(toMoney(-500))).toBe(0);
    expect(clampMoneyToZero(ZERO_MONEY)).toBe(0);
    expect(clampMoneyToZero(toMoney(500))).toBe(500);
  });
});

describe('cenario do briefing', () => {
  it('reproduz os totais informados', () => {
    const entradas = [230000, 30000, 10000, 40000].map(toMoney);
    const gastos = [91100, 12000, 37400, 76500, 44000].map(toMoney);

    const totalEntradas = sumMoney(entradas);
    const totalGastos = sumMoney(gastos);
    const saldo = subtractMoney(totalEntradas, totalGastos);

    expect(formatMoney(totalEntradas)).toBe('R$ 3.100,00');
    expect(formatMoney(totalGastos)).toBe('R$ 2.610,00');
    expect(formatMoney(saldo)).toBe('R$ 490,00');
  });
});
