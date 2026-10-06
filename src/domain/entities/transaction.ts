import { z } from 'zod';

import type { Money } from '../shared/money';
import { negateMoney } from '../shared/money';
import {
  idSchema,
  longTextSchema,
  plainDateSchema,
  positiveMoneySchema,
  shortTextSchema,
  timestampSchema,
} from '../shared/schemas';

export const TRANSACTION_TYPES = ['income', 'expense'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ['paid', 'pending'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const PAYMENT_METHODS = [
  'pix',
  'debit',
  'credit',
  'cash',
  'transfer',
  'boleto',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  debit: 'Debito',
  credit: 'Credito',
  cash: 'Dinheiro',
  transfer: 'Transferencia',
  boleto: 'Boleto',
  other: 'Outro',
};

/**
 * O valor e SEMPRE positivo; o sinal vem de `type`.
 * Guardar o sinal dentro do valor cria uma classe inteira de bugs em somas,
 * filtros e graficos — a mesma despesa poderia ser somada com sinais
 * diferentes dependendo de quem a leu.
 */
export const transactionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  description: shortTextSchema,
  amountCents: positiveMoneySchema,
  type: z.enum(TRANSACTION_TYPES),
  categoryId: idSchema,
  date: plainDateSchema,
  status: z.enum(TRANSACTION_STATUSES),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Vinculo de origem: fatura de cartao. */
  cardId: idSchema.optional(),
  /** Vinculo de origem: parcela de divida ou emprestimo. */
  debtId: idSchema.optional(),
  /** Vinculo de origem: conta recorrente que materializou esta transacao. */
  recurringBillId: idSchema.optional(),
  notes: longTextSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Exclusao logica. Preserva a sincronizacao futura com o Supabase. */
  deletedAt: timestampSchema.optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/** Valor com sinal: positivo para entrada, negativo para saida. */
export function signedAmount(transaction: Transaction): Money {
  return transaction.type === 'income'
    ? transaction.amountCents
    : negateMoney(transaction.amountCents);
}

export function isIncome(transaction: Transaction): boolean {
  return transaction.type === 'income';
}

export function isExpense(transaction: Transaction): boolean {
  return transaction.type === 'expense';
}

export function isPaid(transaction: Transaction): boolean {
  return transaction.status === 'paid';
}

export function isPending(transaction: Transaction): boolean {
  return transaction.status === 'pending';
}

export function isDeleted(transaction: Transaction): boolean {
  return transaction.deletedAt !== undefined;
}

/**
 * Compromisso com cartao: ou a transacao esta vinculada a um cartao, ou foi
 * paga no credito. Cobre o lancamento avulso no credito antes de existir
 * cadastro de cartao.
 */
export function isCardCommitment(transaction: Transaction): boolean {
  return transaction.cardId !== undefined || transaction.paymentMethod === 'credit';
}

export function isDebtCommitment(transaction: Transaction): boolean {
  return transaction.debtId !== undefined;
}
