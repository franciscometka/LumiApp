import type { Brand } from './brand';

/**
 * Data civil pura, sem hora e sem fuso: 'YYYY-MM-DD'.
 *
 * O objeto `Date` do JavaScript nao aparece em lugar nenhum deste modulo.
 * Toda a aritmetica e feita em inteiros (ano, mes, dia) pelo algoritmo civil
 * de Howard Hinnant, que e exato e independente de timezone.
 *
 * O bug que isto evita: `new Date('2026-10-01').toISOString().slice(0, 10)`
 * devolve '2026-09-30' em qualquer fuso a oeste de Greenwich — a transacao do
 * dia 1 cairia no mes anterior.
 */
export type PlainDate = Brand<string, 'PlainDate'>;

/** Identificador de mes civil: 'YYYY-MM'. */
export type MonthKey = Brand<string, 'MonthKey'>;

const PLAIN_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2999;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Numero de dias do mes. `month` e 1-12. Fevereiro respeita ano bissexto. */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new RangeError(`Mes invalido: ${String(month)}`);
  }
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1] as number;
}

export function isValidPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== 'string') return false;
  const match = PLAIN_DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function isValidMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string') return false;
  const match = MONTH_KEY_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= MIN_YEAR && year <= MAX_YEAR && month >= 1 && month <= 12;
}

export function toPlainDate(value: string): PlainDate {
  if (!isValidPlainDate(value)) {
    throw new RangeError(`Data invalida: ${String(value)}`);
  }
  return value;
}

export function parsePlainDate(value: string): PlainDate | null {
  return isValidPlainDate(value) ? value : null;
}

export function toMonthKey(value: string): MonthKey {
  if (!isValidMonthKey(value)) {
    throw new RangeError(`Mes invalido: ${String(value)}`);
  }
  return value;
}

