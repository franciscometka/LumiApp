import { describe, expect, it } from 'vitest';

import {
  civilMonthResolver,
  currentPeriod,
  elapsedDaysInPeriod,
  isWithinPeriod,
  nextPeriod,
  periodLengthInDays,
  previousPeriod,
  remainingDaysInPeriod,
} from './period';
import { toMonthKey, toPlainDate } from './plain-date';

const outubro = civilMonthResolver.resolve(toMonthKey('2026-10'));
const fevereiro = civilMonthResolver.resolve(toMonthKey('2026-02'));
const fevereiroBissexto = civilMonthResolver.resolve(toMonthKey('2024-02'));

describe('civilMonthResolver', () => {
  it('cobre do dia 1 ao ultimo dia', () => {
    expect(outubro.start).toBe('2026-10-01');
    expect(outubro.end).toBe('2026-10-31');
    expect(outubro.key).toBe('2026-10');
    expect(outubro.label).toBe('outubro de 2026');
  });

  it('termina no dia certo em fevereiro', () => {
    expect(fevereiro.end).toBe('2026-02-28');
    expect(fevereiroBissexto.end).toBe('2024-02-29');
    expect(periodLengthInDays(fevereiro)).toBe(28);
    expect(periodLengthInDays(fevereiroBissexto)).toBe(29);
  });

  it('conta os dias de meses de 30 e 31 dias', () => {
    expect(periodLengthInDays(outubro)).toBe(31);
    expect(periodLengthInDays(civilMonthResolver.resolve(toMonthKey('2026-04')))).toBe(30);
  });

  it('mapeia uma data para o periodo a que pertence', () => {
    expect(civilMonthResolver.keyOf(toPlainDate('2026-10-01'))).toBe('2026-10');
    expect(civilMonthResolver.keyOf(toPlainDate('2026-10-31'))).toBe('2026-10');
    expect(civilMonthResolver.keyOf(toPlainDate('2026-11-01'))).toBe('2026-11');
  });

  it('navega entre periodos atravessando o ano', () => {
    expect(civilMonthResolver.next(toMonthKey('2026-12'))).toBe('2027-01');
    expect(civilMonthResolver.previous(toMonthKey('2026-01'))).toBe('2025-12');
    expect(nextPeriod(civilMonthResolver, outubro).key).toBe('2026-11');
    expect(previousPeriod(civilMonthResolver, outubro).key).toBe('2026-09');
  });

  it('resolve o periodo atual a partir de uma data', () => {
    expect(currentPeriod(civilMonthResolver, toPlainDate('2026-10-05')).key).toBe('2026-10');
  });
});

describe('pertinencia ao periodo', () => {
  it('inclui as duas pontas', () => {
    expect(isWithinPeriod(outubro, toPlainDate('2026-10-01'))).toBe(true);
    expect(isWithinPeriod(outubro, toPlainDate('2026-10-31'))).toBe(true);
    expect(isWithinPeriod(outubro, toPlainDate('2026-09-30'))).toBe(false);
    expect(isWithinPeriod(outubro, toPlainDate('2026-11-01'))).toBe(false);
  });
});

describe('dias decorridos e restantes', () => {
  it('conta o proprio dia de hoje como decorrido', () => {
    expect(elapsedDaysInPeriod(outubro, toPlainDate('2026-10-01'))).toBe(1);
    expect(elapsedDaysInPeriod(outubro, toPlainDate('2026-10-15'))).toBe(15);
    expect(elapsedDaysInPeriod(outubro, toPlainDate('2026-10-31'))).toBe(31);
  });

  it('limita o resultado quando a data esta fora do periodo', () => {
    // Sem a trava, uma data de setembro geraria dias negativos e a projecao
    // devolveria numeros sem sentido.
    expect(elapsedDaysInPeriod(outubro, toPlainDate('2026-09-01'))).toBe(0);
    expect(elapsedDaysInPeriod(outubro, toPlainDate('2026-12-25'))).toBe(31);
    expect(remainingDaysInPeriod(outubro, toPlainDate('2026-09-01'))).toBe(31);
    expect(remainingDaysInPeriod(outubro, toPlainDate('2026-12-25'))).toBe(0);
  });

  it('decorridos + restantes sempre fecham o total', () => {
    const datas = ['2026-10-01', '2026-10-15', '2026-10-31', '2026-08-01', '2027-01-01'];
    for (const dia of datas) {
      const hoje = toPlainDate(dia);
      expect(
        elapsedDaysInPeriod(outubro, hoje) + remainingDaysInPeriod(outubro, hoje),
      ).toBe(periodLengthInDays(outubro));
    }
  });

  it('funciona no ultimo dia de fevereiro', () => {
    expect(elapsedDaysInPeriod(fevereiro, toPlainDate('2026-02-28'))).toBe(28);
    expect(remainingDaysInPeriod(fevereiro, toPlainDate('2026-02-28'))).toBe(0);
    expect(elapsedDaysInPeriod(fevereiroBissexto, toPlainDate('2024-02-29'))).toBe(29);
  });
});
