import type { Debt } from '@/domain/entities/debt';
import type { Money } from '@/domain/shared/money';
import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';
import type { PlainDate } from '@/domain/shared/plain-date';
import { parsePlainDate } from '@/domain/shared/plain-date';

/**
 * Cadastro de divida.
 *
 * O ponto delicado deste formulario e o cronograma OPCIONAL, decidido no
 * Lote 2: o usuario sempre sabe quanto paga por mes e quando vence, mas nem
 * sempre sabe quantas parcelas faltam. Fabricar um "24x, 9 pagas" produziria
 * barra de progresso, previsao de quitacao e saldo devedor — tres mentiras
 * derivadas de um chute.
 *
 * Por isso `knowsSchedule` e um estado de primeira classe do formulario. Com
 * ele desligado, os tres campos de prazo sao OMITIDOS do rascunho, e nao
 * gravados como zero. Zero parcelas pagas e uma afirmacao; ausencia e outra.
 */
export interface DebtFormValues {
  readonly name: string;
  readonly installment: string;
  readonly dueDay: string;
  /** Se o usuario sabe o prazo. Desligado = os tres campos abaixo sao ignorados. */
  readonly knowsSchedule: boolean;
  readonly totalInstallments: string;
  readonly paidInstallments: string;
  readonly startDate: string;
  readonly notes: string;
}

export interface DebtDraft {
  readonly name: string;
  readonly installmentCents: Money;
  readonly dueDay: number;
  readonly totalInstallments?: number;
  readonly paidInstallments?: number;
  readonly startDate?: PlainDate;
  readonly notes?: string;
}

export type DebtFormField =
  | 'name'
  | 'installment'
  | 'dueDay'
  | 'totalInstallments'
  | 'paidInstallments'
  | 'startDate';
export type DebtFormErrors = Partial<Record<DebtFormField, string>>;

export type DebtFormResult =
  | { readonly ok: true; readonly draft: DebtDraft }
  | { readonly ok: false; readonly errors: DebtFormErrors };

const NAME_MAX = 120;
const MAX_INSTALLMENTS = 600;

export function emptyDebtValues(): DebtFormValues {
  return {
    name: '',
    installment: '',
    dueDay: '',
    // Desligado por padrao: o app nao presume que a pessoa saiba o prazo.
    knowsSchedule: false,
    totalInstallments: '',
    paidInstallments: '',
    startDate: '',
    notes: '',
  };
}

export function debtValuesFrom(debt: Debt): DebtFormValues {
  const knows = debt.totalInstallments !== undefined && debt.paidInstallments !== undefined;

  return {
    name: debt.name,
    installment: formatMoneyPlain(debt.installmentCents),
    dueDay: String(debt.dueDay),
    knowsSchedule: knows,
    totalInstallments: debt.totalInstallments === undefined ? '' : String(debt.totalInstallments),
    paidInstallments: debt.paidInstallments === undefined ? '' : String(debt.paidInstallments),
    startDate: debt.startDate ?? '',
    notes: debt.notes ?? '',
  };
}

function parseDay(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null;
  const day = Number(raw.trim());
  return day >= 1 && day <= 31 ? day : null;
}

function parseCount(raw: string): number | null {
  if (!/^\d{1,3}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

export function validateDebtForm(values: DebtFormValues): DebtFormResult {
  const errors: Record<string, string> = {};

  const name = values.name.trim();
  if (name === '') errors.name = 'Dê um nome a esta dívida.';
  else if (name.length > NAME_MAX) errors.name = `Use até ${String(NAME_MAX)} caracteres.`;

  // A parcela e o unico valor sempre conhecido, e precisa ser maior que zero.
  const installmentCents = parseMoney(values.installment);
  if (values.installment.trim() === '') {
    errors.installment = 'Informe o valor da parcela.';
  } else if (installmentCents === null) {
    errors.installment = 'Valor não reconhecido. Use vírgula para os centavos.';
  } else if (installmentCents <= 0) {
    errors.installment = 'A parcela precisa ser maior que zero.';
  }

  const dueDay = parseDay(values.dueDay);
  if (dueDay === null) errors.dueDay = 'Dia entre 1 e 31.';

  let totalInstallments: number | undefined;
  let paidInstallments: number | undefined;
  let startDate: PlainDate | undefined;

  if (values.knowsSchedule) {
    const total = parseCount(values.totalInstallments);
    if (total === null || total < 1 || total > MAX_INSTALLMENTS) {
      errors.totalInstallments = `Entre 1 e ${String(MAX_INSTALLMENTS)} parcelas.`;
    } else {
      totalInstallments = total;
    }

    const paid = parseCount(values.paidInstallments);
    if (paid === null || paid < 0 || paid > MAX_INSTALLMENTS) {
      errors.paidInstallments = 'Informe quantas já foram pagas.';
    } else if (total !== null && paid > total) {
      errors.paidInstallments = 'Pagas não podem passar do total.';
    } else {
      paidInstallments = paid;
    }

    // A data de inicio continua opcional mesmo com prazo conhecido: saber
    // "24x, 9 pagas" nao obriga a lembrar o dia da primeira.
    if (values.startDate.trim() !== '') {
      const parsed = parsePlainDate(values.startDate);
      if (parsed === null) errors.startDate = 'Data inválida.';
      else startDate = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as DebtFormErrors };
  }

  if (installmentCents === null || dueDay === null) {
    return { ok: false, errors: { installment: 'Dados inválidos.' } };
  }

  const notes = values.notes.trim();

  return {
    ok: true,
    draft: {
      name,
      installmentCents,
      dueDay,
      // Omitidos, nao zerados: ausencia de informacao e um dado em si.
      ...(totalInstallments === undefined ? {} : { totalInstallments }),
      ...(paidInstallments === undefined ? {} : { paidInstallments }),
      ...(startDate === undefined ? {} : { startDate }),
      ...(notes === '' ? {} : { notes }),
    },
  };
}

/**
 * Patch de avanco de parcela.
 *
 * Decisao do lote: `paidInstallments` e a UNICA fonte de verdade do progresso.
 * Dar baixa altera so este numero e NAO cria transacao — duas fontes tentando
 * se sincronizar e exatamente o que produz divergencia entre o progresso da
 * divida e o extrato.
 *
 * Devolve `null` quando nao ha o que avancar: prazo desconhecido (nao da para
 * avancar o que nao se sabe) ou divida ja quitada.
 */
export function advancePaidInstallments(debt: Debt, delta: 1 | -1): number | null {
  if (debt.totalInstallments === undefined || debt.paidInstallments === undefined) return null;

  const next = debt.paidInstallments + delta;
  if (next < 0 || next > debt.totalInstallments) return null;

  return next;
}
