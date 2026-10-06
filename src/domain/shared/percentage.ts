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

/**
 * Percentuais de APRESENTACAO de um conjunto, somando exatamente 100.
 *
 * Arredondar cada fatia por conta propria produz totais errados: as quatro
 * fatias do briefing (44 + 35 + 17 + 5) somam 101%, e uma legenda que soma 101
 * faz a pessoa duvidar da conta toda, nao do arredondamento.
 *
 * O metodo e o do **maior resto**: cada fatia fica com a parte inteira do seu
 * percentual e a sobra vai para quem tem o maior resto descartado. Assim o
 * ajuste de 1 ponto cai sobre quem mais perdeu no arredondamento, em vez de
 * sobre a primeira ou a ultima fatia.
 *
 * Isto e exibicao, nada mais. Os percentuais internos (`safePercentage`) e os
 * valores em reais continuam exatos e nenhum calculo financeiro usa a saida
 * desta funcao.
 *
 * `null` quando nao existe percentual a distribuir: lista vazia, total zero ou
 * qualquer valor negativo — nenhum desses casos tem fatia definida, e devolver
 * zeros seria fabricar um dado.
 */
export function displayPercentages(
  values: readonly number[],
  decimals = 0,
): readonly number[] | null {
  if (values.length === 0) return null;
  if (values.some((value) => value < 0 || !Number.isFinite(value))) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;

  const scale = 10 ** decimals;
  const target = 100 * scale;

  const slices = values.map((value, index) => {
    const exact = (value / total) * target;
    const floor = Math.floor(exact);
    return { index, floor, remainder: exact - floor };
  });
  const assigned = slices.reduce((sum, slice) => sum + slice.floor, 0);

  // Em aritmetica exata a sobra cabe em [0, n); o clamp cobre o residuo de
  // ponto flutuante, que aqui e inofensivo porque nada disso e dinheiro.
  const leftover = Math.min(Math.max(Math.round(target - assigned), 0), values.length);

  // Maior resto primeiro; empate resolvido pelo indice, para que a mesma
  // entrada produza sempre a mesma saida.
  const bonusIndexes = new Set(
    [...slices]
      .sort((a, b) => (b.remainder !== a.remainder ? b.remainder - a.remainder : a.index - b.index))
      .slice(0, leftover)
      .map((slice) => slice.index),
  );

  return slices.map(
    (slice) => (slice.floor + (bonusIndexes.has(slice.index) ? 1 : 0)) / scale,
  );
}
