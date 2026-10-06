import type { Brand } from './brand';

/**
 * Dinheiro e SEMPRE um inteiro de centavos. R$ 2.300,00 => 230000.
 *
 * Nenhum calculo central deste modulo depende de ponto flutuante:
 * - a entrada de texto (`parseMoney`) e processada digito a digito, por
 *   concatenacao de strings;
 * - soma, subtracao e comparacao sao aritmetica inteira;
 * - multiplicacao e divisao usam float apenas como passo intermediario e
 *   voltam a inteiro por arredondamento comercial explicito;
 * - `formatMoney` divide por 100 somente para entregar ao `Intl`, que arredonda
 *   em 2 casas — exato para qualquer valor dentro de MONEY_MAX_CENTS.
 */
export type Money = Brand<number, 'Money'>;

/** ~R$ 10 bilhoes. Bem abaixo de Number.MAX_SAFE_INTEGER, com folga para somas. */
export const MONEY_MAX_CENTS = 999_999_999_999;

export const ZERO_MONEY = 0 as Money;

export function isMoney(value: unknown): value is Money {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MONEY_MAX_CENTS
  );
}

/**
 * Converte centavos crus em Money. Lanca se o valor nao for representavel.
 *
 * Normaliza -0 para 0. O zero negativo surge naturalmente de `negateMoney(0)`,
 * `multiplyMoney(0, -1)` e afins, e o `Intl` o formata como "-R$ 0,00".
 * Como toda operacao deste modulo passa por aqui, a normalizacao em um unico
 * ponto elimina o problema em todas elas.
 */
export function toMoney(cents: number): Money {
  if (!isMoney(cents)) {
    throw new RangeError(`Valor monetario invalido em centavos: ${String(cents)}`);
  }
  return (cents === 0 ? 0 : cents) as Money;
}

/** Como `toMoney`, mas devolve null em vez de lancar. */
export function tryToMoney(cents: number): Money | null {
  return isMoney(cents) ? toMoney(cents) : null;
}

/**
 * Arredondamento comercial: o meio centavo sempre se afasta do zero.
 * `Math.round` nativo arredonda para +Infinito, tratando -0,5 como -0.
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Converte reais em centavos. Use apenas para dados de origem confiavel
 * (seed, constantes de teste). A entrada do usuario deve passar por
 * `parseMoney`, que nao envolve float.
 */
export function moneyFromReais(reais: number): Money {
  if (!Number.isFinite(reais)) {
    throw new RangeError(`Valor em reais invalido: ${String(reais)}`);
  }
  return toMoney(roundHalfAwayFromZero(reais * 100));
}

/** Centavos de volta para reais. Somente para exibicao ou exportacao. */
export function moneyToReais(value: Money): number {
  return value / 100;
}

/**
 * Interpreta texto em centavos sem passar por float.
 *
 * Regras (pt-BR):
 * - a virgula e sempre separador decimal;
 * - o ponto e separador de milhar quando e o unico separador e tem exatamente
 *   3 digitos a direita ("1.500" => R$ 1.500,00); caso contrario e decimal
 *   ("1.50" => R$ 1,50);
 * - havendo os dois, o ultimo a aparecer e o decimal;
 * - casas decimais extras sao arredondadas pelo 3o digito.
 *
 * Devolve null para entrada sem digitos ou acima do limite representavel.
 */
