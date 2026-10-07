import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  addMonthsToKey,
  compareMonthKeys,
  comparePlainDates,
  daysInMonth,
  daysInMonthKey,
  differenceInDays,
  differenceInMonths,
  firstDayOfMonth,
  formatMonthKey,
  formatPlainDate,
  formatPlainDateLong,
  formatRelativeDay,
  fromDayNumber,
  getParts,
  isAfter,
  isBefore,
  isLeapYear,
  isSameDate,
  isValidMonthKey,
  isValidPlainDate,
  isWithin,
  lastDayOfMonth,
  makeMonthKey,
  makePlainDate,
  makePlainDateClamped,
  maxDate,
  minDate,
  monthKeyOf,
  parseMonthKey,
  parsePlainDate,
  toDayNumber,
  toMonthKey,
  toPlainDate,
  todayPlainDate,
} from './plain-date';

describe('anos bissextos', () => {
  it('aplica a regra completa, incluindo as excecoes de seculo', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false); // divisivel por 100
    expect(isLeapYear(2000)).toBe(true); // divisivel por 400
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2400)).toBe(true);
  });

  it('reflete o bissexto em fevereiro', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
  });

  it('conhece a duracao de todos os meses', () => {
    const esperado = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    esperado.forEach((dias, indice) => {
      expect(daysInMonth(2026, indice + 1)).toBe(dias);
    });
    expect(() => daysInMonth(2026, 0)).toThrow(RangeError);
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
  });
});

