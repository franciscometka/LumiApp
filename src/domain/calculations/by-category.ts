import type { ID } from '../shared/id';
import type { Money } from '../shared/money';
import { ZERO_MONEY, sumMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { Transaction, TransactionType } from '../entities/transaction';

export interface CategoryBreakdownItem {
  readonly categoryId: ID;
  readonly totalCents: Money;
  /** Participacao no total do recorte. `null` quando o total e zero. */
  readonly percentage: number | null;
  readonly transactionCount: number;
  /**
   * Categorias que foram somadas dentro desta fatia.
   * Preenchido apenas na fatia agregada de `groupSmallCategories`, para que a
   * UI consiga dizer o que esta dentro de "Outros" em vez de esconder.
   */
  readonly groupedCategoryIds?: readonly ID[];
}

export interface CategoryBreakdown {
  readonly items: readonly CategoryBreakdownItem[];
  readonly totalCents: Money;
  /** Maior categoria do periodo. `null` quando nao ha nada no recorte. */
  readonly largest: CategoryBreakdownItem | null;
}

export const EMPTY_BREAKDOWN: CategoryBreakdown = {
  items: [],
  totalCents: ZERO_MONEY,
  largest: null,
};

/**
 * Distribuicao por categoria, da maior para a menor.
 *
 * Por padrao considera apenas saidas: "onde estou gastando mais" e a pergunta
 * que esta distribuicao responde, e misturar entradas na mesma pizza tornaria
 * o grafico ilegivel.
 */
export function calculateCategoryBreakdown(
  transactions: readonly Transaction[],
  options: { type?: TransactionType } = {},
): CategoryBreakdown {
  const { type = 'expense' } = options;

  const buckets = new Map<ID, { values: Money[]; count: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const bucket = buckets.get(transaction.categoryId) ?? { values: [], count: 0 };
    bucket.values.push(transaction.amountCents);
    bucket.count += 1;
    buckets.set(transaction.categoryId, bucket);
  }

  const totalCents = sumMoney(
    [...buckets.values()].flatMap((bucket) => bucket.values),
  );

  const items = [...buckets.entries()]
    .map(([categoryId, bucket]) => {
      const categoryTotal = sumMoney(bucket.values);
      return {
        categoryId,
        totalCents: categoryTotal,
        percentage: safePercentage(categoryTotal, totalCents),
        transactionCount: bucket.count,
      } satisfies CategoryBreakdownItem;
    })
    .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId));

  return {
    items,
    totalCents,
    largest: items[0] ?? null,
  };
}

/**
 * Identificador reservado para a fatia agregada de `groupSmallCategories`.
 * Nao colide com UUID nenhum.
 */
export const OTHER_CATEGORIES_ID = '__outros__';

/**
 * Reduz a distribuicao a no maximo `maxSlices` fatias, agregando a cauda em
 * "Outros".
 *
 * Vive no dominio de proposito: se a UI fizesse esse recorte, ela estaria
 * somando dinheiro — exatamente o que a arquitetura proibe.
 */
export function groupSmallCategories(
  breakdown: CategoryBreakdown,
  maxSlices = 5,
): CategoryBreakdown {
  if (maxSlices < 1) {
    throw new RangeError(`Numero de fatias invalido: ${String(maxSlices)}`);
  }
  if (breakdown.items.length <= maxSlices) return breakdown;

  const head = breakdown.items.slice(0, maxSlices - 1);
  const tail = breakdown.items.slice(maxSlices - 1);

  const tailTotal = sumMoney(tail.map((item) => item.totalCents));
  const tailCount = tail.reduce((count, item) => count + item.transactionCount, 0);

  const aggregated: CategoryBreakdownItem = {
    categoryId: OTHER_CATEGORIES_ID,
    totalCents: tailTotal,
    percentage: safePercentage(tailTotal, breakdown.totalCents),
    transactionCount: tailCount,
    groupedCategoryIds: tail.map((item) => item.categoryId),
  };

  return {
    items: [...head, aggregated],
    totalCents: breakdown.totalCents,
    largest: breakdown.largest,
  };
}

export function findCategoryShare(
  breakdown: CategoryBreakdown,
  categoryId: ID,
): CategoryBreakdownItem | null {
  return breakdown.items.find((item) => item.categoryId === categoryId) ?? null;
}
