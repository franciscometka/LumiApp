'use client';

import { Loader2 } from 'lucide-react';
import { useId, useState } from 'react';

import { MoneyField } from '@/components/finan/money-field';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Card } from '@/domain/entities/card';
import { formatMoneyPlain } from '@/domain/shared/money';

import { validateInvoice } from '../card-form';

/**
 * Atualizacao rapida da fatura: um campo e um botao.
 *
 * E a acao que se repete todo mes, em todos os cartoes. Obrigar a passar pelo
 * cadastro completo para digitar um numero que a pessoa acabou de ler no app
 * do banco seria atrito puro — e atrito aqui significa fatura desatualizada,
 * que e justamente o que torna a tela inutil.
 */
export function InvoiceSheet({
  open,
  onOpenChange,
  card,
  isSaving,
  saveError,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card;
  isSaving: boolean;
  saveError: Error | null;
  onSubmit: (raw: string) => Promise<void>;
}) {
  const fieldId = useId();
  const [value, setValue] = useState(() => formatMoneyPlain(card.currentInvoiceCents));
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    if (validateInvoice(value) === null) {
      setError('Valor inválido. Use vírgula para os centavos.');
      return;
    }

    setError(undefined);
    await onSubmit(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive" className="gap-0">
        <SheetHeader className="pr-8">
          <SheetTitle>Fatura do {card.name}</SheetTitle>
          <SheetDescription>O valor que aparece hoje no app do banco.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <MoneyField
            id={`${fieldId}-invoice`}
            label="Fatura atual"
            value={value}
            onChange={(next) => {
              setValue(next);
              setError(undefined);
            }}
            error={error}
          />

          {saveError === null ? null : (
            <p
              role="alert"
              className="bg-expense-surface text-expense rounded-lg px-3 py-2.5 text-sm font-medium"
            >
              Não foi possível salvar. A fatura continua como estava.
            </p>
          )}

          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando
              </>
            ) : (
              'Salvar fatura'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
