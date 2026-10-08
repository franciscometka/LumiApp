import { earnedIncomeUsagePercentage } from '../calculations/totals';
import { formatMoney } from '../shared/money';
import { formatPercentage, roundPercentage } from '../shared/percentage';

import type { InsightRule } from './types';

/**
 * Regras determinísticas. Nenhuma IA, nenhuma heuristica obscura — cada frase
 * sai de um numero que o usuario consegue conferir na propria tela.
 *
 * Toda regra comeca checando a base. Se a metrica e `null`, se o periodo esta
 * vazio ou se a variacao e pequena demais para significar algo, a regra
 * devolve `null` e simplesmente nao fala.
 */

/** Abaixo disso, uma variacao entre meses e ruido, nao noticia. */
const RELEVANT_CHANGE_PERCENT = 5;

/** Abaixo disso, a fatia dos cartoes nao merece o espaco da tela inicial. */
const RELEVANT_CARD_SHARE_PERCENT = 25;

const negativeBalance: InsightRule = {
  id: 'negative-balance',
  evaluate({ snapshot }) {
    const { totals } = snapshot;
    if (totals.transactionCount === 0 || totals.balance >= 0) return null;

    return {
      id: 'negative-balance',
      text: `Os gastos passaram as entradas em ${formatMoney(
        Math.abs(totals.balance) as typeof totals.balance,
      )} neste mês.`,
      tone: 'attention',
      priority: 100,
    };
  },
};

/**
 * Usa a RENDA GERADA, nao o caixa disponivel.
 *
 * Se R$ 100 vieram da reserva, dizer "voce usou 84% da sua renda" seria falso:
 * a renda foi menor do que o caixa. `earnedIncomeUsagePercentage` ignora
 * transferencias nos dois lados e devolve `null` quando nao houve renda — caso
 * em que esta regra se cala.
 */
const incomeUsage: InsightRule = {
  id: 'income-usage',
  evaluate({ snapshot }) {
    const percentage = earnedIncomeUsagePercentage(snapshot.totals);
    if (percentage === null) return null;

    const rounded = roundPercentage(percentage, 0);
    if (rounded < 50) return null;

    return {
      id: 'income-usage',
      text:
        rounded > 100
          ? `Você já comprometeu ${formatPercentage(percentage)} da renda deste mês.`
          : `Você já comprometeu ${formatPercentage(percentage)} da sua renda deste mês.`,
      tone: rounded >= 90 ? 'attention' : 'neutral',
      priority: rounded >= 90 ? 90 : 55,
    };
  },
};

/** Honestidade sobre a origem do dinheiro, pedida explicitamente no briefing. */
const reserveDependency: InsightRule = {
  id: 'reserve-dependency',
  evaluate({ snapshot }) {
    const { totals } = snapshot;
    if (totals.transferIn <= 0) return null;

    return {
      id: 'reserve-dependency',
      text: `${formatMoney(totals.transferIn)} do que entrou veio da sua reserva, não de renda do mês.`,
      tone: 'neutral',
      priority: 70,
    };
  },
};

const largestExpenseCategory: InsightRule = {
  id: 'largest-category',
  evaluate({ snapshot, categoryName }) {
    const largest = snapshot.expenseByCategory.largest;
    if (largest === null || largest.percentage === null) return null;

    const name = categoryName(largest.categoryId);
    if (name === null) return null;

    // Com uma categoria so, dizer "e seu maior gasto" nao informa nada.
    if (snapshot.expenseByCategory.items.length < 2) return null;

    return {
      id: 'largest-category',
      text: `${name} é seu maior gasto do mês: ${formatMoney(largest.totalCents)}.`,
      tone: 'neutral',
      priority: 50,
    };
  },
};

