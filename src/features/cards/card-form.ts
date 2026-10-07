import type { Card } from '@/domain/entities/card';
import type { CategoryColorToken } from '@/domain/entities/category';
import type { Money } from '@/domain/shared/money';
import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';

/**
 * Estado e validacao do cadastro de cartao. Sem React.
 *
 * Mesma disciplina do formulario de transacao: o valor digitado e texto, a
 * conversao passa uma unica vez por `parseMoney`, e `moneyFromReais` nao
 * aparece em lugar nenhum.
 *
 * Diferenca importante em relacao a transacao: aqui zero e LEGITIMO. Um
 * cartao sem fatura no momento vale R$ 0,00, e um cartao sem limite
 * cadastrado tambem — o que nao se aceita e negativo.
 */
export interface CardFormValues {
  readonly name: string;
  readonly limit: string;
  readonly invoice: string;
  readonly closingDay: string;
  readonly dueDay: string;
  readonly colorToken: CategoryColorToken;
}

export interface CardDraft {
  readonly name: string;
  readonly limitCents: Money;
  readonly currentInvoiceCents: Money;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly colorToken: CategoryColorToken;
}

export type CardFormField = 'name' | 'limit' | 'invoice' | 'closingDay' | 'dueDay';
export type CardFormErrors = Partial<Record<CardFormField, string>>;

export type CardFormResult =
  | { readonly ok: true; readonly draft: CardDraft }
  | { readonly ok: false; readonly errors: CardFormErrors };

const NAME_MAX = 120;

export function emptyCardValues(): CardFormValues {
  return {
    name: '',
    limit: '',
    invoice: '',
    closingDay: '',
    dueDay: '',
    colorToken: 'chart-1',
  };
}

export function cardValuesFrom(card: Card): CardFormValues {
  return {
    name: card.name,
    limit: formatMoneyPlain(card.limitCents),
    invoice: formatMoneyPlain(card.currentInvoiceCents),
    closingDay: String(card.closingDay),
    dueDay: String(card.dueDay),
    colorToken: card.colorToken,
  };
}

/** Dia do mes de 1 a 31. 31 e aceito; o dominio ajusta em fevereiro. */
function parseDay(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const day = Number(raw.trim());
  return day >= 1 && day <= 31 ? day : null;
}

/** Vazio vale R$ 0,00 aqui; negativo nunca. */
function parseNonNegative(raw: string): Money | null {
  if (raw.trim() === '') return 0 as Money;
  const value = parseMoney(raw);
  if (value === null || value < 0) return null;
  return value;
}

export function validateCardForm(values: CardFormValues): CardFormResult {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (name === '') errors.name = 'Dê um nome ao cartão.';
  else if (name.length > NAME_MAX) errors.name = `Use até ${String(NAME_MAX)} caracteres.`;

  const limitCents = parseNonNegative(values.limit);
  if (limitCents === null) errors.limit = 'Limite inválido. Use vírgula para os centavos.';

  const currentInvoiceCents = parseNonNegative(values.invoice);
  if (currentInvoiceCents === null) errors.invoice = 'Fatura inválida.';

  const closingDay = parseDay(values.closingDay);
  if (closingDay === null) errors.closingDay = 'Dia entre 1 e 31.';

  const dueDay = parseDay(values.dueDay);
  if (dueDay === null) errors.dueDay = 'Dia entre 1 e 31.';

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as CardFormErrors };
  }

  if (
    limitCents === null ||
    currentInvoiceCents === null ||
    closingDay === null ||
    dueDay === null
  ) {
    return { ok: false, errors: { name: 'Dados inválidos.' } };
  }

  return {
    ok: true,
    draft: { name, limitCents, currentInvoiceCents, closingDay, dueDay, colorToken: values.colorToken },
  };
}

/**
 * Atualizacao rapida de fatura: um campo so.
 *
 * Existe separado do formulario completo porque e a acao que se repete todo
 * mes. Obrigar a pessoa a passar pelo cadastro inteiro para digitar um numero
 * que ela acabou de ler no app do banco seria atrito sem contrapartida.
 */
export function validateInvoice(raw: string): Money | null {
  return parseNonNegative(raw);
}
