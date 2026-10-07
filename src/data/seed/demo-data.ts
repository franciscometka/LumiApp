import type { Card } from '@/domain/entities/card';
import type { Category } from '@/domain/entities/category';
import type { Debt } from '@/domain/entities/debt';
import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { Transaction } from '@/domain/entities/transaction';
import type { UserSettings } from '@/domain/entities/user-settings';
import { DEFAULT_SALARY_DAY, DEFAULT_TIME_ZONE } from '@/domain/entities/user-settings';
import type { ID, Timestamp } from '@/domain/shared/id';
// `moneyFromReais` so e permitido aqui: valores constantes, auditaveis e sob
// nosso controle. O caminho de entrada do usuario e `parseMoney(string)`.
import { moneyFromReais } from '@/domain/shared/money';
import type { MonthKey } from '@/domain/shared/plain-date';
import { getMonthKeyParts, makePlainDateClamped } from '@/domain/shared/plain-date';

import {
  cardCodec,
  categoryCodec,
  debtCodec,
  monthlyPlanCodec,
  recurringBillCodec,
  transactionCodec,
  userSettingsCodec,
} from '../serialization/codecs';

/**
 * Dados iniciais de demonstracao — exatamente os numeros do briefing.
 *
 * Os identificadores sao UUID v4 FIXOS, escritos a mao. Nao sao indices de
 * array nem valores gerados em tempo de execucao, por tres razoes:
 * - rodar o seed duas vezes produziria as mesmas chaves, nunca duplicatas;
 * - as transacoes podem referenciar categorias e cartoes sem nenhuma etapa de
 *   resolucao de nomes;
 * - as mesmas chaves podem ser inseridas em uma coluna `uuid` do Postgres
 *   quando o Supabase entrar.
 */

export const SEED_IDS = {
  categories: {
    salario: '4b1c0d2e-0001-4a10-8f01-000000000001',
    rendaExtra: '4b1c0d2e-0001-4a10-8f01-000000000002',
    reserva: '4b1c0d2e-0001-4a10-8f01-000000000003',
    bonus: '4b1c0d2e-0001-4a10-8f01-000000000004',
    carro: '4b1c0d2e-0002-4a10-8f01-000000000001',
    alimentacao: '4b1c0d2e-0002-4a10-8f01-000000000002',
    casa: '4b1c0d2e-0002-4a10-8f01-000000000003',
    internet: '4b1c0d2e-0002-4a10-8f01-000000000004',
    assinaturas: '4b1c0d2e-0002-4a10-8f01-000000000005',
    lazer: '4b1c0d2e-0002-4a10-8f01-000000000006',
    saude: '4b1c0d2e-0002-4a10-8f01-000000000007',
    educacao: '4b1c0d2e-0002-4a10-8f01-000000000008',
    cartao: '4b1c0d2e-0002-4a10-8f01-000000000009',
    emprestimos: '4b1c0d2e-0002-4a10-8f01-00000000000a',
    outros: '4b1c0d2e-0002-4a10-8f01-00000000000b',
  },
  cards: {
    inter: '4b1c0d2e-0003-4a10-8f01-000000000001',
    magalu: '4b1c0d2e-0003-4a10-8f01-000000000002',
  },
  debts: {
    emprestimo: '4b1c0d2e-0004-4a10-8f01-000000000001',
  },
  recurringBills: {
    internet: '4b1c0d2e-0005-4a10-8f01-000000000001',
    emprestimo: '4b1c0d2e-0005-4a10-8f01-000000000002',
  },
  transactions: {
    salario: '4b1c0d2e-0006-4a10-8f01-000000000001',
    rendaExtra: '4b1c0d2e-0006-4a10-8f01-000000000002',
    reserva: '4b1c0d2e-0006-4a10-8f01-000000000003',
    bonus: '4b1c0d2e-0006-4a10-8f01-000000000004',
    carro: '4b1c0d2e-0006-4a10-8f01-000000000005',
    internet: '4b1c0d2e-0006-4a10-8f01-000000000006',
    cartaoInter: '4b1c0d2e-0006-4a10-8f01-000000000007',
    cartaoMagalu: '4b1c0d2e-0006-4a10-8f01-000000000008',
    emprestimo: '4b1c0d2e-0006-4a10-8f01-000000000009',
  },
  monthlyPlan: '4b1c0d2e-0007-4a10-8f01-000000000001',
} as const;

export interface SeedData {
  readonly categories: readonly Category[];
  readonly cards: readonly Card[];
  readonly debts: readonly Debt[];
  readonly recurringBills: readonly RecurringBill[];
  readonly transactions: readonly Transaction[];
  readonly monthlyPlans: readonly MonthlyPlan[];
  readonly settings: UserSettings;
}

export interface SeedOptions {
  readonly userId: ID;
  /** Mes em que os lancamentos de demonstracao serao criados. */
  readonly month: MonthKey;
  readonly now: Timestamp;
}

interface CategorySeed {
  readonly id: string;
  readonly name: string;
  readonly kind: Category['kind'];
  readonly icon: string;
  readonly colorToken: Category['colorToken'];
}

