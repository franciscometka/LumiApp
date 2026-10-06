import type { Money } from '../shared/money';
import { ZERO_MONEY, sumMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { Transaction } from '../entities/transaction';
import { isCardCommitment, isDebtCommitment } from '../entities/transaction';

/**
 * Quanto dos gastos esta preso em cartao e divida.
 *
 * As duas categorias sao mutuamente exclusivas e a divida tem precedencia:
 * uma parcela de emprestimo debitada no cartao conta uma vez so, como divida.
 * Sem essa regra, "comprometido" poderia passar de 100% dos gastos.
 */
export interface CommitmentBreakdown {
  readonly cardCents: Money;
  readonly debtCents: Money;
  readonly committedCents: Money;
  readonly freeCents: Money;

  readonly cardPercentage: number | null;
  readonly debtPercentage: number | null;
  readonly committedPercentage: number | null;

  readonly totalExpenseCents: Money;
}

export const EMPTY_COMMITMENTS: CommitmentBreakdown = {
  cardCents: ZERO_MONEY,
  debtCents: ZERO_MONEY,
  committedCents: ZERO_MONEY,
  freeCents: ZERO_MONEY,
  cardPercentage: null,
  debtPercentage: null,
  committedPercentage: null,
  totalExpenseCents: ZERO_MONEY,
};

export function calculateCommitments(
  transactions: readonly Transaction[],
): CommitmentBreakdown {
  const cardValues: Money[] = [];
  const debtValues: Money[] = [];
  const freeValues: Money[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;

    if (isDebtCommitment(transaction)) {
      debtValues.push(transaction.amountCents);
    } else if (isCardCommitment(transaction)) {
      cardValues.push(transaction.amountCents);
    } else {
      freeValues.push(transaction.amountCents);
    }
  }

  const cardCents = sumMoney(cardValues);
  const debtCents = sumMoney(debtValues);
  const freeCents = sumMoney(freeValues);
  const committedCents = sumMoney([cardCents, debtCents]);
  const totalExpenseCents = sumMoney([committedCents, freeCents]);

  return {
    cardCents,
    debtCents,
    committedCents,
    freeCents,
    cardPercentage: safePercentage(cardCents, totalExpenseCents),
    debtPercentage: safePercentage(debtCents, totalExpenseCents),
    committedPercentage: safePercentage(committedCents, totalExpenseCents),
    totalExpenseCents,
  };
}