export function parseMonthKey(value: string): MonthKey | null {
  return isValidMonthKey(value) ? value : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Monta uma data a partir de ano/mes/dia.
 * Dias acima do ultimo dia do mes sao recusados; use `makePlainDateClamped`
 * quando a intencao for "dia 31 em fevereiro vira o ultimo dia".
 */
export function makePlainDate(year: number, month: number, day: number): PlainDate {
  return toPlainDate(`${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`);
}

/**
 * Como `makePlainDate`, mas limita o dia ao ultimo dia do mes.
 * `makePlainDateClamped(2026, 2, 31)` => 2026-02-28.
 * E o que torna possivel "todo dia 31" em contas recorrentes.
 */
export function makePlainDateClamped(year: number, month: number, day: number): PlainDate {
  const limit = daysInMonth(year, month);
  const safeDay = Math.min(Math.max(day, 1), limit);
  return makePlainDate(year, month, safeDay);
}

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function getParts(date: PlainDate): DateParts {
  const match = PLAIN_DATE_PATTERN.exec(date);
  if (match === null) {
    throw new RangeError(`Data invalida: ${String(date)}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getYear(date: PlainDate): number {
  return getParts(date).year;
}

export function getMonth(date: PlainDate): number {
  return getParts(date).month;
}

export function getDay(date: PlainDate): number {
  return getParts(date).day;
}

/**
 * Dias desde a epoca civil (1970-01-01), em aritmetica inteira exata.
 * Algoritmo `days_from_civil` de Howard Hinnant.
 */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverso de `daysFromCivil`. */
function civilFromDays(dayCount: number): DateParts {
  const z = dayCount + 719468;
  const era = Math.floor(z / 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  return { year: year + (month <= 2 ? 1 : 0), month, day };
}

/** Numero serial do dia. Serve para diferenca e ordenacao exatas. */
export function toDayNumber(date: PlainDate): number {
  const { year, month, day } = getParts(date);
  return daysFromCivil(year, month, day);
}

export function fromDayNumber(dayNumber: number): PlainDate {
  const { year, month, day } = civilFromDays(dayNumber);
  return makePlainDate(year, month, day);
}

export function addDays(date: PlainDate, amount: number): PlainDate {
  return fromDayNumber(toDayNumber(date) + Math.trunc(amount));
}

/**
 * Soma meses preservando o dia quando possivel e limitando ao ultimo dia
 * do mes de destino. 2026-01-31 + 1 mes => 2026-02-28.
 */
export function addMonths(date: PlainDate, amount: number): PlainDate {
  const { year, month, day } = getParts(date);
  const totalMonths = year * 12 + (month - 1) + Math.trunc(amount);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12 + 1;
  return makePlainDateClamped(targetYear, targetMonth, day);
}

/** Diferenca em dias (b - a). Exata, sem horario de verao no meio. */
export function differenceInDays(a: PlainDate, b: PlainDate): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function comparePlainDates(a: PlainDate, b: PlainDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBefore(a: PlainDate, b: PlainDate): boolean {
  return a < b;
}

export function isAfter(a: PlainDate, b: PlainDate): boolean {
  return a > b;
}

export function isSameDate(a: PlainDate, b: PlainDate): boolean {
  return a === b;
}

/** Intervalo fechado nas duas pontas. */
export function isWithin(date: PlainDate, start: PlainDate, end: PlainDate): boolean {
  return date >= start && date <= end;
}

export function minDate(a: PlainDate, b: PlainDate): PlainDate {
  return a <= b ? a : b;
}

export function maxDate(a: PlainDate, b: PlainDate): PlainDate {
  return a >= b ? a : b;
}

export function monthKeyOf(date: PlainDate): MonthKey {
  return toMonthKey(date.slice(0, 7));
}

export function makeMonthKey(year: number, month: number): MonthKey {
  return toMonthKey(`${String(year).padStart(4, '0')}-${pad2(month)}`);
}

export function getMonthKeyParts(key: MonthKey): { year: number; month: number } {
  const match = MONTH_KEY_PATTERN.exec(key);
  if (match === null) {
    throw new RangeError(`Mes invalido: ${String(key)}`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function firstDayOfMonth(key: MonthKey): PlainDate {
  const { year, month } = getMonthKeyParts(key);
  return makePlainDate(year, month, 1);
}

export function lastDayOfMonth(key: MonthKey): PlainDate {
  const { year, month } = getMonthKeyParts(key);
  return makePlainDate(year, month, daysInMonth(year, month));
}

export function daysInMonthKey(key: MonthKey): number {
  const { year, month } = getMonthKeyParts(key);
  return daysInMonth(year, month);
}

export function addMonthsToKey(key: MonthKey, amount: number): MonthKey {
  const { year, month } = getMonthKeyParts(key);
  const totalMonths = year * 12 + (month - 1) + Math.trunc(amount);
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = totalMonths - targetYear * 12 + 1;
  return makeMonthKey(targetYear, targetMonth);
}

export function compareMonthKeys(a: MonthKey, b: MonthKey): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Diferenca em meses (b - a). */
export function differenceInMonths(a: MonthKey, b: MonthKey): number {
  const left = getMonthKeyParts(a);
  const right = getMonthKeyParts(b);
  return (right.year - left.year) * 12 + (right.month - left.month);
}

/**
 * Data de hoje no fuso informado (padrao: o fuso do ambiente).
 * Usa `Intl` em vez de `toISOString`, que converte para UTC e erra o dia.
 */
export function todayPlainDate(timeZone?: string): PlainDate {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timeZone === undefined ? {} : { timeZone }),
  });

  const parts = formatter.formatToParts(new Date());
  const lookup = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return toPlainDate(`${lookup('year')}-${lookup('month')}-${lookup('day')}`);
}

const dayMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  timeZone: 'UTC',
});

const monthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortMonthYearFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const monthAbbrevFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  timeZone: 'UTC',
});

/**
 * Converte para `Date` fixando meio-dia UTC. Uso exclusivo das funcoes de
 * formatacao abaixo, que leem a data em UTC — assim nenhum deslocamento de
 * fuso consegue mudar o dia exibido.
 */
function toUtcDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

/** "05/10/2026" */
export function formatPlainDate(date: PlainDate): string {
  return dayMonthFormatter.format(toUtcDate(date));
}

/** "5 de outubro" */
export function formatPlainDateLong(date: PlainDate): string {
  return longDateFormatter.format(toUtcDate(date));
}

/** "segunda-feira" */
export function formatWeekday(date: PlainDate): string {
  return weekdayFormatter.format(toUtcDate(date));
}

/** "outubro de 2026" */
export function formatMonthKey(key: MonthKey): string {
  return monthYearFormatter.format(toUtcDate(`${key}-01`));
}

/** "out. de 2026" */
export function formatMonthKeyShort(key: MonthKey): string {
  return shortMonthYearFormatter.format(toUtcDate(`${key}-01`));
}

/** "out." — eixo de grafico, onde o ano ja esta no contexto. */
export function formatMonthAbbrev(key: MonthKey): string {
  return monthAbbrevFormatter.format(toUtcDate(`${key}-01`));
}

/**
 * Cabecalho de um grupo de dia: "Hoje", "Ontem", "Amanha" ou a data completa.
 *
 * O rotulo relativo cobre os tres dias que o usuario reconhece de imediato e
 * que respondem a maior parte das consultas. Fora dessa janela, dizer
 * "ha 4 dias" obrigaria a pessoa a fazer a conta de cabeca para saber que dia
 * foi — a data e mais curta de ler.
 *
 * Recebe `today` em vez de ler o relogio: assim a funcao continua pura e o
 * teste nao depende do dia em que roda.
 */
export function formatRelativeDay(date: PlainDate, today: PlainDate): string {
  const offset = differenceInDays(today, date);
  if (offset === 0) return 'Hoje';
  if (offset === -1) return 'Ontem';
  if (offset === 1) return 'Amanhã';
  return `${formatWeekday(date)}, ${formatPlainDateLong(date)}`;
}
