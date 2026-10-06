import { z } from 'zod';

import { idSchema, shortTextSchema, timestampSchema } from '../shared/schemas';
import type { TransactionType } from './transaction';

/**
 * `both` existe porque algumas categorias servem aos dois lados — por exemplo
 * "Outros". Sem esse campo, o formulario de entrada ofereceria "Combustivel" e
 * o de saida ofereceria "Salario".
 */
export const CATEGORY_KINDS = ['income', 'expense', 'both'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Chave do token de cor (`--chart-1`..`--chart-5`), nunca um valor literal. */
export const CATEGORY_COLOR_TOKENS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
] as const;
export type CategoryColorToken = (typeof CATEGORY_COLOR_TOKENS)[number];

export const categorySchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: shortTextSchema,
  kind: z.enum(CATEGORY_KINDS),
  /** Nome do icone no Lucide, resolvido pela UI. */
  icon: shortTextSchema,
  colorToken: z.enum(CATEGORY_COLOR_TOKENS),
  /** Categorias do sistema nao podem ser excluidas, apenas arquivadas. */
  isSystem: z.boolean(),
  order: z.number().int().min(0),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional(),
});

export type Category = z.infer<typeof categorySchema>;

export function isArchived(category: Category): boolean {
  return category.archivedAt !== undefined;
}

/** Se a categoria pode ser usada por uma transacao daquele tipo. */
export function acceptsType(category: Category, type: TransactionType): boolean {
  return category.kind === 'both' || category.kind === type;
}

export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'),
  );
}