export function parseMoney(input: string): Money | null {
  if (typeof input !== 'string') return null;

  const cleaned = input.replace(/[^\d,.-]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const isNegative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');

  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');

  let decimalSeparator: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma >= 0) {
    decimalSeparator = ',';
  } else if (lastDot >= 0) {
    decimalSeparator = '.';
  }

  let integerSource = unsigned;
  let fractionSource = '';

  if (decimalSeparator !== null) {
    const index = unsigned.lastIndexOf(decimalSeparator);
    const head = unsigned.slice(0, index);
    const tail = unsigned.slice(index + 1);

    const looksLikeThousands =
      decimalSeparator === '.' && tail.length === 3 && !unsigned.includes(',');

    if (looksLikeThousands) {
      integerSource = head + tail;
    } else {
      integerSource = head;
      fractionSource = tail;
    }
  }

  const integerDigits = integerSource.replace(/\D/g, '');
  const fractionDigits = fractionSource.replace(/\D/g, '');

  // Concatenacao de strings: a magnitude nunca passa por float.
  const centsText =
    (integerDigits === '' ? '0' : integerDigits) +
    fractionDigits.slice(0, 2).padEnd(2, '0');

  let cents = Number(centsText);
  if (!Number.isSafeInteger(cents)) return null;

  if (fractionDigits.length > 2 && fractionDigits.charCodeAt(2) - 48 >= 5) {
    cents += 1;
  }

  return tryToMoney(isNegative ? -cents : cents);
}

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const decimalFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** O Intl usa espaco inquebravel apos "R$"; normalizamos para espaco comum. */
function normalizeSpaces(text: string): string {
  return text.replace(/ /g, ' ');
}

/** "R$ 2.300,00" */
export function formatMoney(value: Money): string {
  return normalizeSpaces(brlFormatter.format(moneyToReais(value)));
}

/** "2.300,00" — sem simbolo, para inputs e colunas numericas. */
export function formatMoneyPlain(value: Money): string {
  return normalizeSpaces(decimalFormatter.format(moneyToReais(value)));
}

/**
 * "+ R$ 300,00" / "- R$ 300,00".
 * O sinal fica separado do valor para a UI poder colorir de forma independente.
 */
export function formatMoneySigned(
  value: Money,
  options: { showPlusSign?: boolean; minusSign?: string } = {},
): string {
  const { showPlusSign = true, minusSign = '-' } = options;
  const absolute = formatMoney(absMoney(value));
  if (isNegativeMoney(value)) return `${minusSign} ${absolute}`;
  return showPlusSign ? `+ ${absolute}` : absolute;
}

export function addMoney(a: Money, b: Money): Money {
  return toMoney(a + b);
}

export function subtractMoney(a: Money, b: Money): Money {
  return toMoney(a - b);
}

export function sumMoney(values: Iterable<Money>): Money {
  let total = 0;
  for (const value of values) total += value;
  return toMoney(total);
}

export function negateMoney(value: Money): Money {
  return toMoney(-value);
}

export function absMoney(value: Money): Money {
  return toMoney(Math.abs(value));
}

/** Multiplica por um fator e volta a centavo inteiro (arredondamento comercial). */
export function multiplyMoney(value: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new RangeError(`Fator invalido: ${String(factor)}`);
  }
  return toMoney(roundHalfAwayFromZero(value * factor));
}

/** Divide e volta a centavo inteiro. Lanca em divisao por zero. */
export function divideMoney(value: Money, divisor: number): Money {
  if (!Number.isFinite(divisor) || divisor === 0) {
    throw new RangeError(`Divisor invalido: ${String(divisor)}`);
  }
  return toMoney(roundHalfAwayFromZero(value / divisor));
}

/**
 * Reparte um valor em N partes sem perder nem inventar centavos: a soma do
 * resultado e sempre exatamente igual ao total. O resto e distribuido um
 * centavo por vez, nas primeiras partes.
 */
export function allocateMoney(total: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`Numero de partes invalido: ${String(parts)}`);
  }

  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);
  const base = Math.floor(magnitude / parts);
  let remainder = magnitude - base * parts;

  const result: Money[] = [];
  for (let index = 0; index < parts; index += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    result.push(toMoney(sign * (base + extra)));
  }
  return result;
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isZeroMoney(value: Money): boolean {
  return value === 0;
}

export function isPositiveMoney(value: Money): boolean {
  return value > 0;
}

export function isNegativeMoney(value: Money): boolean {
  return value < 0;
}

export function maxMoney(a: Money, b: Money): Money {
  return a >= b ? a : b;
}

export function minMoney(a: Money, b: Money): Money {
  return a <= b ? a : b;
}

/** Nunca deixa o valor abaixo de zero. Util em "quanto ainda posso gastar". */
export function clampMoneyToZero(value: Money): Money {
  return value < 0 ? ZERO_MONEY : value;
}
