import type { Transaction, TransactionStatus, TransactionType } from '@/domain/entities/transaction';
import { matchesFilter } from '@/domain/calculations/filters';
import type { ID } from '@/domain/shared/id';
import { isId } from '@/domain/shared/id';

/**
 * Filtros da tela. Tres controles e uma busca — nao dez.
 *
 * O mes NAO esta aqui: ele continua vindo do `MonthSwitcher` global, pela URL,
 * e e o unico recorte obrigatoriamente navegavel. Estes filtros tambem vivem
 * na URL, para que um link reproduza a tela inteira, mas ficam FORA da chave
 * de cache (ver `query-keys.ts`): sao recortes de uma lista ja carregada.
 */
export const ALL = 'all';

export interface ListFilters {
  readonly type: TransactionType | typeof ALL;
  readonly status: TransactionStatus | typeof ALL;
  readonly categoryId: ID | typeof ALL;
  readonly search: string;
}

export const EMPTY_FILTERS: ListFilters = {
  type: ALL,
  status: ALL,
  categoryId: ALL,
  search: '',
};

export function hasActiveFilters(filters: ListFilters): boolean {
  return (
    filters.type !== ALL ||
    filters.status !== ALL ||
    filters.categoryId !== ALL ||
    filters.search.trim() !== ''
  );
}

/** Remove acento e caixa, igual a busca do dominio, para que os dois casem. */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Aplica o recorte.
 *
 * Tipo, status e categoria delegam ao `matchesFilter` do dominio — a mesma
 * funcao que o adapter usa, entao nao existem duas definicoes de "e um gasto".
 *
 * A busca e o unico ponto que a feature estende: o dominio procura em
 * descricao e observacoes, e aqui somamos o NOME DA CATEGORIA, que o dominio
 * nao tem como conhecer (ele guarda apenas o id). Procurar por "mercado" e
 * esperar encontrar os lancamentos daquela categoria e comportamento
 * esperado, nao um extra.
 */
export function applyListFilters(
  transactions: readonly Transaction[],
  filters: ListFilters,
  categoryName: (id: ID) => string | null,
): Transaction[] {
  const needle = normalizeText(filters.search);

  return transactions.filter((transaction) => {
    const matchesStructured = matchesFilter(transaction, {
      ...(filters.type === ALL ? {} : { type: filters.type }),
      ...(filters.status === ALL ? {} : { status: filters.status }),
      ...(filters.categoryId === ALL ? {} : { categoryIds: [filters.categoryId] }),
    });
    if (!matchesStructured) return false;
    if (needle === '') return true;

    const haystack = normalizeText(
      `${transaction.description} ${transaction.notes ?? ''} ${
        categoryName(transaction.categoryId) ?? ''
      }`,
    );
    return haystack.includes(needle);
  });
}

/* ------------------------------------------------------------------ *
 * URL
 * ------------------------------------------------------------------ */

export const FILTER_PARAMS = {
  type: 'tipo',
  status: 'situacao',
  category: 'categoria',
  search: 'busca',
} as const;

function readEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | typeof ALL {
  if (raw === null) return ALL;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : ALL;
}

/** Parametro invalido cai no padrao, nunca em tela de erro. */
export function filtersFromParams(params: URLSearchParams): ListFilters {
  const category = params.get(FILTER_PARAMS.category);

  return {
    type: readEnum(params.get(FILTER_PARAMS.type), ['income', 'expense'] as const),
    status: readEnum(params.get(FILTER_PARAMS.status), ['paid', 'pending'] as const),
    categoryId: category !== null && isId(category) ? category : ALL,
    search: params.get(FILTER_PARAMS.search) ?? '',
  };
}

/**
 * Escreve os filtros na query, preservando o que nao e nosso — `month`, acima
 * de tudo, que precisa sobreviver a qualquer mudanca de filtro.
 */
export function buildFilterQuery(current: URLSearchParams, filters: ListFilters): string {
  const next = new URLSearchParams(current.toString());

  const write = (key: string, value: string) => {
    if (value === '' || value === ALL) next.delete(key);
    else next.set(key, value);
  };

  write(FILTER_PARAMS.type, filters.type);
  write(FILTER_PARAMS.status, filters.status);
  write(FILTER_PARAMS.category, filters.categoryId);
  write(FILTER_PARAMS.search, filters.search.trim());

  return next.toString();
}
