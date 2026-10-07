import type { Money } from '../shared/money';
import { ZERO_MONEY, sumMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { Transaction } from '../entities/transaction';
import { cardLink, isDebtCommitment } from '../entities/transaction';

/**
 * Quanto dos gastos esta preso em cartao e divida.
 *
 * Todo gasto recebe EXATAMENTE UM rotulo. A dupla contagem nao e evitada por
 * cuidado de quem escreve a soma — e impossivel por construcao, porque
 * `classifyExpense` devolve um unico valor e cada soma parte dele.
 *
 * A precedencia e: divida > cartao identificado > cartao nao identificado >
 * livre. Uma parcela de emprestimo debitada no cartao conta uma vez so, como
 * divida; sem isso, "comprometido" poderia passar de 100% dos gastos.
 */

/** O unico rotulo de um gasto. Exclusivo por definicao. */
export type ExpenseCommitmentKind =
  | 'debt'
  /** Vinculado a um cartao cadastrado. */
  | 'card-identified'
  /** Pago no credito, sem cartao cadastrado. Ver a regra de transicao. */
  | 'card-unidentified'
  | 'free';

export function classifyExpense(transaction: Transaction): ExpenseCommitmentKind {
  // A divida vem primeiro: uma parcela debitada no cartao e divida, nao cartao.
  if (isDebtCommitment(transaction)) return 'debt';

  const link = cardLink(transaction);
  if (link === 'identified') return 'card-identified';
  if (link === 'unidentified') return 'card-unidentified';

  return 'free';
}
export interface CommitmentBreakdown {
  /** Cartao, identificado + nao identificado. */
  readonly cardCents: Money;
  /** A parte vinculada a um cartao cadastrado. */
  readonly cardIdentifiedCents: Money;
  /** Credito sem cartao cadastrado. Tende a zero conforme o cadastro avanca. */
  readonly cardUnidentifiedCents: Money;
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
  cardIdentifiedCents: ZERO_MONEY,
  cardUnidentifiedCents: ZERO_MONEY,
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
  const identifiedValues: Money[] = [];
  const unidentifiedValues: Money[] = [];
  const debtValues: Money[] = [];
  const freeValues: Money[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;

    // Um `switch` exaustivo sobre um rotulo unico: nao existe caminho em que
    // o mesmo valor caia em duas listas.
    switch (classifyExpense(transaction)) {
      case 'debt':
        debtValues.push(transaction.amountCents);
        break;
      case 'card-identified':
        identifiedValues.push(transaction.amountCents);
        break;
      case 'card-unidentified':
        unidentifiedValues.push(transaction.amountCents);
        break;
      case 'free':
        freeValues.push(transaction.amountCents);
        break;
    }
  }

  const cardIdentifiedCents = sumMoney(identifiedValues);
  const cardUnidentifiedCents = sumMoney(unidentifiedValues);
  const cardCents = sumMoney([cardIdentifiedCents, cardUnidentifiedCents]);
  const debtCents = sumMoney(debtValues);
  const freeCents = sumMoney(freeValues);
  const committedCents = sumMoney([cardCents, debtCents]);
  const totalExpenseCents = sumMoney([committedCents, freeCents]);

  return {
    cardCents,
    cardIdentifiedCents,
    cardUnidentifiedCents,
    debtCents,
    committedCents,
    freeCents,
    cardPercentage: safePercentage(cardCents, totalExpenseCents),
    debtPercentage: safePercentage(debtCents, totalExpenseCents),
    committedPercentage: safePercentage(committedCents, totalExpenseCents),
    totalExpenseCents,
  };
}
