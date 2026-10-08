'use client';

import { HandCoins, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSheetSession } from '@/components/ui/sheet-session';
import type { Debt } from '@/domain/entities/debt';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { availableForLinking } from '../transactions/link-options';

import { DebtFormSheet } from './components/debt-form-sheet';
import { DebtRow } from './components/debt-row';
import type { DebtFormValues } from './debt-form';
import { validateDebtForm } from './debt-form';
import {
  useCreateDebt,
  useDebts,
  useDeleteDebt,
  useRestoreDebt,
  useSetPaidInstallments,
  useUpdateDebt,
} from './use-debts';

/**
 * Tela de dividas e emprestimos.
 *
 * Dar baixa altera SOMENTE `paidInstallments`. Nenhuma transacao e criada:
 * uma transacao com `debtId` significa "este lancamento se relaciona a esta
 * divida", nunca "avance o contador". Duas fontes tentando se sincronizar
 * divergem no primeiro caso de borda.
 */
export function DebtsView() {
  const today = useMemo(() => todayPlainDate(), []);

  const debtsQuery = useDebts();
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const setPaid = useSetPaidInstallments();
  const deleteDebt = useDeleteDebt();
  const restoreDebt = useRestoreDebt();

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Debt | null>(null);
  const [justDeleted, setJustDeleted] = useState<Debt | null>(null);

  // Sessoes das Sheets: formulario limpo a cada abertura e saida animada.
  const createSheet = useSheetSession(isCreating ? true : null);
  const editSheet = useSheetSession(editing);

  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);

  const visible = useMemo(
    () =>
      availableForLinking(debts).sort(
        (a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [debts],
  );

  const handleCreate = async (values: DebtFormValues) => {
    const result = validateDebtForm(values);
    if (!result.ok) return;

    await createDebt.mutateAsync(result.draft);
    setIsCreating(false);
    createDebt.reset();
  };

  const handleUpdate = async (values: DebtFormValues) => {
    if (editing === null) return;
    const result = validateDebtForm(values);
    if (!result.ok) return;

    await updateDebt.mutateAsync({ id: editing.id, draft: result.draft });
    setEditing(null);
    updateDebt.reset();
  };

  const confirmDelete = async () => {
    if (pendingDelete === null) return;
    const target = pendingDelete;

    await deleteDebt.mutateAsync(target);
    setPendingDelete(null);
    setEditing(null);
    setJustDeleted(target);
  };

  if (debtsQuery.isPending) return <DebtsSkeleton />;

  if (debtsQuery.isError) {
    return (
      <div className="bg-expense-surface flex flex-col items-center gap-4 rounded-xl px-5 py-10 text-center">
        <div>
          <p className="text-expense font-medium">Não foi possível carregar as dívidas</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Seus dados continuam salvos. Nada foi alterado.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void debtsQuery.refetch();
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
          <HandCoins aria-hidden className="text-muted-foreground size-7" />
          <div>
            <p className="font-medium">Nenhuma dívida cadastrada</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Basta saber quanto sai por mês e quando vence.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus className="size-4" />
            Nova dívida
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {visible.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                today={today}
                onEdit={setEditing}
                onAdvance={(target, paidInstallments) => {
                  setPaid.mutate({ id: target.id, paidInstallments });
                }}
                isAdvancing={setPaid.isPending && setPaid.variables?.id === debt.id}
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
            Nova dívida
          </Button>
        </>
      )}

      {setPaid.isError ? (
        <p role="alert" className="bg-expense-surface text-expense rounded-lg px-4 py-3 text-sm">
          Não foi possível registrar a parcela. O progresso continua como estava.
        </p>
      ) : null}

      {justDeleted === null ? null : (
        <div
          role="status"
          className="bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-muted-foreground">Dívida excluída: </span>
            {justDeleted.name}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={restoreDebt.isPending}
              onClick={() => {
                restoreDebt.mutate(justDeleted, {
                  onSuccess: () => {
                    setJustDeleted(null);
                  },
                });
              }}
            >
              {restoreDebt.isPending ? 'Restaurando' : 'Desfazer'}
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

      {createSheet.value === null ? null : (
        <DebtFormSheet
          key={createSheet.key}
          open={createSheet.open}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              createDebt.reset();
            }
          }}
          isSaving={createDebt.isPending}
          saveError={createDebt.error}
          onSubmit={handleCreate}
        />
      )}

      {editSheet.value === null ? null : (
        <DebtFormSheet
          key={editSheet.key}
          open={editSheet.open}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              updateDebt.reset();
            }
          }}
          debt={editSheet.value}
          isSaving={updateDebt.isPending}
          saveError={updateDebt.error}
          onSubmit={handleUpdate}
          onRequestDelete={() => {
            setPendingDelete(editSheet.value);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir dívida?"
        description={
          pendingDelete === null
            ? ''
            : `"${pendingDelete.name}" sai da lista e deixa de ser oferecida em novos lançamentos. Os pagamentos já registrados continuam como estão.`
        }
        confirmLabel="Excluir"
        isPending={deleteDebt.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}

function DebtsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {[0, 1].map((index) => (
        <div key={index} className="bg-card space-y-4 rounded-xl border p-5">
          <div className="bg-muted h-4 w-36 animate-pulse rounded" />
          <div className="bg-muted/70 h-1.5 w-full animate-pulse rounded-full" />
          <div className="bg-muted/70 h-9 w-full animate-pulse rounded-lg" />
        </div>
      ))}
    </div>
  );
}
