'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { MoneyField } from '@/components/finan/money-field';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Debt } from '@/domain/entities/debt';
import { cn } from '@/lib/utils';

import type { DebtFormErrors, DebtFormValues } from '../debt-form';
import { debtValuesFrom, emptyDebtValues, validateDebtForm } from '../debt-form';

/**
 * Cadastro de divida.
 *
 * O interruptor "Sei quantas parcelas são" e o elemento central da tela, nao
 * um detalhe. Desligado — que e o padrao — os campos de prazo nem aparecem, e
 * o rascunho OMITE `totalInstallments`, `paidInstallments` e `startDate` em
 * vez de grava-los como zero.
 *
 * Essa diferenca e visivel em toda a aplicacao: com prazo omitido, a lista
 * mostra "—" em progresso, restantes e saldo; com prazo zerado, mostraria
 * "0 de 0", "quitada" e "R$ 0,00" — tres afirmacoes falsas.
 */
export function DebtFormSheet({
  open,
  onOpenChange,
  debt,
  isSaving,
  saveError,
  onSubmit,
  onRequestDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt | undefined;
  isSaving: boolean;
  saveError: Error | null;
  onSubmit: (values: DebtFormValues) => Promise<void>;
  onRequestDelete?: (() => void) | undefined;
}) {
  const fieldId = useId();
  const isEditing = debt !== undefined;

  const [values, setValues] = useState<DebtFormValues>(() =>
    debt === undefined ? emptyDebtValues() : debtValuesFrom(debt),
  );
  const [errors, setErrors] = useState<DebtFormErrors>({});

  const update = <K extends keyof DebtFormValues>(key: K, value: DebtFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validateDebtForm(values);
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
          <SheetTitle>{isEditing ? 'Editar dívida' : 'Nova dívida'}</SheetTitle>
          <SheetDescription>
            Quanto sai por mês e quando vence já bastam.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <Field label="Nome" htmlFor={`${fieldId}-name`} error={errors.name}>
            <Input
              id={`${fieldId}-name`}
              value={values.name}
              onChange={(event) => {
                update('name', event.target.value);
              }}
              aria-invalid={errors.name !== undefined}
              placeholder="Empréstimo do carro"
              maxLength={120}
              autoComplete="off"
              autoFocus={!isEditing}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id={`${fieldId}-installment`}
              label="Valor da parcela"
              value={values.installment}
              onChange={(next) => {
                update('installment', next);
              }}
              error={errors.installment}
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
                placeholder="20"
              />
            </Field>
          </div>

          <ScheduleToggle
            checked={values.knowsSchedule}
            onChange={(checked) => {
              update('knowsSchedule', checked);
            }}
          />

          {values.knowsSchedule ? (
            <div className="border-border/70 flex flex-col gap-4 rounded-lg border border-dashed p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Total de parcelas"
                  htmlFor={`${fieldId}-total`}
                  error={errors.totalInstallments}
                >
                  <Input
                    id={`${fieldId}-total`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={values.totalInstallments}
                    onChange={(event) => {
                      update('totalInstallments', event.target.value.replace(/\D/g, '').slice(0, 3));
                    }}
                    aria-invalid={errors.totalInstallments !== undefined}
                    placeholder="24"
                  />
                </Field>

                <Field
                  label="Já pagas"
                  htmlFor={`${fieldId}-paid`}
                  error={errors.paidInstallments}
                >
                  <Input
                    id={`${fieldId}-paid`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={values.paidInstallments}
                    onChange={(event) => {
                      update('paidInstallments', event.target.value.replace(/\D/g, '').slice(0, 3));
                    }}
                    aria-invalid={errors.paidInstallments !== undefined}
                    placeholder="9"
                  />
                </Field>
              </div>

              <Field
                label="Primeira parcela"
                htmlFor={`${fieldId}-start`}
                error={errors.startDate}
                hint="Opcional. Serve para calcular o mês da última parcela."
              >
                <Input
                  id={`${fieldId}-start`}
                  type="date"
                  value={values.startDate}
                  onChange={(event) => {
                    update('startDate', event.target.value);
                  }}
                  aria-invalid={errors.startDate !== undefined}
                />
              </Field>
            </div>
          ) : null}

          <Field label="Observação" htmlFor={`${fieldId}-notes`}>
            <Textarea
              id={`${fieldId}-notes`}
              value={values.notes}
              onChange={(event) => {
                update('notes', event.target.value);
              }}
              maxLength={1000}
              placeholder="Opcional"
            />
          </Field>

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
                aria-label="Excluir dívida"
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

/**
 * "Sei quantas parcelas são" — desligado por padrao.
 *
 * O padrao importa: ligado, o formulario pediria um numero que a pessoa pode
 * nao ter, e o caminho de menor resistencia seria chutar. Desligado, nao
 * saber e o caso normal e preencher e que e a acao deliberada.
 */
function ScheduleToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className="border-input hover:bg-accent/50 flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">Sei quantas parcelas são</span>
        <span className="text-muted-foreground block text-xs">
          {checked ? 'Progresso e saldo serão calculados.' : 'Sem isso, o app não estima o prazo.'}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-4 rounded-full bg-white transition-all',
            checked ? 'left-5' : 'left-1',
          )}
        />
      </span>
    </button>
  );
}
