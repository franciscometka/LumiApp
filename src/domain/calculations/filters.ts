import type { ID } from '../shared/id';
import type { Period } from '../shared/period';
import { isWithinPeriod } from '../shared/period';
import { comparePlainDates } from '../shared/plain-date';
import type {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../entities/transaction';
import { isDeleted } from '../entities/transaction';

/**
 * Recorte do conjunto de transacoes.
 *
 * Todas as funcoes de calculo recebem uma lista JA recortada. O recorte
 * acontece uma unica vez (em `buildSnapshot` ou na feature), e nao dentro de
 * cada metrica — isso evita percorrer a mesma lista sete vezes e, mais
 * importante, garante que todas as metricas de uma tela falem do mesmo
 * conjunto de dados.
 */
export interface TransactionFilter {
  readonly period?: Period;
  readonly type?: TransactionType;
  readonly status?: TransactionStatus;
  readonly categoryIds?: readonly ID[];
  readonly paymentMethods?: readonly PaymentMethod[];
  readonly cardId?: ID;
  readonly debtId?: ID;
  /** Busca por descricao e observacoes, sem acento e sem caixa. */
  readonly search?: string;
  /** Por padrao, transacoes excluidas ficam de fora. */
  readonly includeDeleted?: boolean;
}

/** Remove acentos e caixa para que "almoco" encontre "Almoço". */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesFilter(transaction: Transaction, filter: TransactionFilter): boolean {
  if (filter.includeDeleted !== true && isDeleted(transaction)) return false;
  if (filter.period !== undefined && !isWithinPeriod(filter.period, transaction.date)) return false;
  if (filter.type !== undefined && transaction.type !== filter.type) return false;
  if (filter.status !== undefined && transaction.status !== filter.status) return false;

  if (filter.categoryIds !== undefined && !filter.categoryIds.includes(transaction.categoryId)) {
    return false;
  }

  if (
    filter.paymentMethods !== undefined &&
    !filter.paymentMethods.includes(transaction.paymentMethod)
  ) {
    return false;
  }

  if (filter.cardId !== undefined && transaction.cardId !== filter.cardId) return false;
  if (filter.debtId !== undefined && transaction.debtId !== filter.debtId) return false;

  if (filter.search !== undefined && filter.search.trim() !== '') {
    const needle = normalizeText(filter.search);
    const haystack = normalizeText(`${transaction.description} ${transaction.notes ?? ''}`);
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filter: TransactionFilter = {},
): Transaction[] {
  return transactions.filter((transaction) => matchesFilter(transaction, filter));
}

/** Mais recentes primeiro; empates resolvidos pela data de criacao. */
export function sortByDateDesc(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => comparePlainDates(b.date, a.date) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** Mais antigas primeiro. Usado em listas de vencimento. */
export function sortByDateAsc(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort(
    (a, b) => comparePlainDates(a.date, b.date) || a.createdAt.localeCompare(b.createdAt),
  );
}