describe('validacao', () => {
  it('aceita datas reais do calendario', () => {
    expect(isValidPlainDate('2026-10-05')).toBe(true);
    expect(isValidPlainDate('2024-02-29')).toBe(true);
    expect(isValidPlainDate('2026-12-31')).toBe(true);
  });

  it('recusa datas que o calendario nao tem', () => {
    expect(isValidPlainDate('2026-02-29')).toBe(false); // 2026 nao e bissexto
    expect(isValidPlainDate('2026-02-30')).toBe(false);
    expect(isValidPlainDate('2026-04-31')).toBe(false);
    expect(isValidPlainDate('2026-13-01')).toBe(false);
    expect(isValidPlainDate('2026-00-10')).toBe(false);
    expect(isValidPlainDate('2026-10-00')).toBe(false);
  });

  it('recusa formatos fora do padrao', () => {
    expect(isValidPlainDate('05/10/2026')).toBe(false);
    expect(isValidPlainDate('2026-1-5')).toBe(false);
    expect(isValidPlainDate('2026-10-05T00:00:00Z')).toBe(false);
    expect(isValidPlainDate('')).toBe(false);
    expect(isValidPlainDate(null)).toBe(false);
    expect(isValidPlainDate(20261005)).toBe(false);
  });

  it('valida chaves de mes', () => {
    expect(isValidMonthKey('2026-10')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-00')).toBe(false);
    expect(isValidMonthKey('2026-10-05')).toBe(false);
    expect(parseMonthKey('2026-10')).toBe('2026-10');
    expect(parseMonthKey('xxx')).toBeNull();
    expect(() => toMonthKey('2026-13')).toThrow(RangeError);
  });

  it('lanca ou devolve null conforme a funcao', () => {
    expect(() => toPlainDate('2026-02-30')).toThrow(RangeError);
    expect(parsePlainDate('2026-02-30')).toBeNull();
    expect(parsePlainDate('2026-02-28')).toBe('2026-02-28');
  });
});

describe('construcao com limite de dia', () => {
  it('recusa dia acima do mes em makePlainDate', () => {
    expect(() => makePlainDate(2026, 2, 31)).toThrow(RangeError);
    expect(makePlainDate(2026, 2, 28)).toBe('2026-02-28');
  });

  it('limita o dia ao ultimo do mes em makePlainDateClamped', () => {
    expect(makePlainDateClamped(2026, 2, 31)).toBe('2026-02-28');
    expect(makePlainDateClamped(2024, 2, 31)).toBe('2024-02-29');
    expect(makePlainDateClamped(2026, 4, 31)).toBe('2026-04-30');
    expect(makePlainDateClamped(2026, 1, 31)).toBe('2026-01-31');
    expect(makePlainDateClamped(2026, 10, 0)).toBe('2026-10-01');
  });

  it('decompoe a data corretamente', () => {
    expect(getParts(toPlainDate('2026-10-05'))).toEqual({ year: 2026, month: 10, day: 5 });
  });
});

describe('aritmetica de dias', () => {
  it('atravessa viradas de mes e de ano', () => {
    expect(addDays(toPlainDate('2026-10-31'), 1)).toBe('2026-11-01');
    expect(addDays(toPlainDate('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(toPlainDate('2027-01-01'), -1)).toBe('2026-12-31');
    expect(addDays(toPlainDate('2026-10-05'), 0)).toBe('2026-10-05');
  });

  it('atravessa fevereiro nos dois tipos de ano', () => {
    expect(addDays(toPlainDate('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(toPlainDate('2024-02-29'), 1)).toBe('2024-03-01');
    expect(addDays(toPlainDate('2026-02-28'), 1)).toBe('2026-03-01');
    expect(differenceInDays(toPlainDate('2024-01-01'), toPlainDate('2025-01-01'))).toBe(366);
    expect(differenceInDays(toPlainDate('2026-01-01'), toPlainDate('2027-01-01'))).toBe(365);
  });

  it('calcula diferencas exatas, inclusive negativas', () => {
    expect(differenceInDays(toPlainDate('2026-10-01'), toPlainDate('2026-10-31'))).toBe(30);
    expect(differenceInDays(toPlainDate('2026-10-31'), toPlainDate('2026-10-01'))).toBe(-30);
    expect(differenceInDays(toPlainDate('2026-10-05'), toPlainDate('2026-10-05'))).toBe(0);
  });

  it('nao e afetado pelo horario de verao', () => {
    // O Brasil ja mudou o relogio em 15/10 e 18/02. Com `Date` local, um
    // destes intervalos teria 23 ou 25 horas e a conta erraria por um dia.
    expect(differenceInDays(toPlainDate('2018-10-14'), toPlainDate('2018-10-16'))).toBe(2);
    expect(differenceInDays(toPlainDate('2018-02-17'), toPlainDate('2018-02-19'))).toBe(2);
  });

  it('converte para numero serial e volta sem perda', () => {
    const datas = ['1900-01-01', '2000-02-29', '2026-10-05', '2999-12-31'];
    for (const data of datas) {
      const date = toPlainDate(data);
      expect(fromDayNumber(toDayNumber(date))).toBe(data);
    }
    expect(toDayNumber(toPlainDate('1970-01-01'))).toBe(0);
  });
});

describe('aritmetica de meses', () => {
  it('limita o dia ao ultimo dia do mes de destino', () => {
    expect(addMonths(toPlainDate('2026-01-31'), 1)).toBe('2026-02-28');
    expect(addMonths(toPlainDate('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(toPlainDate('2026-03-31'), -1)).toBe('2026-02-28');
    expect(addMonths(toPlainDate('2026-05-31'), 1)).toBe('2026-06-30');
    expect(addMonths(toPlainDate('2026-01-15'), 1)).toBe('2026-02-15');
  });

  it('atravessa o ano nos dois sentidos', () => {
    expect(addMonths(toPlainDate('2026-12-15'), 1)).toBe('2027-01-15');
    expect(addMonths(toPlainDate('2026-01-15'), -1)).toBe('2025-12-15');
    expect(addMonths(toPlainDate('2026-06-15'), 12)).toBe('2027-06-15');
    expect(addMonths(toPlainDate('2026-06-15'), -18)).toBe('2024-12-15');
  });

  it('nao acumula erro ao somar mes a mes', () => {
    // 31/01 + 1 mes = 28/02; +1 mes a partir dai NAO deve voltar para 31/03.
    const fevereiro = addMonths(toPlainDate('2026-01-31'), 1);
    expect(addMonths(fevereiro, 1)).toBe('2026-03-28');
  });
});

describe('chaves de mes', () => {
  it('extrai e monta a chave', () => {
    expect(monthKeyOf(toPlainDate('2026-10-05'))).toBe('2026-10');
    expect(makeMonthKey(2026, 1)).toBe('2026-01');
    expect(firstDayOfMonth(toMonthKey('2026-10'))).toBe('2026-10-01');
    expect(lastDayOfMonth(toMonthKey('2026-10'))).toBe('2026-10-31');
  });

  it('entrega o ultimo dia correto de fevereiro', () => {
    expect(lastDayOfMonth(toMonthKey('2026-02'))).toBe('2026-02-28');
    expect(lastDayOfMonth(toMonthKey('2024-02'))).toBe('2024-02-29');
    expect(daysInMonthKey(toMonthKey('2024-02'))).toBe(29);
    expect(daysInMonthKey(toMonthKey('2026-02'))).toBe(28);
  });

  it('navega entre meses atravessando o ano', () => {
    expect(addMonthsToKey(toMonthKey('2026-12'), 1)).toBe('2027-01');
    expect(addMonthsToKey(toMonthKey('2026-01'), -1)).toBe('2025-12');
    expect(addMonthsToKey(toMonthKey('2026-10'), 0)).toBe('2026-10');
    expect(addMonthsToKey(toMonthKey('2026-10'), -24)).toBe('2024-10');
  });

  it('compara e mede distancia entre meses', () => {
    expect(compareMonthKeys(toMonthKey('2026-09'), toMonthKey('2026-10'))).toBe(-1);
    expect(compareMonthKeys(toMonthKey('2026-10'), toMonthKey('2026-10'))).toBe(0);
    expect(compareMonthKeys(toMonthKey('2026-11'), toMonthKey('2026-10'))).toBe(1);
    expect(differenceInMonths(toMonthKey('2026-01'), toMonthKey('2026-10'))).toBe(9);
    expect(differenceInMonths(toMonthKey('2026-10'), toMonthKey('2025-10'))).toBe(-12);
  });
});

describe('comparacao e intervalos', () => {
  it('ordena datas', () => {
    const a = toPlainDate('2026-10-01');
    const b = toPlainDate('2026-10-31');
    expect(comparePlainDates(a, b)).toBe(-1);
    expect(comparePlainDates(b, a)).toBe(1);
    expect(comparePlainDates(a, a)).toBe(0);
    expect(isBefore(a, b)).toBe(true);
    expect(isAfter(b, a)).toBe(true);
    expect(isSameDate(a, a)).toBe(true);
    expect(minDate(a, b)).toBe(a);
    expect(maxDate(a, b)).toBe(b);
  });

  it('trata o intervalo como fechado nas duas pontas', () => {
    const inicio = toPlainDate('2026-10-01');
    const fim = toPlainDate('2026-10-31');
    expect(isWithin(inicio, inicio, fim)).toBe(true);
    expect(isWithin(fim, inicio, fim)).toBe(true);
    expect(isWithin(toPlainDate('2026-10-15'), inicio, fim)).toBe(true);
    expect(isWithin(toPlainDate('2026-09-30'), inicio, fim)).toBe(false);
    expect(isWithin(toPlainDate('2026-11-01'), inicio, fim)).toBe(false);
  });
});

describe('fuso horario', () => {
  it('nao desloca o dia ao formatar — o bug classico do toISOString', () => {
    // Os testes rodam em America/Sao_Paulo (UTC-3). Se qualquer funcao usasse
    // `new Date('2026-10-01')` com leitura local, o dia 1 viraria 30/09.
    const primeiroDia = toPlainDate('2026-10-01');
    expect(formatPlainDate(primeiroDia)).toBe('01/10/2026');
    expect(formatPlainDateLong(primeiroDia)).toContain('1 de outubro');
    expect(monthKeyOf(primeiroDia)).toBe('2026-10');
  });

  it('mantem o ultimo dia do mes intacto', () => {
    const ultimoDia = toPlainDate('2026-10-31');
    expect(formatPlainDate(ultimoDia)).toBe('31/10/2026');
    expect(monthKeyOf(ultimoDia)).toBe('2026-10');
  });

  it('todayPlainDate respeita o fuso pedido', () => {
    const saoPaulo = todayPlainDate('America/Sao_Paulo');
    const quiritimati = todayPlainDate('Pacific/Kiritimati'); // UTC+14
    expect(isValidPlainDate(saoPaulo)).toBe(true);
    expect(isValidPlainDate(quiritimati)).toBe(true);
    // Kiritimati esta sempre a frente ou no mesmo dia que Sao Paulo.
    expect(comparePlainDates(quiritimati, saoPaulo)).toBeGreaterThanOrEqual(0);
  });
});

describe('formatacao pt-BR', () => {
  it('formata datas e meses no padrao brasileiro', () => {
    expect(formatPlainDate(toPlainDate('2026-10-05'))).toBe('05/10/2026');
    expect(formatMonthKey(toMonthKey('2026-10'))).toBe('outubro de 2026');
    expect(formatMonthKey(toMonthKey('2026-02'))).toBe('fevereiro de 2026');
  });
});

describe('formatRelativeDay', () => {
  const hoje = toPlainDate('2026-10-05');

  it('nomeia os tres dias que a pessoa reconhece de imediato', () => {
    expect(formatRelativeDay(toPlainDate('2026-10-05'), hoje)).toBe('Hoje');
    expect(formatRelativeDay(toPlainDate('2026-10-04'), hoje)).toBe('Ontem');
    expect(formatRelativeDay(toPlainDate('2026-10-06'), hoje)).toBe('Amanhã');
  });

  it('fora dessa janela usa a data, nao "ha N dias"', () => {
    // "ha 4 dias" obrigaria a pessoa a fazer a conta para saber que dia foi.
    expect(formatRelativeDay(toPlainDate('2026-10-01'), hoje)).toBe(
      'quinta-feira, 1 de outubro',
    );
  });

  it('atravessa a virada de mes', () => {
    const primeiro = toPlainDate('2026-10-01');
    expect(formatRelativeDay(toPlainDate('2026-09-30'), primeiro)).toBe('Ontem');
    expect(formatRelativeDay(toPlainDate('2026-10-02'), primeiro)).toBe('Amanhã');
  });

  it('atravessa a virada de ano', () => {
    const reveillon = toPlainDate('2027-01-01');
    expect(formatRelativeDay(toPlainDate('2026-12-31'), reveillon)).toBe('Ontem');
  });

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const primeiroDeMarco = toPlainDate('2028-03-01');
    expect(formatRelativeDay(toPlainDate('2028-02-29'), primeiroDeMarco)).toBe('Ontem');
  });

  it('nao desloca o dia por fuso horario', () => {
    // O teste roda com TZ=America/Sao_Paulo. Um `new Date('2026-10-05')`
    // interpretado como meia-noite UTC viraria 4 de outubro aqui.
    expect(formatRelativeDay(toPlainDate('2026-10-05'), toPlainDate('2026-10-05'))).toBe('Hoje');
    expect(formatRelativeDay(toPlainDate('2026-01-01'), toPlainDate('2026-01-03'))).toBe(
      'quinta-feira, 1 de janeiro',
    );
  });
});
