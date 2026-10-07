'use client';

import { CreditCard, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildCardOverview, sortCardsByDueDate } from '@/domain/calculations/cards';
import type { Card } from '@/domain/entities/card';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { availableForLinking } from '../transactions/link-options';

import type { CardFormValues } from './card-form';
import { validateCardForm, validateInvoice } from './card-form';
import { CardFormSheet } from './components/card-form-sheet';
import { CardRow } from './components/card-row';
import { InvoiceSheet } from './components/invoice-sheet';
import {
  useCards,
  useCreateCard,
  useDeleteCard,
  useRestoreCard,
  useUpdateCard,
  useUpdateInvoice,
} from './use-cards';

/**
 * Tela de cartoes.
 *
 * Nenhum total agregado aqui. O Dashboard ja responde "quanto tenho a pagar"
 * a partir das transacoes; somar faturas informadas nesta tela criaria um
 * segundo numero para a mesma pergunta, e dois numeros diferentes para a
 * mesma pergunta e pior do que um.
 */
export function CardsView() {
  const today = useMemo(() => todayPlainDate(), []);

  const cardsQuery = useCards();
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const updateInvoice = useUpdateInvoice();
  const deleteCard = useDeleteCard();
  const restoreCard = useRestoreCard();

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<Card | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Card | null>(null);
  const [justDeleted, setJustDeleted] = useState<Card | null>(null);

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);

  // Excluidos ficam no cache para resolver vinculos historicos, mas nao
  // aparecem na lista.
  const visible = useMemo(
    () => sortCardsByDueDate(availableForLinking(cards), today),
    [cards, today],
  );

  const handleCreate = async (values: CardFormValues) => {
    const result = validateCardForm(values);
    if (!result.ok) return;

    await createCard.mutateAsync(result.draft);
    setIsCreating(false);
    createCard.reset();
  };

  const handleUpdate = async (values: CardFormValues) => {
    if (editing === null) return;
    const result = validateCardForm(values);
    if (!result.ok) return;

    await updateCard.mutateAsync({ id: editing.id, draft: result.draft });
    setEditing(null);
    updateCard.reset();
  };

  const handleInvoice = async (raw: string) => {
    if (invoiceTarget === null) return;
    const invoiceCents = validateInvoice(raw);
    if (invoiceCents === null) return;

    await updateInvoice.mutateAsync({ id: invoiceTarget.id, invoiceCents });
    setInvoiceTarget(null);
    updateInvoice.reset();
  };

  const confirmDelete = async () => {
    if (pendingDelete === null) return;
    const target = pendingDelete;

    await deleteCard.mutateAsync(target);
    setPendingDelete(null);
    setEditing(null);
    setJustDeleted(target);
  };

  if (cardsQuery.isPending) return <CardsSkeleton />;

  if (cardsQuery.isError) {
    return (
      <div className="bg-expense-surface flex flex-col items-center gap-4 rounded-xl px-5 py-10 text-center">
        <div>
          <p className="text-expense font-medium">Não foi possível carregar os cartões</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Seus dados continuam salvos. Nada foi alterado.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void cardsQuery.refetch();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.length === 0 ? (
        <div className="border-border/70 flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-12 text-center">
          <CreditCard aria-hidden className="text-muted-foreground size-7" />
          <div>
            <p className="font-medium">Nenhum cartão cadastrado</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Cadastre para acompanhar fatura, limite e vencimento num lugar só.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus className="size-4" />
            Novo cartão
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {visible.map((card) => (
              <CardRow
                key={card.id}
                overview={buildCardOverview(card, today)}
                onEdit={setEditing}
                onUpdateInvoice={setInvoiceTarget}
              />
            ))}
          </ul>

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus className="size-4" />
            Novo cartão
          </Button>
        </>
      )}

      {justDeleted === null ? null : (
        <div
          role="status"
          className="bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-muted-foreground">Cartão excluído: </span>
            {justDeleted.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={restoreCard.isPending}
              onClick={() => {
                restoreCard.mutate(justDeleted, {
                  onSuccess: () => {
                    setJustDeleted(null);
                  },
                });
              }}
            >
              {restoreCard.isPending ? 'Restaurando' : 'Desfazer'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setJustDeleted(null);
              }}
            >
              OK
            </Button>
          </div>
        </div>
      )}

      {isCreating ? (
        <CardFormSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              createCard.reset();
            }
          }}
          isSaving={createCard.isPending}
          saveError={createCard.error}
          onSubmit={handleCreate}
        />
      ) : null}

      {editing === null ? null : (
        <CardFormSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              updateCard.reset();
            }
          }}
          card={editing}
          isSaving={updateCard.isPending}
          saveError={updateCard.error}
          onSubmit={handleUpdate}
          onRequestDelete={() => {
            setPendingDelete(editing);
          }}
        />
      )}

      {invoiceTarget === null ? null : (
        <InvoiceSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setInvoiceTarget(null);
              updateInvoice.reset();
            }
          }}
          card={invoiceTarget}
          isSaving={updateInvoice.isPending}
          saveError={updateInvoice.error}
          onSubmit={handleInvoice}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir cartão?"
        /*
          O texto diz exatamente o que NAO acontece. "Excluir" costuma assustar
          justamente porque a pessoa nao sabe se leva o historico junto.
        */
        description={
          pendingDelete === null
            ? ''
            : `"${pendingDelete.name}" sai da lista e deixa de ser oferecido em novos lançamentos. Os gastos já registrados continuam como estão.`
        }
        confirmLabel="Excluir"
        isPending={deleteCard.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {[0, 1].map((index) => (
        <div key={index} className="bg-card space-y-4 rounded-xl border p-5">
          <div className="bg-muted h-4 w-28 animate-pulse rounded" />
          <div className="bg-muted h-7 w-40 animate-pulse rounded" />
          <div className="bg-muted/70 h-1.5 w-full animate-pulse rounded-full" />
          <div className="bg-muted/70 h-9 w-full animate-pulse rounded-lg" />
        </div>
      ))}
    </div>
  );
}
