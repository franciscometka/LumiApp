'use client';

import { Pencil, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { MoneyText } from '@/components/finan/money-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSheetSession } from '@/components/ui/sheet-session';
import type { PlanProgress } from '@/domain/calculations/plan-progress';
import type { PeriodTemporality } from '@/domain/shared/period';
import { absMoney } from '@/domain/shared/money';

import { useMonthlySnapshot } from '../dashboard/use-monthly-snapshot';
import { useSelectedMonth } from '../period/use-selected-month';

import { PlanFormSheet } from './components/plan-form-sheet';
import { GoalRow, ProgressBar } from './components/progress-bar';
import type { PlanFormValues } from './plan-form';
import { validatePlanForm } from './plan-form';
import {
  useCreatePlan,
  useDeletePlan,
  useMonthlyPlan,
  usePreviousMonthPlan,
  useUpdatePlan,
} from './use-monthly-plan';

/**
 * Tela de planejamento.
 *
 * Nenhuma conta acontece aqui. Percentual, sobra, diferenca e folga vem todos
 * de `calculatePlanProgress`, dentro do snapshot — este arquivo escolhe
 * palavras e ordem, nada mais.
 *
 * A ordem no mes corrente responde a pergunta mais util primeiro:
 * quanto ainda posso gastar, depois gastos, meta e renda. Renda fica por
 * ultimo de proposito — e a linha sobre a qual a pessoa menos pode agir no
 * meio do mes.
 */
export function PlanningView() {
  const { month, label } = useSelectedMonth();

  const snapshotQuery = useMonthlySnapshot(month);
  const planQuery = useMonthlyPlan(month);
  const previousPlanQuery = usePreviousMonthPlan(month);

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();

  const [isEditing, setIsEditing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  // Formulario limpo a cada abertura e saida animada.
  const planSheet = useSheetSession(isEditing ? true : null);

  const plan = planQuery.data ?? null;
  const snapshot = snapshotQuery.data?.snapshot;

  const handleSave = async (values: PlanFormValues) => {
    const result = validatePlanForm(values);
    if (!result.ok) return;

    if (plan === null) {
      await createPlan.mutateAsync({ month, draft: result.draft });
      createPlan.reset();
    } else {
      await updatePlan.mutateAsync({ id: plan.id, month, draft: result.draft });
      updatePlan.reset();
    }

    setIsEditing(false);
  };

  if (snapshotQuery.isPending || planQuery.isPending) return <PlanningSkeleton />;

  if (snapshotQuery.isError || snapshot === undefined) {
    return (
      <div className="bg-expense-surface flex flex-col items-center gap-4 rounded-xl px-5 py-10 text-center">
        <div>
          <p className="text-expense font-medium">Não foi possível carregar o planejamento</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Seus dados continuam salvos. Nada foi alterado.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void snapshotQuery.refetch();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const progress = snapshot.plan;
  const { temporality } = snapshot;

  const isSaving = createPlan.isPending || updatePlan.isPending;
  const saveError = createPlan.error ?? updatePlan.error;

  return (
    <div className="flex flex-col gap-4">
      {!progress.hasPlan ? (
        <EmptyPlan
          monthLabel={label}
          onCreate={() => {
            setIsEditing(true);
          }}
        />
      ) : (
        <>
          <PlanHeadline progress={progress} temporality={temporality} />

          <section className="bg-card flex flex-col gap-5 rounded-xl border p-5">
            <SpendingBlock progress={progress} temporality={temporality} />
            <SavingsBlock progress={progress} temporality={temporality} />
            <IncomeBlock progress={progress} />
          </section>

          {progress.coherence.isInconsistent ? (
            <p className="bg-muted/60 rounded-lg px-4 py-3 text-[13px] leading-relaxed">
              Seu limite de gastos e sua meta de economia não cabem na renda esperada. Cumprindo o
              limite, faltariam{' '}
              <MoneyText value={absMoney(progress.coherence.slackCents)} size="sm" /> para a meta.
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsEditing(true);
              }}
            >
              <Pencil className="size-4" />
              Editar planejamento
            </Button>
            <Button
              variant="ghost"
              size="lg"
              aria-label="Remover planejamento"
              onClick={() => {
                setPendingDelete(true);
              }}
              className="text-muted-foreground hover:text-expense hover:bg-expense-surface px-3"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      )}

      {planSheet.value === null ? null : (
        <PlanFormSheet
          key={planSheet.key}
          open={planSheet.open}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditing(false);
              createPlan.reset();
              updatePlan.reset();
            }
          }}
          month={month}
          plan={plan ?? undefined}
          previousPlan={previousPlanQuery.data}
          isSaving={isSaving}
          saveError={saveError}
          onSubmit={handleSave}
        />
      )}

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Remover planejamento?"
        description="As metas deste mês são apagadas. Nenhum lançamento, cartão, dívida ou recorrência é alterado — só deixa de existir uma referência."
        confirmLabel="Remover"
        isPending={deletePlan.isPending}
        onConfirm={() => {
          if (plan === null) return;
          deletePlan.mutate(plan, {
            onSuccess: () => {
              setPendingDelete(false);
            },
          });
        }}
      />
    </div>
  );
}

/**
 * O numero principal, e ele muda de pergunta conforme o tempo do periodo.
 *
 * Num mes encerrado, "ainda posso gastar" nao e uma pergunta — ja acabou. O
 * mesmo dado vira resultado: fechou acima ou abaixo do limite.
 */
function PlanHeadline({
  progress,
  temporality,
}: {
  progress: PlanProgress;
  temporality: PeriodTemporality;
}) {
  const over = progress.remainingToSpendCents < 0;

  if (temporality === 'past') {
    return (
      <section className="bg-card rounded-xl border px-5 py-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {over ? 'Fechou acima do limite' : 'Fechou abaixo do limite'}
        </p>
        <div className="mt-2">
          <MoneyText
            value={absMoney(progress.remainingToSpendCents)}
            size="hero"
            tone={over ? 'expense' : 'income'}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          Gastou <MoneyText value={progress.committedSpendingCents} size="sm" className="text-foreground" /> de{' '}
          <MoneyText value={progress.spendingLimitCents} size="sm" className="text-foreground" />
        </p>
      </section>
    );
  }

  if (temporality === 'future') {
    return (
      <section className="bg-card rounded-xl border px-5 py-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Limite planejado
        </p>
        <div className="mt-2">
          <MoneyText value={progress.spendingLimitCents} size="hero" />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {progress.hasActivity ? (
            <>
              <MoneyText value={progress.committedSpendingCents} size="sm" className="text-foreground" />{' '}
              já lançados para este mês
            </>
          ) : (
            'Nada lançado ainda.'
          )}
        </p>
      </section>
    );
  }

  return (
    <section
      className={`rounded-xl border px-5 py-6 ${over ? 'bg-expense-surface border-transparent' : 'bg-card'}`}
    >
      <p
        className={`text-xs font-medium tracking-wide uppercase ${over ? 'text-expense' : 'text-muted-foreground'}`}
      >
        {over ? 'Acima do limite' : 'Ainda posso gastar'}
      </p>
      <div className="mt-2">
        <MoneyText
          value={absMoney(progress.remainingToSpendCents)}
          size="hero"
          tone={over ? 'expense' : 'inherit'}
        />
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        {progress.hasActivity ? (
          <>
            <MoneyText value={progress.committedSpendingCents} size="sm" className="text-foreground" /> de{' '}
            <MoneyText value={progress.spendingLimitCents} size="sm" className="text-foreground" />{' '}
            comprometidos
          </>
        ) : (
          'Nada lançado ainda neste mês.'
        )}
      </p>
    </section>
  );
}

/** Gastos: uma barra, duas camadas — pago solido, comprometido translucido. */
function SpendingBlock({
  progress,
  temporality,
}: {
  progress: PlanProgress;
  temporality: PeriodTemporality;
}) {
  return (
    <div>
      <GoalRow
        label="Gastos operacionais"
        hint="Guardar na reserva não consome o limite."
        percentage={progress.spendingPercentage}
      >
        <span>
          <MoneyText value={progress.committedSpendingCents} size="sm" /> de{' '}
          <MoneyText value={progress.spendingLimitCents} size="sm" className="text-muted-foreground" />
        </span>
      </GoalRow>

      <ProgressBar
        percentage={progress.spendingPercentage}
        secondaryPercentage={progress.paidSpendingPercentage}
        tone="expense"
      />

      {/*
        A legenda e obrigatoria: sem ela, as duas camadas da barra sao so dois
        tons de vermelho. E no mes futuro ela nem faz sentido — nada foi pago.
      */}
      {progress.pendingSpendingCents > 0 && temporality !== 'future' ? (
        <p className="text-muted-foreground mt-1.5 text-xs">
          <MoneyText value={progress.paidSpendingCents} size="sm" className="text-xs" /> pagos ·{' '}
          <MoneyText value={progress.pendingSpendingCents} size="sm" className="text-xs" /> a pagar
        </p>
      ) : null}
    </div>
  );
}

function SavingsBlock({
  progress,
  temporality,
}: {
  progress: PlanProgress;
  temporality: PeriodTemporality;
}) {
  const reached = progress.isGoalReached;
  const diff = progress.savingsDifferenceCents;

  return (
    <div>
      {/* "Economia do mês", nao "saldo": transferencias ficam fora dos dois
          lados. O saldo de caixa e o do Inicio. */}
      <GoalRow
        label="Economia do mês"
        hint="Renda gerada menos gastos operacionais."
        percentage={progress.savingsPercentage}
      >
        <span>
          <MoneyText value={progress.projectedSavingsCents} size="sm" tone="signed" /> de{' '}
          <MoneyText value={progress.savingsGoalCents} size="sm" className="text-muted-foreground" />
        </span>
      </GoalRow>

      <ProgressBar percentage={progress.savingsPercentage} tone="income" />

      {progress.savingsGoalCents === 0 ? null : (
        <p className="text-muted-foreground mt-1.5 text-xs">
          {reached ? (
            <>
              Meta {temporality === 'past' ? 'superada' : 'alcançada'} em{' '}
              <MoneyText value={absMoney(diff)} size="sm" className="text-income text-xs" />
            </>
          ) : (
            <>
              <MoneyText value={absMoney(diff)} size="sm" className="text-xs" />{' '}
              {temporality === 'past' ? 'abaixo da meta' : 'para alcançar a meta'}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function IncomeBlock({ progress }: { progress: PlanProgress }) {
  return (
    <div>
      <GoalRow
        label="Renda gerada"
        hint="Dinheiro vindo da reserva não conta."
        percentage={progress.incomePercentage}
      >
        <span>
          <MoneyText value={progress.earnedIncomeCents} size="sm" /> de{' '}
          <MoneyText value={progress.expectedIncomeCents} size="sm" className="text-muted-foreground" />
        </span>
      </GoalRow>

      <ProgressBar percentage={progress.incomePercentage} tone="income" />
    </div>
  );
}

function EmptyPlan({ monthLabel, onCreate }: { monthLabel: string; onCreate: () => void }) {
  return (
    <div className="border-border/70 flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-12 text-center">
      <Target aria-hidden className="text-muted-foreground size-7" />
      <div>
        <p className="font-medium">Sem planejamento para este mês</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Defina quanto espera receber, quanto quer gastar e quanto quer guardar.
        </p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <span className="first-letter:uppercase">Criar planejamento de {monthLabel}</span>
      </Button>
    </div>
  );
}

function PlanningSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="bg-card rounded-xl border px-5 py-6">
        <div className="bg-muted h-3 w-28 animate-pulse rounded" />
        <div className="bg-muted mt-3 h-10 w-48 animate-pulse rounded" />
      </div>
      <div className="bg-card space-y-5 rounded-xl border p-5">
        {[0, 1, 2].map((index) => (
          <div key={index}>
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
            <div className="bg-muted/70 mt-2 h-2 w-full animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
