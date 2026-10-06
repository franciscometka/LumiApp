import type { Money } from './money';

/**
 * Percentuais sao razoes para leitura humana, nao dinheiro: aqui o ponto
 * flutuante e adequado e nenhum centavo depende deste modulo.
 *
 * A convencao e deliberada: divisao por zero devolve `null`, nunca 0.
 * "0% da renda utilizada" seria mentira quando nao existe renda registrada —
 * a UI precisa saber a diferenca e exibir "—".
 */

/** Quanto `part` representa de `whole`, em %. `null` se `whole` for zero. */
export function safePercentage(part: Money, whole: Money): number | null {
  if (whole === 0) return null;
  return (part / whole) * 100;
}

/**
 * Variacao percentual de `previous` para `current`. `null` se nao houver base
 * de comparacao (periodo anterior zerado) — crescer a partir do zero nao tem
 * percentual definido.
 *
 * A base usa o valor absoluto para que a direcao continue correta quando o
 * ponto de partida e negativo (saldo no vermelho, por exemplo).
 */
export function changePercentage(current: Money, previous: Money): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Arredonda para exibicao. Nao use o resultado em nenhum calculo. */
export function roundPercentage(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Limita a faixa 0-100, para barras de progresso que nao devem estourar. */
export function clampPercentage(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

/** "84%" / "13,5%" / "—" quando nao ha percentual definido. */
export function formatPercentage(
  value: number | null,
  options: { decimals?: number; showSign?: boolean; fallback?: string } = {},
): string {
  const { decimals = 0, showSign = false, fallback = '—' } = options;
  if (value === null || !Number.isFinite(value)) return fallback;

  const rounded = roundPercentage(value, decimals);
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(rounded));

  if (showSign) {
    const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
    return `${sign}${formatted}%`;
  }
  return `${rounded < 0 ? '-' : ''}${formatted}%`;
}
