'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { MoneyField } from '@/components/finan/money-field';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Category } from '@/domain/entities/category';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/domain/entities/transaction';
import type { PaymentMethod, TransactionType } from '@/domain/entities/transaction';
import type { MonthKey } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

import type { RecurringFormErrors, RecurringFormValues } from '../recurring-form';
import {
  categoriesForType,
  changeType,
  emptyRecurringValues,
  recurringValuesFrom,
  validateRecurringForm,
} from '../recurring-form';
import type { RecurringBill } from '@/domain/entities/recurring-bill';

/**
 * Cadastro de conta recorrente.
 *
 * Montado apenas enquanto aberto, como as demais sheets do app.
 *
 * O campo "Último mês" existe aqui, mas a acao de encerrar tambem aparece na
 * propria linha da lista — encerrar e frequente o bastante para nao exigir
 * abrir o formulario inteiro.
 */
export function RecurringFormSheet({
  open,
  onOpenChange,
  bill,
  categories,
  currentMonth,
  isSaving,
  saveError,
  onSubmit,
  onRequestDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: RecurringBill | undefined;
  categories: readonly Category[];
  currentMonth: MonthKey;
  isSaving: boolean;
  saveError: Error | null;
  onSubmit: (values: RecurringFormValues) => Promise<void>;
  onRequestDelete?: (() => void) | undefined;
}) {
  const fieldId = useId();
  const isEditing = bill !== undefined;

  const [values, setValues] = useState<RecurringFormValues>(() =>
    bill === undefined ? emptyRecurringValues(currentMonth) : recurringValuesFrom(bill),
  );
  const [errors, setErrors] = useState<RecurringFormErrors>({});

  const available = categoriesForType(categories, values.type);

  const update = <K extends keyof RecurringFormValues>(
    key: K,
    value: RecurringFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validateRecurringForm(values, categories);
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
          <SheetTitle>{isEditing ? 'Editar recorrência' : 'Nova conta recorrente'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Alterações valem para os meses que ainda não foram lançados.'
              : 'O lançamento aparece sozinho em cada mês.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <TypeToggle
            value={values.type}
            onChange={(type) => {
              setValues((current) => changeType(current, type, categories));
              setErrors((current) => ({ ...current, categoryId: undefined }));
            }}
          />

          <Field
            label="Descrição"
            htmlFor={`${fieldId}-description`}
            error={errors.description}
          >
            <Input
              id={`${fieldId}-description`}
              value={values.description}
              onChange={(event) => {
                update('description', event.target.value);
              }}
              aria-invalid={errors.description !== undefined}
              placeholder={values.type === 'income' ? 'Salário' : 'Internet'}
              maxLength={120}
              autoComplete="off"
              autoFocus={!isEditing}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id={`${fieldId}-amount`}
              label="Valor"
              value={values.amount}
              onChange={(next) => {
                update('amount', next);
              }}
              error={errors.amount}
            />

            <Field label="Vence dia" htmlFor={`${fieldId}-due`} error={errors.dueDay}>
              <Input
                id={`${fieldId}-due`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.dueDay}
                onChange={(event) => {
                  update('dueDay', event.target.value.replace(/\D/g, '').slice(0, 2));
                }}
                aria-invalid={errors.dueDay !== undefined}
                placeholder="10"
              />
            </Field>
          </div>

          <Field label="Categoria" htmlFor={`${fieldId}-category`} error={errors.categoryId}>
            <Select
              id={`${fieldId}-category`}
              value={values.categoryId}
              onChange={(event) => {
                update('categoryId', event.target.value);
              }}
              aria-invalid={errors.categoryId !== undefined}
            >
              <option value="">Selecione</option>
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Primeiro mês"
              htmlFor={`${fieldId}-start`}
              error={errors.startMonth}
            >
              {/*
                `type="month"` devolve "YYYY-MM" — exatamente o formato de
                `MonthKey`. Nenhum `Date` e construido e nenhum fuso horario
                entra numa pergunta que nem tem hora.
              */}
              <Input
                id={`${fieldId}-start`}
                type="month"
                value={values.startMonth}
                onChange={(event) => {
                  update('startMonth', event.target.value);
                }}
                aria-invalid={errors.startMonth !== undefined}
              />
            </Field>

            <Field
              label="Último mês"
              htmlFor={`${fieldId}-end`}
              error={errors.endMonth}
              hint="Em branco = sem término."
            >
              <Input
                id={`${fieldId}-end`}
                type="month"
                value={values.endMonth}
                onChange={(event) => {
                  update('endMonth', event.target.value);
                }}
                aria-invalid={errors.endMonth !== undefined}
              />
            </Field>
          </div>

          <Field label="Forma de pagamento" htmlFor={`${fieldId}-method`}>
            <Select
              id={`${fieldId}-method`}
              value={values.paymentMethod}
              onChange={(event) => {
                update('paymentMethod', event.target.value as PaymentMethod);
              }}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </Field>

          {isEditing ? (
            <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
              Lançamentos já criados não mudam. Se a Internet passou de R$ 120 para R$ 150, os
              meses anteriores continuam R$ 120.
            </p>
          ) : null}

          {saveError === null ? null : (
            <p
              role="alert"
              className="bg-expense-surface text-expense rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              Não foi possível salvar. Nada foi alterado — tente de novo.
            </p>
          )}

          <div className="mt-1 flex items-center gap-2">
            <Button type="submit" size="lg" className="flex-1" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando
                </>
              ) : (
                'Salvar'
              )}
            </Button>

            {isEditing && onRequestDelete !== undefined ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onRequestDelete}
                disabled={isSaving}
                aria-label="Excluir recorrência"
                className="text-muted-foreground hover:text-expense hover:bg-expense-surface px-3"
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}) {
  return (
    <div role="group" aria-label="Tipo" className="grid grid-cols-2 gap-2">
      {(
        [
          { type: 'expense', label: 'Gasto', sign: '−' },
          { type: 'income', label: 'Entrada', sign: '+' },
        ] as const
      ).map((option) => {
        const selected = value === option.type;
        return (
          <button
            key={option.type}
            type="button"
            onClick={() => {
              onChange(option.type);
            }}
            aria-pressed={selected}
            className={cn(
              'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-[15px] transition-colors',
              selected
                ? option.type === 'income'
                  ? 'border-income bg-income-surface text-income font-semibold'
                  : 'border-expense bg-expense-surface text-expense font-semibold'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            <span aria-hidden className="font-semibold">
              {option.sign}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
