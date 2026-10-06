import type { MonthKey, PlainDate } from './plain-date';
import {
  addMonthsToKey,
  differenceInDays,
  firstDayOfMonth,
  formatMonthKey,
  isWithin,
  lastDayOfMonth,
  monthKeyOf,
} from './plain-date';

/**
 * Janela de tempo sobre a qual todo calculo financeiro acontece.
 * As pontas sao inclusivas.
 */
export interface Period {
  /** Identidade estavel do periodo. Continua sendo 'YYYY-MM' mesmo que o
   *  ciclo nao coincida com o mes civil. */
  readonly key: MonthKey;
  readonly start: PlainDate;
  readonly end: PlainDate;
  readonly label: string;
}

/**
 * Ponto de extensao do ciclo financeiro.
 *
 * A v1 usa apenas `civilMonthResolver` (dia 1 ao ultimo dia). Um futuro
 * `salaryCycleResolver(salaryDay)` implementa esta mesma interface e passa a
 * ser injetado no lugar — sem que nenhuma funcao de `calculations/` mude,
 * porque todas recebem `Period`, nunca um mes.
 */
export interface PeriodResolver {
  readonly id: string;
  /** Monta o periodo correspondente a uma chave. */
  resolve(key: MonthKey): Period;
  /** A que periodo uma data pertence. */
  keyOf(date: PlainDate): MonthKey;
  next(key: MonthKey): MonthKey;
  previous(key: MonthKey): MonthKey;
}

export const civilMonthResolver: PeriodResolver = {
  id: 'civil-month',

  resolve(key: MonthKey): Period {
    return {
      key,
      start: firstDayOfMonth(key),
      end: lastDayOfMonth(key),
      label: formatMonthKey(key),
    };
  },

  keyOf(date: PlainDate): MonthKey {
    return monthKeyOf(date);
  },

  next(key: MonthKey): MonthKey {
    return addMonthsToKey(key, 1);
  },

  previous(key: MonthKey): MonthKey {
    return addMonthsToKey(key, -1);
  },
};

/** Periodo atual segundo o resolver, a partir de uma data de referencia. */
export function currentPeriod(resolver: PeriodResolver, today: PlainDate): Period {
  return resolver.resolve(resolver.keyOf(today));
}

export function nextPeriod(resolver: PeriodResolver, period: Period): Period {
  return resolver.resolve(resolver.next(period.key));
}

export function previousPeriod(resolver: PeriodResolver, period: Period): Period {
  return resolver.resolve(resolver.previous(period.key));
}

export function isWithinPeriod(period: Period, date: PlainDate): boolean {
  return isWithin(date, period.start, period.end);
}

/** Total de dias do periodo, contando as duas pontas. */
export function periodLengthInDays(period: Period): number {
  return differenceInDays(period.start, period.end) + 1;
}

/**
 * Quantos dias do periodo ja passaram, contando o proprio dia de hoje.
 * Fica limitado a [0, duracao]: uma data de referencia fora do periodo nunca
 * produz projecao negativa nem acima do total.
 */
export function elapsedDaysInPeriod(period: Period, today: PlainDate): number {
  const total = periodLengthInDays(period);
  const elapsed = differenceInDays(period.start, today) + 1;
  return Math.min(Math.max(elapsed, 0), total);
}

/** Dias que ainda faltam para fechar o periodo, sem contar hoje. */
export function remainingDaysInPeriod(period: Period, today: PlainDate): number {
  return periodLengthInDays(period) - elapsedDaysInPeriod(period, today);
}
