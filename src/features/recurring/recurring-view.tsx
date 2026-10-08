'use client';

import { Pencil, Plus, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';

import { MoneyText } from '@/components/finan/money-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSheetSession } from '@/components/ui/sheet-session';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import { formatMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

import { useSelectedMonth } from '../period/use-selected-month';
import { useCategories } from '../transactions/use-transactions';

import { RecurringFormSheet } from './components/recurring-form-sheet';
import type { RecurringFormValues } from './recurring-form';
import { hasEnded, validateRecurringForm } from './recurring-form';
import {
  useCreateRecurringBill,
  useDeleteRecurringBill,
  useEndRecurringBill,
  useRecurringBills,
  useReopenRecurringBill,
  useRestoreRecurringBill,
  useUpdateRecurringBill,
} from './use-recurring-bills';

/**
 * Tela de contas recorrentes.
 *
 * Separa visualmente os TRES estados que o briefing pediu:
 *
 * - **ativa** — ainda gera ocorrencia;
 * - **encerrada** — tem `endMonth` ja no passado; continua na lista, com o
 *   historico que gerou, mas nao gera mais;
 * - **excluida** — fora da lista, historico preservado.
 *
 * Encerrar e excluir ficam em lugares diferentes de proposito. Encerrar e um
 * fato ("cancelei a Netflix em marco") e mora na linha. Excluir e correcao de
 * cadastro e mora dentro da edicao, com confirmacao.
 */
export function RecurringView() {
  const { month } = useSelectedMonth();

  const billsQuery = useRecurringBills();
  const categoriesQuery = useCategories();

  const createBill = useCreateRecurringBill();
  const updateBill = useUpdateRecurringBill();
  const endBill = useEndRecurringBill();
  const reopenBill = useReopenRecurringBill();
  const deleteBill = useDeleteRecurringBill();
  const restoreBill = useRestoreRecurringBill();

  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecurringBill | null>(null);
  const [pendingEnd, setPendingEnd] = useState<RecurringBill | null>(null);
  const [justDeleted, setJustDeleted] = useState<RecurringBill | null>(null);

  // Sessoes das Sheets: formulario limpo a cada abertura e saida animada.
  const createSheet = useSheetSession(isCreating ? true : null);
  const editSheet = useSheetSession(editing);

  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category.name]));
    return (id: string) => byId.get(id) ?? null;
  }, [categories]);

  const { active, ended } = useMemo(() => {
    // Excluidas ficam no cache para resolver vinculos historicos, mas fora da
    // lista. `availableForLinking` nao serve aqui: ele espera `name`, e a
    // recorrencia usa `description`.
    const visible = bills
      .filter((bill) => bill.deletedAt === undefined)
      .sort((a, b) => a.dueDay - b.dueDay || a.description.localeCompare(b.description, 'pt-BR'));

    return {
      active: visible.filter((bill) => !hasEnded(bill, month)),
      ended: visible.filter((bill) => hasEnded(bill, month)),
    };
  }, [bills, month]);

  const handleCreate = async (values: RecurringFormValues) => {
    const result = validateRecurringForm(values, categories);
    if (!result.ok) return;

    await createBill.mutateAsync(result.draft);
    setIsCreating(false);
    createBill.reset();
  };

  const handleUpdate = async (values: RecurringFormValues) => {
    if (editing === null) return;
    const result = validateRecurringForm(values, categories);
    if (!result.ok) return;

    await updateBill.mutateAsync({ id: editing.id, draft: result.draft });
    setEditing(null);
    updateBill.reset();
  };

  if (billsQuery.isPending || categoriesQuery.isPending) return <RecurringSkeleton />;

  if (billsQuery.isError || categoriesQuery.isError) {
    return (
      <div className="bg-expense-surface flex flex-col items-center gap-4 rounded-xl px-5 py-10 text-center">
        <div>
          <p className="text-expense font-medium">Não foi possível carregar as recorrências</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Seus dados continuam salvos. Nada foi alterado.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void billsQuery.refetch();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {active.length === 0 && ended.length === 0 ? (
        <div className="border-border/70 flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-12 text-center">
          <Repeat aria-hidden className="text-muted-foreground size-7" />
          <div>
            <p className="font-medium">Nenhuma conta recorrente</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Cadastre o que se repete todo mês e pare de lançar na mão.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus className="size-4" />
            Nova conta recorrente
          </Button>
        </div>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {active.map((bill) => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  month={month}
                  categoryName={categoryName(bill.categoryId)}
                  onEdit={setEditing}
                  onEnd={setPendingEnd}
                />
              ))}
            </ul>
          ) : null}

          {ended.length > 0 ? (
            <section>
              <h2 className="text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
                Encerradas
              </h2>
              <ul className="flex flex-col gap-3">
                {ended.map((bill) => (
                  <BillRow
                    key={bill.id}
                    bill={bill}
                    month={month}
                    categoryName={categoryName(bill.categoryId)}
                    onEdit={setEditing}
                    onReopen={(target) => {
                      reopenBill.mutate(target.id);
                    }}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            <Plus className="size-4" />
            Nova conta recorrente
          </Button>
        </>
      )}

      {justDeleted === null ? null : (
        <div
          role="status"
          className="bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
        >
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-muted-foreground">Recorrência excluída: </span>
            {justDeleted.description}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={restoreBill.isPending}
              onClick={() => {
                restoreBill.mutate(justDeleted, {
                  onSuccess: () => {
                    setJustDeleted(null);
                  },
                });
              }}
            >
              {restoreBill.isPending ? 'Restaurando' : 'Desfazer'}
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
        <RecurringFormSheet
          key={createSheet.key}
          open={createSheet.open}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreating(false);
              createBill.reset();
            }
          }}
          categories={categories}
          currentMonth={month}
          isSaving={createBill.isPending}
          saveError={createBill.error}
          onSubmit={handleCreate}
        />
      )}

      {editSheet.value === null ? null : (
        <RecurringFormSheet
          key={editSheet.key}
          open={editSheet.open}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              updateBill.reset();
            }
          }}
          bill={editSheet.value}
          categories={categories}
          currentMonth={month}
          isSaving={updateBill.isPending}
          saveError={updateBill.error}
          onSubmit={handleUpdate}
          onRequestDelete={() => {
            setPendingDelete(editSheet.value);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingEnd !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEnd(null);
        }}
        title="Encerrar recorrência?"
        description={
          pendingEnd === null
            ? ''
            : `"${pendingEnd.description}" ainda gera o lançamento de ${formatMonthKey(month)} e para a partir do mês seguinte. Nada do que já foi lançado muda.`
        }
        confirmLabel="Encerrar"
        tone="default"
        isPending={endBill.isPending}
        onConfirm={() => {
          if (pendingEnd === null) return;
          endBill.mutate(
            { id: pendingEnd.id, endMonth: month },
            {
              onSuccess: () => {
                setPendingEnd(null);
              },
            },
          );
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir recorrência?"
        description={
          pendingDelete === null
            ? ''
            : `"${pendingDelete.description}" sai do cadastro e para de gerar lançamentos. Os lançamentos que ela já criou continuam como estão.`
        }
        confirmLabel="Excluir"
        isPending={deleteBill.isPending}
        onConfirm={() => {
          if (pendingDelete === null) return;
          const target = pendingDelete;
          deleteBill.mutate(target, {
            onSuccess: () => {
              setPendingDelete(null);
              setEditing(null);
              setJustDeleted(target);
            },
          });
        }}
      />
    </div>
  );
}

