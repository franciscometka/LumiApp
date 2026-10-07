'use client';

import { Minus, Pencil, Plus } from 'lucide-react';

import { MoneyText, MoneyTextOrDash } from '@/components/finan/money-text';
import { Button } from '@/components/ui/button';
import type { Debt } from '@/domain/entities/debt';
import {
  hasSchedule,
  isSettled,
  progressPercentage,
  remainingAmount,
  remainingInstallments,
} from '@/domain/entities/debt';
import { clampPercentage, formatPercentage } from '@/domain/shared/percentage';
import { formatPlainDate } from '@/domain/shared/plain-date';
import type { PlainDate } from '@/domain/shared/plain-date';
import { nextDueDate } from '@/domain/entities/debt';
import { cn } from '@/lib/utils';

import { advancePaidInstallments } from '../debt-form';

/**
 * Uma divida na lista.
 *
 * O componente tem dois modos, e a diferenca entre eles e o ponto inteiro
 * desta entidade:
 *
 * - **Com cronograma**: pagas/total, progresso, parcelas restantes e saldo
 *   restante, todos derivados.
 * - **Sem cronograma**: valor da parcela e vencimento — que a pessoa sempre
 *   sabe — e `—` em tudo que depende de prazo. Nenhuma barra de progresso,
 *   nenhum "0 de ?" e nenhum total estimado.
 *
 * Fabricar um prazo produziria progresso, previsao de quitacao e saldo
 * devedor: tres numeros convincentes derivados de um chute.
 */
export function DebtRow({
  debt,
  today,
  onEdit,
  onAdvance,
  isAdvancing,
}: {
  debt: Debt;
  today: PlainDate;
  onEdit: (debt: Debt) => void;
  onAdvance: (debt: Debt, paidInstallments: number) => void;
  isAdvancing: boolean;
}) {
  const scheduled = hasSchedule(debt);
  const progress = progressPercentage(debt);
  const remaining = remainingInstallments(debt);
  const settled = isSettled(debt);
  const due = nextDueDate(debt, today);

  const canAdvance = advancePaidInstallments(debt, 1);
  const canGoBack = advancePaidInstallments(debt, -1);

  return (
    <li className="bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{debt.name}</h3>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            <MoneyText value={debt.installmentCents} size="sm" className="text-foreground" /> por mês
            {due === null ? null : ` · vence ${formatPlainDate(due)}`}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit(debt);
          }}
          aria-label={`Editar ${debt.name}`}
          className="text-muted-foreground -mt-1 -mr-2 shrink-0"
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {scheduled ? (
        <>
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium tabular-nums">
                  {debt.paidInstallments} de {debt.totalInstallments}
                </span>{' '}
                parcelas pagas
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatPercentage(progress)}
              </span>
            </div>

            <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', settled ? 'bg-income' : 'bg-primary')}
                style={{ width: `${String(clampPercentage(progress ?? 0))}%` }}
              />
            </div>
          </div>

          <dl className="text-muted-foreground mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-[13px]">
            <div className="flex justify-between">
              <dt>Faltam</dt>
              <dd className="text-foreground tabular-nums">
                {remaining === null ? '—' : `${String(remaining)}x`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Saldo</dt>
              <dd className="text-foreground">
                <MoneyTextOrDash value={remainingAmount(debt)} size="sm" />
              </dd>
            </div>
          </dl>

          {settled ? (
            <p className="text-income mt-3 text-sm font-medium">Quitada.</p>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={canAdvance === null || isAdvancing}
                onClick={() => {
                  if (canAdvance !== null) onAdvance(debt, canAdvance);
                }}
              >
                <Plus className="size-4" />
                Paguei uma parcela
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Desfazer uma parcela"
                disabled={canGoBack === null || isAdvancing}
                onClick={() => {
                  if (canGoBack !== null) onAdvance(debt, canGoBack);
                }}
                className="text-muted-foreground shrink-0"
              >
                <Minus className="size-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        /*
          Sem prazo conhecido. Os campos derivados aparecem como "—", e nao
          como zero: "0 parcelas pagas" seria uma afirmacao sobre algo que
          ninguem informou.
        */
        <>
          <dl className="text-muted-foreground mt-4 grid grid-cols-3 gap-x-4 border-t pt-3 text-[13px]">
            <div>
              <dt>Progresso</dt>
              <dd className="text-foreground mt-0.5">—</dd>
            </div>
            <div>
              <dt>Faltam</dt>
              <dd className="text-foreground mt-0.5">—</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd className="text-foreground mt-0.5">—</dd>
            </div>
          </dl>

          <p className="text-muted-foreground mt-3 text-[13px]">
            O prazo não foi informado.{' '}
            <button
              type="button"
              onClick={() => {
                onEdit(debt);
              }}
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Completar
            </button>
          </p>
        </>
      )}
    </li>
  );
}