const CATEGORY_SEEDS: readonly CategorySeed[] = [
  { id: SEED_IDS.categories.salario, name: 'Salário', kind: 'income', icon: 'wallet', colorToken: 'chart-3' },
  { id: SEED_IDS.categories.rendaExtra, name: 'Renda extra', kind: 'income', icon: 'trending-up', colorToken: 'chart-3' },
  { id: SEED_IDS.categories.reserva, name: 'Dinheiro guardado', kind: 'income', icon: 'piggy-bank', colorToken: 'chart-2' },
  { id: SEED_IDS.categories.bonus, name: 'Bônus', kind: 'income', icon: 'gift', colorToken: 'chart-4' },

  { id: SEED_IDS.categories.carro, name: 'Carro', kind: 'expense', icon: 'car', colorToken: 'chart-1' },
  { id: SEED_IDS.categories.alimentacao, name: 'Alimentação', kind: 'expense', icon: 'utensils', colorToken: 'chart-4' },
  { id: SEED_IDS.categories.casa, name: 'Casa', kind: 'expense', icon: 'house', colorToken: 'chart-2' },
  { id: SEED_IDS.categories.internet, name: 'Internet', kind: 'expense', icon: 'wifi', colorToken: 'chart-2' },
  { id: SEED_IDS.categories.assinaturas, name: 'Assinaturas', kind: 'expense', icon: 'repeat', colorToken: 'chart-5' },
  { id: SEED_IDS.categories.lazer, name: 'Lazer', kind: 'expense', icon: 'party-popper', colorToken: 'chart-4' },
  { id: SEED_IDS.categories.saude, name: 'Saúde', kind: 'expense', icon: 'heart-pulse', colorToken: 'chart-5' },
  { id: SEED_IDS.categories.educacao, name: 'Educação', kind: 'expense', icon: 'graduation-cap', colorToken: 'chart-2' },
  { id: SEED_IDS.categories.cartao, name: 'Cartão', kind: 'expense', icon: 'credit-card', colorToken: 'chart-1' },
  { id: SEED_IDS.categories.emprestimos, name: 'Empréstimos', kind: 'expense', icon: 'landmark', colorToken: 'chart-5' },
  { id: SEED_IDS.categories.outros, name: 'Outros', kind: 'both', icon: 'circle-dashed', colorToken: 'chart-2' },
];

/** Dia dentro do mes do seed, limitado ao ultimo dia (fevereiro inclusive). */
function dayIn(month: MonthKey, day: number) {
  const { year, month: monthNumber } = getMonthKeyParts(month);
  return makePlainDateClamped(year, monthNumber, day);
}

/**
 * Monta os dados de demonstracao. Funcao pura: as mesmas entradas produzem
 * exatamente o mesmo resultado, o que torna o seed verificavel em teste.
 *
 * Tudo passa pelos codecs antes de sair daqui — nenhum dado de seed entra no
 * storage sem a mesma validacao exigida de um dado digitado pelo usuario.
 */
