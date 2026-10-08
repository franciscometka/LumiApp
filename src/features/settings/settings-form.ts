import type { ImportPreview } from '@/data/ports/data-source';
import type { PlainDate } from '@/domain/shared/plain-date';

/**
 * Regras da tela de Ajustes, sem React.
 */

/** Dia do salario: inteiro de 1 a 31. 31 vira o ultimo dia em meses curtos. */
export function parseSalaryDay(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const day = Number(trimmed);
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * Nome do arquivo de backup: \`finan-backup-2026-10-08.json\`.
 * A data no nome e o que distingue dois backups na pasta de downloads.
 */
export function backupFileName(today: PlainDate): string {
  return `finan-backup-${today}.json`;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${String(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * O que o backup traz, em uma frase, para a confirmacao de importacao.
 * A pessoa decide substituir os dados sabendo o que vai entrar no lugar.
 */
export function describeImportPreview(preview: ImportPreview): string {
  const { counts } = preview;
  const parts = [
    plural(counts.transactions, 'transação', 'transações'),
    plural(counts.monthlyPlans, 'plano', 'planos'),
    plural(counts.cards, 'cartão', 'cartões'),
    plural(counts.debts, 'dívida', 'dívidas'),
    plural(counts.recurringBills, 'conta recorrente', 'contas recorrentes'),
    plural(counts.categories, 'categoria', 'categorias'),
  ];
  const last = parts.pop() as string;
  return `${parts.join(', ')} e ${last}`;
}
