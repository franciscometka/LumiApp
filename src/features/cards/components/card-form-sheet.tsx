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
import type { Card } from '@/domain/entities/card';
import { CATEGORY_COLOR_TOKENS } from '@/domain/entities/category';
import type { CategoryColorToken } from '@/domain/entities/category';

import type { CardFormErrors, CardFormValues } from '../card-form';
import { cardValuesFrom, emptyCardValues, validateCardForm } from '../card-form';
import { CardNameConflictError } from '../use-cards';


/**
 * Cadastro de cartao, criar e editar.
 *
 * Montado apenas enquanto aberto, como a sheet de transacao — o estado nasce
 * nos inicializadores e fechar desmonta, entao nao sobra rascunho nem dado do
 * cartao anterior.
 */
export function CardFormSheet({
  open,
  onOpenChange,
  card,
  isSaving,
  saveError,
  onSubmit,
  onRequestDelete,
  existingCards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Card | undefined;
  isSaving: boolean;
  saveError: Error | null;
  onSubmit: (values: CardFormValues) => Promise<void>;
  onRequestDelete?: (() => void) | undefined;
  /** Para a regra de nome unico. Pode incluir excluidos: a regra os ignora. */
  existingCards: readonly Card[];
}) {
  const fieldId = useId();
  const isEditing = card !== undefined;

  const [values, setValues] = useState<CardFormValues>(() =>
    card === undefined ? emptyCardValues() : cardValuesFrom(card),
  );
  const [errors, setErrors] = useState<CardFormErrors>({});

  const update = <K extends keyof CardFormValues>(key: K, value: CardFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validateCardForm(values, existingCards, card?.id);
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
          <SheetTitle>{isEditing ? 'Editar cartão' : 'Novo cartão'}</SheetTitle>
          <SheetDescription>
            A fatura é o valor que você lê no app do banco.
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
              placeholder="Inter"
              maxLength={120}
              autoComplete="off"
              autoFocus={!isEditing}
            />
          </Field>

          <MoneyField
            id={`${fieldId}-invoice`}
            label="Fatura atual"
            value={values.invoice}
            onChange={(next) => {
              update('invoice', next);
            }}
            error={errors.invoice}
            hint="Deixe em branco se não há fatura aberta."
          />

          <MoneyField
            id={`${fieldId}-limit`}
            label="Limite"
            value={values.limit}
            onChange={(next) => {
              update('limit', next);
            }}
            error={errors.limit}
            hint="Em branco se você prefere não acompanhar o limite."
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Fecha dia"
              htmlFor={`${fieldId}-closing`}
              error={errors.closingDay}
            >
              <Input
                id={`${fieldId}-closing`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={values.closingDay}
                onChange={(event) => {
                  update('closingDay', event.target.value.replace(/\D/g, '').slice(0, 2));
                }}
                aria-invalid={errors.closingDay !== undefined}
                placeholder="20"
              />
            </Field>

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
                placeholder="28"
              />
            </Field>
          </div>

          <Field
            label="Cor"
            htmlFor={`${fieldId}-color`}
            hint="Usada para identificar o cartão na lista."
          >
            <Select
              id={`${fieldId}-color`}
              value={values.colorToken}
              onChange={(event) => {
                update('colorToken', event.target.value as CategoryColorToken);
              }}
            >
              {CATEGORY_COLOR_TOKENS.map((token, index) => (
                <option key={token} value={token}>
                  {COLOR_NAMES[index] ?? token}
                </option>
              ))}
            </Select>
          </Field>

          {saveError === null ? null : (
            <p
              role="alert"
              className="bg-expense-surface text-expense rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              {saveError instanceof CardNameConflictError
                ? saveError.message
                : 'Não foi possível salvar. Nada foi alterado — tente de novo.'}
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
                aria-label="Excluir cartão"
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

/** Nomes humanos para os tokens da escala validada. */
const COLOR_NAMES = ['Roxo', 'Azul', 'Verde', 'Âmbar', 'Vermelho'] as const;
