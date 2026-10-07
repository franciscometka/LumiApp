import type { Card } from '../entities/card';
import { availableLimit, isOverLimit, limitUsagePercentage, nextClosingDate, nextDueDate } from '../entities/card';
import type { Transaction } from '../entities/transaction';
import type { Money } from '../shared/money';
import { sumMoney } from '../shared/money';
import type { PlainDate } from '../shared/plain-date';
import { comparePlainDates } from '../shared/plain-date';

/**
 * ============================================================================
 * REGRA CENTRAL: a fatura informada e as transacoes do cartao NUNCA se somam.
 * ============================================================================
 *
 * `card.currentInvoiceCents` e **o numero que o usuario leu no app do banco**
 * e digitou aqui. As transacoes com `cardId` sao os gastos que ele registrou e
 * atribuiu aquele cartao. As duas coisas medem A MESMA DIVIDA por caminhos
 * diferentes — uma pelo extrato do banco, outra pelo registro do usuario.
 *
 * Soma-las e contar o mesmo dinheiro duas vezes. Com a fatura em R$ 1.139 e
 * transacoes vinculadas somando R$ 1.139, um total ingenuo anunciaria
 * R$ 2.278 de gasto com cartao — um erro que dobra a percepcao de divida da
 * pessoa e nao tem nenhum sintoma visivel alem do numero errado.
 *
 * Por isso a divisao de papeis e rigida nesta v1:
 *
 * - **Tela Cartoes** le `currentInvoiceCents`. E a fonte de verdade ali, e so
 *   ali. Mostra fatura, limite, disponivel, vencimento, fechamento e quando o
 *   valor foi atualizado pela ultima vez.
 *
 * - **Dashboard e qualquer total financeiro** continuam saindo exclusivamente
 *   das TRANSACOES, pelo modelo que ja existia antes de haver cartoes.
 *   Nenhuma metrica do Dashboard le `currentInvoiceCents`.
 *
 * - **Transacoes com `cardId`** servem para rastreio, classificacao, historico
 *   e para responder "quais gastos sao deste cartao" — nunca para gerar nem
 *   aumentar a fatura.
 *
 * Este modulo nao exporta nenhuma funcao que combine as duas grandezas, e nao
 * deve passar a exportar. Fatura derivada por ciclo e um caminho possivel no
 * futuro, mas e OUTRO modelo: quando existir, substitui o valor informado em
 * vez de somar-se a ele.
 */

/** Tudo que a tela de um cartao precisa, derivado uma vez. */
export interface CardOverview {
  readonly card: Card;
  /** Valor INFORMADO. Exclusivo da tela Cartoes. */
  readonly invoiceCents: Money;
  readonly limitCents: Money;
  readonly availableCents: Money;
  /** `null` quando nao ha limite cadastrado — nao e 0%. */
  readonly usagePercentage: number | null;
  readonly isOverLimit: boolean;
  readonly nextDue: PlainDate;
  readonly nextClosing: PlainDate;
}

export function buildCardOverview(card: Card, reference: PlainDate): CardOverview {
  return {
    card,
    invoiceCents: card.currentInvoiceCents,
    limitCents: card.limitCents,
    availableCents: availableLimit(card),
    usagePercentage: limitUsagePercentage(card),
    isOverLimit: isOverLimit(card),
    nextDue: nextDueDate(card, reference),
    nextClosing: nextClosingDate(card, reference),
  };
}

/**
 * Ordena pelo proximo vencimento: o que vence antes aparece antes.
 *
 * Empate resolvido pelo nome, para que a lista nao troque de ordem sozinha
 * entre dois renders quando dois cartoes vencem no mesmo dia.
 */
export function sortCardsByDueDate(cards: readonly Card[], reference: PlainDate): Card[] {
  return [...cards].sort((a, b) => {
    const byDue = comparePlainDates(nextDueDate(a, reference), nextDueDate(b, reference));
    return byDue !== 0 ? byDue : a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Gastos registrados que o usuario atribuiu a este cartao, no conjunto dado.
 *
 * Serve para responder "o que eu comprei neste cartao" — rastreio e historico.
 * O resultado NAO e a fatura e nao deve ser apresentado como tal: a fatura
 * inclui compras que o usuario pode nao ter lancado, e o lancamento pode
 * incluir coisas que ainda nao entraram na fatura.
 */
export function transactionsOfCard(
  transactions: readonly Transaction[],
  cardId: Card['id'],
): Transaction[] {
  return transactions.filter((transaction) => transaction.cardId === cardId);
}

/**
 * Soma dos gastos REGISTRADOS deste cartao no conjunto dado.
 *
 * O nome evita a palavra "fatura" de proposito. Quem ler `trackedExpenseCents`
 * nao vai confundi-lo com `invoiceCents`, e qualquer tentativa de somar os
 * dois fica visivel na hora de escrever a linha.
 */
export function trackedExpenseCents(
  transactions: readonly Transaction[],
  cardId: Card['id'],
): Money {
  return sumMoney(
    transactionsOfCard(transactions, cardId)
      .filter((transaction) => transaction.type === 'expense')
      .map((transaction) => transaction.amountCents),
  );
}