function BillRow({
  bill,
  month,
  categoryName,
  onEdit,
  onEnd,
  onReopen,
}: {
  bill: RecurringBill;
  month: MonthKey;
  categoryName: string | null;
  onEdit: (bill: RecurringBill) => void;
  onEnd?: (bill: RecurringBill) => void;
  onReopen?: (bill: RecurringBill) => void;
}) {
  const income = bill.type === 'income';
  const ended = hasEnded(bill, month);

  return (
    <li className={cn('bg-card rounded-xl border p-5', ended && 'opacity-75')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{bill.description}</h3>
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            {categoryName ?? 'Sem categoria'} · todo dia {bill.dueDay}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-baseline gap-0.5">
            <span className="sr-only">{income ? 'Entrada de' : 'Saída de'}</span>
            <span
              aria-hidden
              className={cn('text-sm font-semibold', income ? 'text-income' : 'text-expense')}
            >
              {income ? '+' : '−'}
            </span>
            <MoneyText
              value={bill.amountCents}
              size="sm"
              tone={income ? 'income' : 'expense'}
            />
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onEdit(bill);
            }}
            aria-label={`Editar ${bill.description}`}
            className="text-muted-foreground -mt-1 -mr-2"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground mt-3 flex items-center justify-between gap-3 border-t pt-3 text-[13px]">
        <span>
          {ended
            ? `Encerrada em ${formatMonthKey(bill.endMonth ?? month)}`
            : bill.endMonth === undefined
              ? `Desde ${formatMonthKey(bill.startMonth)}`
              : `Até ${formatMonthKey(bill.endMonth)}`}
        </span>

        {ended && onReopen !== undefined ? (
          <button
            type="button"
            onClick={() => {
              onReopen(bill);
            }}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Reativar
          </button>
        ) : null}

        {!ended && onEnd !== undefined ? (
          <button
            type="button"
            onClick={() => {
              onEnd(bill);
            }}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Encerrar
          </button>
        ) : null}
      </div>
    </li>
  );
}

function RecurringSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="bg-card space-y-3 rounded-xl border p-5">
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
          <div className="bg-muted/70 h-3 w-48 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
