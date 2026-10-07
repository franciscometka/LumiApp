import type { Category } from '@/domain/entities/category';
import { acceptsType, isArchived, sortCategories } from '@/domain/entities/category';
import type {
  FlowNature,
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/domain/entities/transaction';
import type { ID } from '@/domain/shared/id';
import { isId } from '@/domain/shared/id';
import type { Money } from '@/domain/shared/money';
import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';
import type { PlainDate } from '@/domain/shared/plain-date';
import { parsePlainDate } from '@/domain/shared/plain-date';

/**
 * Estado e validacao do formulario de transacao — sem React, sem JSX.
 *
 * Mora fora do componente por tres razoes:
 *
 * 1. criar e editar usam exatamente estas funcoes, entao a regra nao existe em
 *    duas versoes que podem divergir;
 * 2. a conversao de texto para `Money` passa por um unico caminho
 *    (`parseMoney`), testavel sem montar a arvore;
 * 3. "valor invalido" e uma decisao de negocio, nao de interface.
 *
 * O valor NUNCA passa por `Number(texto)` nem por `moneyFromReais`. O usuario
 * digita "1.234,56" e `parseMoney` monta 123456 centavos concatenando strings.
 */

/** Tudo em texto: e o que um `<input>` realmente tem para oferecer. */
export interface TransactionFormValues {
  readonly type: TransactionType;
  readonly amount: string;
  readonly description: string;
  /** `''` = nenhuma escolhida ainda. */
  readonly categoryId: string;
  readonly date: string;
  readonly status: TransactionStatus;
  readonly paymentMethod: PaymentMethod;
  readonly flow: FlowNature;
  readonly notes: string;
  readonly cardId: string;
  readonly debtId: string;
}

/** O que vai para o repositorio. Sem `userId`: quem persiste resolve isso. */
export interface TransactionDraft {
  readonly description: string;
  readonly amountCents: Money;
  readonly type: TransactionType;
  readonly flow: FlowNature;
  readonly categoryId: ID;
  readonly date: PlainDate;
  readonly status: TransactionStatus;
  readonly paymentMethod: PaymentMethod;
  readonly cardId?: ID;
  readonly debtId?: ID;
  readonly notes?: string;
}

export type TransactionFormField = 'amount' | 'description' | 'categoryId' | 'date';
export type TransactionFormErrors = Partial<Record<TransactionFormField, string>>;

export type TransactionFormResult =
  | { readonly ok: true; readonly draft: TransactionDraft }
  | { readonly ok: false; readonly errors: TransactionFormErrors };

const DESCRIPTION_MAX = 120;
const NOTES_MAX = 1000;

/**
 * Formulario de criacao. O padrao e um gasto pago de hoje, porque e de longe o
 * lancamento mais frequente: assim o caminho curto e digitar valor, descricao,
 * categoria e salvar.
 */
export function emptyFormValues(today: PlainDate): TransactionFormValues {
  return {
    type: 'expense',
    amount: '',
    description: '',
    categoryId: '',
    date: today,
    status: 'paid',
    paymentMethod: 'pix',
    flow: 'operational',
    notes: '',
    cardId: '',
    debtId: '',
  };
}

/** Formulario de edicao, preenchido a partir do registro existente. */
export function formValuesFromTransaction(transaction: Transaction): TransactionFormValues {
  return {
    type: transaction.type,
    // O campo mostra "1.139,00", nao "113900": o usuario pensa em reais.
    amount: formatMoneyPlain(transaction.amountCents),
    description: transaction.description,
    categoryId: transaction.categoryId,
    date: transaction.date,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    flow: transaction.flow,
    notes: transaction.notes ?? '',
    cardId: transaction.cardId ?? '',
    debtId: transaction.debtId ?? '',
  };
}

/** Categorias que aceitam aquele lado do fluxo, em ordem de exibicao. */
export function categoriesForType(
  categories: readonly Category[],
  type: TransactionType,
): Category[] {
  return sortCategories(
    categories.filter((category) => !isArchived(category) && acceptsType(category, type)),
  );
}

/**
 * Troca o tipo e, se a categoria escolhida nao serve ao novo lado, limpa a
 * selecao.
 *
 * Deixar "Salario" selecionado depois de virar gasto produziria um lancamento
 * absurdo sem que nada na tela indicasse o problema — e o briefing pediu
 * explicitamente que isso nao acontecesse em silencio. A limpeza e visivel: o
 * campo volta a "Selecione", exigindo uma escolha consciente.
 */
export function changeType(
  values: TransactionFormValues,
  type: TransactionType,
  categories: readonly Category[],
): TransactionFormValues {
  if (values.type === type) return values;

  const selected = categories.find((category) => category.id === values.categoryId);
  const keepsCategory = selected !== undefined && acceptsType(selected, type);

  return {
    ...values,
    type,
    categoryId: keepsCategory ? values.categoryId : '',
    // Transferencia e uma natureza de entrada ("usei a reserva"); ao virar
    // gasto o padrao volta a ser movimento do mes.
    flow: type === 'expense' && values.flow === 'transfer' ? 'operational' : values.flow,
  };
}

/** `true` se a categoria selecionada nao existe mais ou nao serve ao tipo. */
export function hasOrphanCategory(
  values: TransactionFormValues,
  categories: readonly Category[],
): boolean {
  if (values.categoryId === '') return false;
  const selected = categories.find((category) => category.id === values.categoryId);
  return selected === undefined || !acceptsType(selected, values.type);
}

function optionalId(value: string): ID | undefined {
  return isId(value) ? value : undefined;
}

/**
 * Valida e converte. Devolve ou o rascunho pronto, ou os erros por campo —
 * nunca um objeto meio preenchido, para que o chamador nao tenha como
 * persistir algo invalido por descuido.
 */
export function validateForm(
  values: TransactionFormValues,
  categories: readonly Category[],
): TransactionFormResult {
  const errors: Record<string, string> = {};

  const amountCents = parseMoney(values.amount);
  if (values.amount.trim() === '') {
    errors.amount = 'Informe um valor.';
  } else if (amountCents === null) {
    errors.amount = 'Valor não reconhecido. Use vírgula para os centavos.';
  } else if (amountCents <= 0) {
    // O sinal vem do tipo, nunca do numero digitado: "-50" num gasto seria
    // uma entrada disfarcada.
    errors.amount = 'O valor precisa ser maior que zero.';
  }

  const description = values.description.trim();
  if (description === '') {
    errors.description = 'Descreva o lançamento.';
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `Use até ${String(DESCRIPTION_MAX)} caracteres.`;
  }

  if (values.categoryId === '') {
    errors.categoryId = 'Escolha uma categoria.';
  } else if (hasOrphanCategory(values, categories)) {
    errors.categoryId = 'Essa categoria não serve para este tipo de lançamento.';
  }

  const date = parsePlainDate(values.date);
  if (date === null) {
    errors.date = 'Data inválida.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as TransactionFormErrors };
  }

  // Os `if` acima garantem estes dois; o `??` existe so para o compilador.
  if (amountCents === null || date === null) {
    return { ok: false, errors: { amount: 'Valor inválido.' } };
  }

  const categoryId = optionalId(values.categoryId);
  if (categoryId === undefined) {
    return { ok: false, errors: { categoryId: 'Escolha uma categoria.' } };
  }

  const notes = values.notes.trim().slice(0, NOTES_MAX);

  return {
    ok: true,
    draft: {
      description,
      amountCents,
      type: values.type,
      flow: values.flow,
      categoryId,
      date,
      status: values.status,
      paymentMethod: values.paymentMethod,
      ...(optionalId(values.cardId) === undefined ? {} : { cardId: optionalId(values.cardId) }),
      ...(optionalId(values.debtId) === undefined ? {} : { debtId: optionalId(values.debtId) }),
      ...(notes === '' ? {} : { notes }),
    },
  };
}

/**
 * Se o rascunho mexe em algo que o formulario avancado controla. Usado para
 * abrir "Mais opções" ja expandido numa edicao que depende desses campos — do
 * contrario a pessoa editaria sem ver que a transacao tem um vinculo.
 */
export function needsAdvancedSection(values: TransactionFormValues): boolean {
  return (
    values.notes.trim() !== '' ||
    values.cardId !== '' ||
    values.debtId !== '' ||
    values.flow === 'transfer' ||
    values.paymentMethod !== 'pix'
  );
}
