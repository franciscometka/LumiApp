'use client';

import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';

import { MoneyField } from '@/components/finan/money-field';
import { MoneyText } from '@/components/finan/money-text';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import { formatMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import type { PlanFormErrors, PlanFormValues } from '../plan-form';
import {
  emptyPlanValues,
  planValuesCopiedFrom,
  planValuesFrom,
  previewCoherence,
  validatePlanForm,
} from '../plan-form';

/**
 * Formulario do planejamento: tres campos.
 *
 * A unica sofisticacao e o aviso de coerencia, que roda enquanto a pessoa
 * digita e explica a CONSEQUENCIA em vez de julgar o plano. "Inconsistente" e
 * um fato aritmetico, nao um erro do usuario — e por isso nunca bloqueia o
 * salvamento.
 */
export function PlanFormSheet({
  open,
  onOpenChange,
  month,
  plan,
  previousPlan,
  isSaving,
  saveError,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: MonthKey;
  plan?: MonthlyPlan | undefined;
  /** Plano do mes anterior, se existir. Habilita "usar valores de X". */
  previousPlan?: MonthlyPlan | null | undefined;
  isSaving: boolean;
  saveError: Error | null;
  onSubmit: (values: PlanFormValues) => Promise<void>;
}) {
  const fieldId = useId();
  const isEditing = plan !== undefined;

  const [values, setValues] = useState<PlanFormValues>(() =>
    plan === undefined ? emptyPlanValues() : planValuesFrom(plan),
  );
  const [errors, setErrors] = useState<PlanFormErrors>({});

  const coherence = previewCoherence(values);

  const update = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validatePlanForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    setErrors({});
    await onSubmit(values);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="gap-0 overflow-y-auto">
        <SheetHeader className="pr-8">
          <SheetTitle className="first-letter:uppercase">
            {isEditing ? 'Editar planejamento' : `Planejamento de ${formatMonthKey(month)}`}
          </SheetTitle>
          <SheetDescription>Metas do mês. Não alteram nenhum lançamento.</SheetDescription>
        </SheetHeader>

        {/*
          Copiar do mes anterior apenas PREENCHE. Nao salva, nao cria plano, nao
          toca no mes de origem — a pessoa revisa e decide. Some quando nao ha
          plano anterior.
        */}
        {!isEditing && previousPlan !== null && previousPlan !== undefined ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 self-start"
            onClick={() => {
              setValues(planValuesCopiedFrom(previousPlan));
              setErrors({});
            }}
          >
            <span className="first-letter:uppercase">
              Usar valores de {formatMonthKey(previousPlan.month)}
            </span>
          </Button>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
          <MoneyField
            id={`${fieldId}-income`}
            label="Renda esperada"
            value={values.expectedIncome}
            onChange={(next) => {
              update('expectedIncome', next);
            }}
            error={errors.expectedIncome}
            hint="Quanto você espera receber no mês."
          />

          <MoneyField
            id={`${fieldId}-limit`}
            label="Limite de gastos"
            value={values.spendingLimit}
            onChange={(next) => {
              update('spendingLimit', next);
            }}
            error={errors.spendingLimit}
            hint="O máximo que você quer gastar."
          />

          <MoneyField
            id={`${fieldId}-goal`}
            label="Meta de economia"
            value={values.savingsGoal}
            onChange={(next) => {
              update('savingsGoal', next);
            }}
            error={errors.savingsGoal}
            hint="Quanto você quer que sobre no fim do mês."
          />

          {coherence === null ? null : coherence.isInconsistent ? (
            /*
              Explica a consequencia, nao julga o plano. O numero vem do
              dominio; a frase so o traduz.
            */
            <p className="bg-muted/60 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed">
              Com esse limite, o mês fecharia com{' '}
              <MoneyText value={coherence.actualClosingCents} size="sm" tone="signed" />, abaixo
              da meta de <MoneyText value={coherence.savingsGoalCents} size="sm" />. Você pode
              salvar assim mesmo.
            </p>
          ) : (
            <p className="text-muted-foreground text-[13px]">
              Sobra planejada:{' '}
              <MoneyText value={coherence.slackCents} size="sm" tone="signed" className="text-foreground" />{' '}
              além da meta.
            </p>
          )}

          {saveError === null ? null : (
            <p
              role="alert"
              className="bg-expense-surface text-expense rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              Não foi possível salvar. Nada foi alterado — tente de novo.
            </p>
          )}

          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando
              </>
            ) : (
              'Salvar planejamento'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