const cardShare: InsightRule = {
  id: 'card-share',
  evaluate({ snapshot }) {
    const { cardPercentage, cardCents } = snapshot.commitments;
    if (cardPercentage === null || cardCents <= 0) return null;
    if (roundPercentage(cardPercentage, 0) < RELEVANT_CARD_SHARE_PERCENT) return null;

    return {
      id: 'card-share',
      text: `Seus cartões representam ${formatPercentage(cardPercentage)} dos gastos do mês.`,
      tone: 'neutral',
      priority: 60,
    };
  },
};

const expenseComparison: InsightRule = {
  id: 'expense-comparison',
  evaluate({ snapshot }) {
    // Gastos OPERACIONAIS: guardar na reserva nao e "gastar a mais".
    const { operationalExpense: expense, hasPreviousData } = snapshot.comparison;
    // Sem mes anterior nao ha comparacao; "+100%" a partir do zero e invencao.
    if (!hasPreviousData || expense.changePercentage === null) return null;

    const change = roundPercentage(expense.changePercentage, 1);
    if (Math.abs(change) < RELEVANT_CHANGE_PERCENT) return null;

    const direction = change > 0 ? 'a mais' : 'a menos';
    return {
      id: 'expense-comparison',
      text: `Você gastou ${formatPercentage(Math.abs(change), { decimals: 1 })} ${direction} que no mês passado.`,
      tone: change > 0 ? 'attention' : 'positive',
      priority: 65,
    };
  },
};

/**
 * Projecao so existe no mes corrente.
 *
 * Em um mes encerrado, "voce terminara o mes com..." e absurdo — ja terminou.
 * Em um mes futuro nao ha ritmo medido para extrapolar.
 */
/**
 * Limite do planejamento comprometido.
 *
 * Duas frases, nao uma. Entre 90% e 100% a informacao util e o percentual —
 * "esta chegando perto". Acima de 100% o percentual deixa de ajudar: saber que
 * passou e menos acionavel do que saber QUANTO passou, em reais.
 *
 * So existe quando ha plano com limite declarado, e usa o gasto COMPROMETIDO
 * (pago + pendente), que e o mesmo numero da tela de Planejamento — duas
 * telas discordando sobre o limite seria pior do que uma so falar dele.
 */
const planLimit: InsightRule = {
  id: 'plan-limit',
  evaluate({ snapshot }) {
    const { plan } = snapshot;
    if (!plan.hasPlan || plan.spendingLimitCents === 0) return null;
    if (plan.spendingPercentage === null) return null;

    const rounded = roundPercentage(plan.spendingPercentage, 0);
    if (rounded < 90) return null;

    if (plan.remainingToSpendCents < 0) {
      return {
        id: 'plan-limit',
        text: `Você ultrapassou o limite deste mês em ${formatMoney(plan.overLimitCents)}.`,
        tone: 'attention',
        priority: 95,
      };
    }

    return {
      id: 'plan-limit',
      text: `Você já comprometeu ${formatPercentage(plan.spendingPercentage)} do seu limite deste mês.`,
      tone: 'attention',
      priority: 92,
    };
  },
};

const endOfMonthProjection: InsightRule = {
  id: 'projection',
  evaluate({ snapshot }) {
    if (snapshot.temporality !== 'current') return null;

    const { projection, totals } = snapshot;
    if (totals.transactionCount === 0) return null;
    if (projection.elapsedDays === 0 || projection.remainingDays === 0) return null;
    // Com poucos dias decorridos o ritmo ainda nao significa nada.
    if (projection.elapsedDays < 5) return null;

    return {
      id: 'projection',
      text: `Mantendo esse ritmo, você fecha o mês com cerca de ${formatMoney(
        projection.projectedBalanceCents,
      )}.`,
      tone: projection.projectedBalanceCents < 0 ? 'attention' : 'neutral',
      priority: 75,
    };
  },
};

export const INSIGHT_RULES: readonly InsightRule[] = [
  negativeBalance,
  planLimit,
  incomeUsage,
  endOfMonthProjection,
  reserveDependency,
  expenseComparison,
  cardShare,
  largestExpenseCategory,
];