export function buildSeedData({ userId, month, now }: SeedOptions): SeedData {
  const base = { userId, createdAt: now, updatedAt: now };

  const categories = CATEGORY_SEEDS.map((seed, index) =>
    categoryCodec.parse({
      ...base,
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      icon: seed.icon,
      colorToken: seed.colorToken,
      isSystem: true,
      order: index,
    }),
  );

  const cards = [
    cardCodec.parse({
      ...base,
      id: SEED_IDS.cards.inter,
      name: 'Inter',
      limitCents: moneyFromReais(3000),
      closingDay: 20,
      dueDay: 28,
      currentInvoiceCents: moneyFromReais(374),
      invoiceUpdatedAt: now,
      colorToken: 'chart-1',
    }),
    cardCodec.parse({
      ...base,
      id: SEED_IDS.cards.magalu,
      name: 'Magalu',
      limitCents: moneyFromReais(2000),
      closingDay: 10,
      dueDay: 18,
      currentInvoiceCents: moneyFromReais(765),
      invoiceUpdatedAt: now,
      colorToken: 'chart-5',
    }),
  ];

  const debts = [
    debtCodec.parse({
      ...base,
      id: SEED_IDS.debts.emprestimo,
      name: 'Empréstimo',
      installmentCents: moneyFromReais(440),
      dueDay: 20,
      // Prazo deliberadamente AUSENTE.
      //
      // O briefing informa apenas "Empréstimo: R$ 440". Total de parcelas,
      // parcelas pagas, saldo devedor e data final nao foram informados —
      // preenche-los aqui transformaria um chute em barra de progresso,
      // previsao de quitacao e saldo devedor: tres numeros falsos derivados
      // de um valor que ninguem forneceu.
      //
      // Com os campos ausentes, o app diz honestamente que nao sabe e
      // convida a completar o cadastro.
      notes: 'Parcela mensal conhecida. Prazo ainda nao informado.',
    }),
  ];

  const recurringBills = [
    recurringBillCodec.parse({
      ...base,
      id: SEED_IDS.recurringBills.internet,
      description: 'Internet',
      amountCents: moneyFromReais(120),
      type: 'expense',
      categoryId: SEED_IDS.categories.internet,
      dueDay: 10,
      paymentMethod: 'boleto',
      isActive: true,
      startMonth: month,
      // Ja marcado como gerado neste mes: as transacoes do seed sao
      // justamente a materializacao dele. Sem isso, a primeira abertura
      // criaria uma segunda conta de internet.
      lastGeneratedMonth: month,
    }),
    recurringBillCodec.parse({
      ...base,
      id: SEED_IDS.recurringBills.emprestimo,
      description: 'Empréstimo',
      amountCents: moneyFromReais(440),
      type: 'expense',
      categoryId: SEED_IDS.categories.emprestimos,
      dueDay: 20,
      paymentMethod: 'boleto',
      debtId: SEED_IDS.debts.emprestimo,
      isActive: true,
      startMonth: month,
      lastGeneratedMonth: month,
    }),
  ];

  const transactions = [
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.salario,
      flow: 'operational',
      description: 'Salário',
      amountCents: moneyFromReais(2300),
      type: 'income',
      categoryId: SEED_IDS.categories.salario,
      date: dayIn(month, 5),
      status: 'paid',
      paymentMethod: 'transfer',
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.rendaExtra,
      flow: 'operational',
      description: 'Renda extra',
      amountCents: moneyFromReais(300),
      type: 'income',
      categoryId: SEED_IDS.categories.rendaExtra,
      date: dayIn(month, 12),
      status: 'paid',
      paymentMethod: 'pix',
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.reserva,
      description: 'Dinheiro guardado utilizado',
      amountCents: moneyFromReais(100),
      type: 'income',
      // Este dinheiro ja era do usuario: fica disponivel no mes, mas nao foi
      // gerado por ele. Entra no "disponivel" (R$ 3.100) e fica de fora da
      // "renda gerada" (R$ 3.000).
      flow: 'transfer',
      categoryId: SEED_IDS.categories.reserva,
      date: dayIn(month, 15),
      status: 'paid',
      paymentMethod: 'transfer',
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.bonus,
      flow: 'operational',
      description: 'Bônus',
      amountCents: moneyFromReais(400),
      type: 'income',
      categoryId: SEED_IDS.categories.bonus,
      date: dayIn(month, 20),
      status: 'paid',
      paymentMethod: 'transfer',
    }),

    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.carro,
      flow: 'operational',
      description: 'Carro',
      amountCents: moneyFromReais(911),
      type: 'expense',
      categoryId: SEED_IDS.categories.carro,
      date: dayIn(month, 8),
      status: 'paid',
      paymentMethod: 'debit',
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.internet,
      flow: 'operational',
      description: 'Internet',
      amountCents: moneyFromReais(120),
      type: 'expense',
      categoryId: SEED_IDS.categories.internet,
      date: dayIn(month, 10),
      status: 'paid',
      paymentMethod: 'boleto',
      recurringBillId: SEED_IDS.recurringBills.internet,
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.cartaoInter,
      flow: 'operational',
      description: 'Cartão Inter',
      amountCents: moneyFromReais(374),
      type: 'expense',
      categoryId: SEED_IDS.categories.cartao,
      date: dayIn(month, 28),
      status: 'pending',
      paymentMethod: 'credit',
      cardId: SEED_IDS.cards.inter,
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.cartaoMagalu,
      flow: 'operational',
      description: 'Cartão Magalu',
      amountCents: moneyFromReais(765),
      type: 'expense',
      categoryId: SEED_IDS.categories.cartao,
      date: dayIn(month, 18),
      status: 'pending',
      paymentMethod: 'credit',
      cardId: SEED_IDS.cards.magalu,
    }),
    transactionCodec.parse({
      ...base,
      id: SEED_IDS.transactions.emprestimo,
      flow: 'operational',
      description: 'Empréstimo',
      amountCents: moneyFromReais(440),
      type: 'expense',
      categoryId: SEED_IDS.categories.emprestimos,
      date: dayIn(month, 20),
      status: 'paid',
      paymentMethod: 'boleto',
      debtId: SEED_IDS.debts.emprestimo,
      recurringBillId: SEED_IDS.recurringBills.emprestimo,
    }),
  ];

  const monthlyPlans = [
    monthlyPlanCodec.parse({
      ...base,
      id: SEED_IDS.monthlyPlan,
      month,
      expectedIncomeCents: moneyFromReais(3000),
      spendingLimitCents: moneyFromReais(2500),
      savingsGoalCents: moneyFromReais(500),
    }),
  ];

  const settings = userSettingsCodec.parse({
    userId,
    currency: 'BRL',
    locale: 'pt-BR',
    timeZone: DEFAULT_TIME_ZONE,
    salaryDay: DEFAULT_SALARY_DAY,
    periodResolverId: 'civil-month',
    theme: 'dark',
    createdAt: now,
    updatedAt: now,
  });

  return { categories, cards, debts, recurringBills, transactions, monthlyPlans, settings };
}
