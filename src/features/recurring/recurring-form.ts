import type { Category } from '@/domain/entities/category';
import { acceptsType, isArchived, sortCategories } from '@/domain/entities/category';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { PaymentMethod, TransactionType } from '@/domain/entities/transaction';
import type { ID } from '@/domain/shared/id';
import { isId } from '@/domain/shared/id';
import type { Money } from '@/domain/shared/money';
import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';
import type { MonthKey } from '@/domain/shared/plain-date';
import { parseMonthKey } from '@/domain/shared/plain-date';

/**
 * Estado e validacao do cadastro de conta recorrente. Sem React.
 *
 * Duas coisas distinguem este formulario dos anteriores:
 *
 * - **`startMonth` e `endMonth` sao MESES, nao datas.** A recorrencia v1 e
 *   mensal, entao "vale a partir de outubro" e a unidade certa. Um timestamp
 *   traria fuso horario para dentro de uma pergunta que nao tem hora.
 *
 * - **Encerrar nao e excluir.** `endMonth` diz "este foi o ultimo mes em que a
 *   obrigacao existiu" — a Netflix cancelada em marco. Excluir diz "este
 *   cadastro estava errado". As duas acoes preservam o historico, mas contam
 *   historias diferentes, e misturar as duas apagaria a diferenca.
 */
export interface RecurringFormValues {
  readonly description: string;
  readonly amount: string;
  readonly type: TransactionType;
  readonly categoryId: string;
  readonly dueDay: string;
  readonly paymentMethod: PaymentMethod;
  readonly startMonth: string;
  /** Vazio = sem termino. */
  readonly endMonth: string;
}

export interface RecurringDraft {
  readonly description: string;
  readonly amountCents: Money;
  readonly type: TransactionType;
  readonly categoryId: ID;
  readonly dueDay: number;
  readonly paymentMethod: PaymentMethod;
  readonly isActive: boolean;
  readonly startMonth: MonthKey;
  readonly endMonth?: MonthKey;
}

export type RecurringFormField =
  | 'description'
  | 'amount'
  | 'categoryId'
  | 'dueDay'
  | 'startMonth'
  | 'endMonth';
export type RecurringFormErrors = Partial<Record<RecurringFormField, string>>;

export type RecurringFormResult =
  | { readonly ok: true; readonly draft: RecurringDraft }
  | { readonly ok: false; readonly errors: RecurringFormErrors };

const DESCRIPTION_MAX = 120;

export function emptyRecurringValues(currentMonth: MonthKey): RecurringFormValues {
  return {
    description: '',
    amount: '',
    type: 'expense',
    categoryId: '',
    dueDay: '',
    paymentMethod: 'boleto',
    // Comeca no mes que a pessoa esta olhando: e quase sempre o que ela quer.
    startMonth: currentMonth,
    endMonth: '',
  };
}

export function recurringValuesFrom(bill: RecurringBill): RecurringFormValues {
  return {
    description: bill.description,
    amount: formatMoneyPlain(bill.amountCents),
    type: bill.type,
    categoryId: bill.categoryId,
    dueDay: String(bill.dueDay),
    paymentMethod: bill.paymentMethod,
    startMonth: bill.startMonth,
    endMonth: bill.endMonth ?? '',
  };
}

export function categoriesForType(
  categories: readonly Category[],
  type: TransactionType,
): Category[] {
  return sortCategories(
    categories.filter((category) => !isArchived(category) && acceptsType(category, type)),
  );
}

/** Mesma regra do formulario de transacao: categoria incompativel nao fica. */
export function changeType(
  values: RecurringFormValues,
  type: TransactionType,
  categories: readonly Category[],
): RecurringFormValues {
  if (values.type === type) return values;

  const selected = categories.find((category) => category.id === values.categoryId);
  const keeps = selected !== undefined && acceptsType(selected, type);

  return { ...values, type, categoryId: keeps ? values.categoryId : '' };
}

function parseDay(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const day = Number(raw.trim());
  return day >= 1 && day <= 31 ? day : null;
}

export function validateRecurringForm(
  values: RecurringFormValues,
  categories: readonly Category[],
): RecurringFormResult {
  const errors: Record<string, string> = {};

  const description = values.description.trim();
  if (description === '') errors.description = 'Descreva a conta.';
  else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Use até ${String(DESCRIPTION_MAX)} caracteres.`;
  }

  const amountCents = parseMoney(values.amount);
  if (values.amount.trim() === '') {
    errors.amount = 'Informe um valor.';
  } else if (amountCents === null) {
    errors.amount = 'Valor não reconhecido. Use vírgula para os centavos.';
  } else if (amountCents <= 0) {
    errors.amount = 'O valor precisa ser maior que zero.';
  }

  if (values.categoryId === '') {
    errors.categoryId = 'Escolha uma categoria.';
  } else {
    const selected = categories.find((category) => category.id === values.categoryId);
    if (selected === undefined || !acceptsType(selected, values.type)) {
      errors.categoryId = 'Essa categoria não serve para este tipo.';
    }
  }

  const dueDay = parseDay(values.dueDay);
  if (dueDay === null) errors.dueDay = 'Dia entre 1 e 31.';

  const startMonth = parseMonthKey(values.startMonth);
  if (startMonth === null) errors.startMonth = 'Mês inválido.';

  let endMonth: MonthKey | undefined;
  if (values.endMonth.trim() !== '') {
    const parsed = parseMonthKey(values.endMonth);
    if (parsed === null) {
      errors.endMonth = 'Mês inválido.';
    } else if (startMonth !== null && parsed < startMonth) {
      // Encerrar antes de comecar nao e uma recorrencia; e nada.
      errors.endMonth = 'O último mês não pode vir antes do primeiro.';
    } else {
      endMonth = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as RecurringFormErrors };
  }

  const categoryId = isId(values.categoryId) ? values.categoryId : undefined;
  if (amountCents === null || dueDay === null || startMonth === null || categoryId === undefined) {
    return { ok: false, errors: { amount: 'Dados inválidos.' } };
  }

  return {
    ok: true,
    draft: {
      description,
      amountCents,
      type: values.type,
      categoryId,
      dueDay,
      paymentMethod: values.paymentMethod,
      isActive: true,
      startMonth,
      ...(endMonth === undefined ? {} : { endMonth }),
    },
  };
}

/**
 * Encerrar: define o ultimo mes em que a conta ainda gera ocorrencia.
 *
 * Nao e exclusao e nao apaga nada. Apos `endMonth`, a recorrencia continua
 * visivel na lista, marcada como encerrada, com todo o historico que gerou.
 */
export function endMonthPatch(month: MonthKey): { endMonth: MonthKey } {
  return { endMonth: month };
}

/** Se a recorrencia ja passou do seu ultimo mes, em relacao ao mes dado. */
export function hasEnded(bill: RecurringBill, reference: MonthKey): boolean {
  return bill.endMonth !== undefined && reference > bill.endMonth;
}
