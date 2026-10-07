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

/**
 * Natureza do fluxo: o dinheiro foi gerado/consumido, ou apenas mudou de lugar?
 *
 * - `operational`: dinheiro que entrou ou saiu do patrimonio neste periodo —
 *   salario, renda extra, bonus, uma compra, uma conta.
 * - `transfer`: dinheiro que ja era seu e apenas trocou de lugar — usar a
 *   reserva, mover entre contas, guardar uma sobra.
 *
 * Sem esta distincao, usar R$ 100 da reserva aumentaria a "renda do mes" em
 * R$ 100, e qualquer metrica construida sobre renda (taxa de poupanca,
 * percentual de renda comprometido, comparacao entre meses) herdaria o erro.
 *
 * O campo tem padrao `operational` no schema: dados antigos, gravados antes
 * desta distincao existir, continuam validos e sao lidos como operacionais —
 * nao e preciso migracao.
 */
export const FLOW_NATURES = ['operational', 'transfer'] as const;
export type FlowNature = (typeof FLOW_NATURES)[number];

export const FLOW_NATURE_LABELS: Record<FlowNature, string> = {
  operational: 'Movimento do mes',
  transfer: 'Transferencia',
};

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
  /** Ver `FLOW_NATURES`. Ausente nos dados = `operational`. */
  flow: z.enum(FLOW_NATURES).default('operational'),
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

/** Dinheiro que apenas mudou de lugar; nao gera nem consome patrimonio. */
export function isTransfer(transaction: Transaction): boolean {
  return transaction.flow === 'transfer';
}

/** Dinheiro efetivamente gerado ou consumido no periodo. */
export function isOperational(transaction: Transaction): boolean {
  return transaction.flow === 'operational';
}

/**
 * Como um gasto se liga a um cartao.
 *
 * `paymentMethod === 'credit'` sem `cardId` continua valendo como compromisso
 * de cartao, e isso e uma REGRA DE TRANSICAO, nao um descuido: existem
 * lancamentos gravados antes de haver cadastro de cartoes, e remover esse
 * caminho faria o percentual de comprometimento desses meses cair sozinho —
 * um numero que estava certo passaria a estar errado por causa de uma
 * mudanca de codigo.
 *
 * A presenca de `cardId` PREVALECE: um lancamento identificado nunca e
 * contado tambem como nao identificado. Os dois caminhos sao exclusivos.
 */
export type CardLink = 'identified' | 'unidentified' | null;

export function cardLink(transaction: Transaction): CardLink {
  if (transaction.cardId !== undefined) return 'identified';
  if (transaction.paymentMethod === 'credit') return 'unidentified';
  return null;
}

/** Compromisso com cartao, identificado ou nao. */
export function isCardCommitment(transaction: Transaction): boolean {
  return cardLink(transaction) !== null;
}

export function isDebtCommitment(transaction: Transaction): boolean {
  return transaction.debtId !== undefined;
}

/**
 * O estado interno e um so (`paid` | `pending`), mas a palavra muda com o
 * lado do fluxo: um salario nao e "pago" pelo usuario, e recebido por ele.
 *
 * A traducao fica aqui, junto da entidade, e nao espalhada pelos componentes —
 * caso contrario cada tela inventaria o proprio vocabulario.
 */
export function statusLabel(type: TransactionType, status: TransactionStatus): string {
  if (status === 'pending') return 'Pendente';
  return type === 'income' ? 'Recebido' : 'Pago';
}

/** Rotulo da acao que LEVA ao estado pago/recebido. */
export function markAsPaidLabel(type: TransactionType): string {
  return type === 'income' ? 'Marcar como recebido' : 'Marcar como pago';
}

/** O estado oposto, para alternar com um toque. */
export function toggledStatus(status: TransactionStatus): TransactionStatus {
  return status === 'paid' ? 'pending' : 'paid';
}
