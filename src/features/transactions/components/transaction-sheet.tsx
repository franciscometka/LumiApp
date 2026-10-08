'use client';

import { ChevronDown, Loader2, Repeat, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Card } from '@/domain/entities/card';
import type { Category } from '@/domain/entities/category';
import type { Debt } from '@/domain/entities/debt';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { Transaction, TransactionType } from '@/domain/entities/transaction';
import type { FLOW_NATURES } from '@/domain/entities/transaction';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  statusLabel,
} from '@/domain/entities/transaction';
import type { PlainDate } from '@/domain/shared/plain-date';
import { todayPlainDate } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

import type { TransactionFormErrors, TransactionFormValues } from '../transaction-form';
import {
  categoriesForType,
  changeType,
  emptyFormValues,
  formValuesFromTransaction,
  needsAdvancedSection,
  validateForm,
} from '../transaction-form';

import { linkOptions } from '../link-options';

import { MoneyInput } from './money-input';

/**
 * Formulario de transacao — criar e editar.
 *
 * Um unico componente para os dois casos. A diferenca cabe em tres linhas
 * (titulo, valores iniciais, qual mutation chamar), e separar em dois
 * formularios criaria duas regras de validacao que divergem no primeiro ajuste.
 *
 * Os campos visiveis de inicio sao os seis que o briefing listou. Cartao,
 * divida, observacao, forma de pagamento e natureza do fluxo ficam atras de
 * "Mais opções" — um lancamento comum e valor, descricao, categoria e salvar.
 *
 * **Quem chama monta este componente apenas enquanto a sheet esta aberta.**
 * O estado do formulario nasce nos inicializadores do `useState`, e fechar
 * desmonta: assim nao existe rascunho sobrevivente de uma abertura anterior,
 * nem os dados de outra transacao aparecendo ao editar a seguinte. A
 * alternativa — manter montado e reinicializar num efeito — e exatamente o
 * padrao que o React Compiler aponta como render em cascata, e tambem o que
 * criaria a janela em que a tela mostra valores da transacao errada.
 */
export interface TransactionSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Ausente = criacao. */
  readonly transaction?: Transaction | undefined;
  readonly categories: readonly Category[];
  /** Inclui excluidos: um vinculo historico precisa continuar resolvivel. */
  readonly cards: readonly Card[];
  readonly debts: readonly Debt[];
  /** Para resolver o nome da recorrencia que gerou este lancamento. */
  readonly recurringBills: readonly RecurringBill[];
  readonly isSaving: boolean;
  readonly saveError: Error | null;
  /** Deve resolver apenas DEPOIS da persistencia confirmar. */
  readonly onSubmit: (values: TransactionFormValues) => Promise<void>;
  readonly onRequestDelete?: (() => void) | undefined;
  /** Data inicial na criacao. Padrao: hoje. */
  readonly defaultDate?: PlainDate | undefined;
}

export function TransactionSheet({
  open,
  onOpenChange,
  transaction,
  categories,
  cards,
  debts,
  recurringBills,
  isSaving,
  saveError,
  onSubmit,
  onRequestDelete,
  defaultDate,
}: TransactionSheetProps) {
  const fieldId = useId();
  const isEditing = transaction !== undefined;

  const [values, setValues] = useState<TransactionFormValues>(() =>
    transaction === undefined
      ? emptyFormValues(defaultDate ?? todayPlainDate())
      : formValuesFromTransaction(transaction),
  );
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const [showAdvanced, setShowAdvanced] = useState(() =>
    needsAdvancedSection(
      transaction === undefined
        ? emptyFormValues(defaultDate ?? todayPlainDate())
        : formValuesFromTransaction(transaction),
    ),
  );

  const available = categoriesForType(categories, values.type);

  /**
   * Nome da recorrencia de origem. `null` quando o lancamento e avulso.
   * Procura entre TODAS, inclusive excluidas: um vinculo historico continua
   * merecendo um nome em vez de um id orfao.
   */
  const origin =
    transaction?.recurringBillId === undefined
      ? null
      : (recurringBills.find((bill) => bill.id === transaction.recurringBillId)?.description ??
        'Recorrência removida');

  const update = <K extends keyof TransactionFormValues>(
    key: K,
    value: TransactionFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    // O erro sai no momento em que a pessoa mexe no campo: manter "Informe um
    // valor" embaixo de um campo ja preenchido e ruido.
    setErrors((current) => (key in current ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Trava de duplo envio. A sheet so fecha quando `onSubmit` resolve, e
    // nesse intervalo o botao fica desabilitado — mas o Enter do teclado
    // chegaria aqui de novo mesmo assim.
    if (isSaving) return;

    const result = validateForm(values, categories);
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
          <SheetTitle>{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Altere o que precisar e salve.'
              : 'Valor, descrição e categoria já bastam.'}
          </SheetDescription>
        </SheetHeader>

        {/*
          Origem recorrente.
          
          Fica visivel no topo porque muda o entendimento do que se esta
          editando: alterar o valor aqui NAO altera a recorrencia, e a pessoa
          precisa saber disso antes de digitar. Uma ocorrencia materializada e
          independente depois de criada.
        */}
        {origin === null ? null : (
          <p className="text-muted-foreground bg-muted/50 mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
            <Repeat aria-hidden className="size-3.5 shrink-0" />
            <span>
              Gerado por <span className="text-foreground font-medium">{origin}</span> · alterar
              aqui não muda a recorrência
            </span>
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
          <TypeToggle
            value={values.type}
            onChange={(type) => {
              setValues((current) => changeType(current, type, categories));
              setErrors((current) => ({ ...current, categoryId: undefined }));
            }}
          />

          <Field
            label="Valor"
            htmlFor={`${fieldId}-amount`}
            error={errors.amount}
            hint="Use vírgula para os centavos."
          >
            <MoneyInput
              id={`${fieldId}-amount`}
              value={values.amount}
              onChange={(next) => {
                update('amount', next);
              }}
              invalid={errors.amount !== undefined}
              autoFocus={!isEditing}
            />
          </Field>

          <Field label="Descrição" htmlFor={`${fieldId}-description`} error={errors.description}>
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
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
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

            <Field label="Data" htmlFor={`${fieldId}-date`} error={errors.date}>
              {/*
                `type="date"` devolve exatamente "YYYY-MM-DD" — o mesmo formato
                de `PlainDate`. Nenhum `Date` e construido: a string vai para
                `parsePlainDate` e nada aqui conhece fuso horario.
              */}
              <Input
                id={`${fieldId}-date`}
                type="date"
                value={values.date}
                onChange={(event) => {
                  update('date', event.target.value);
                }}
                aria-invalid={errors.date !== undefined}
              />
            </Field>
          </div>

          <StatusToggle
            type={values.type}
            value={values.status}
            onChange={(status) => {
              update('status', status);
            }}
          />

          <button
            type="button"
            onClick={() => {
              setShowAdvanced((current) => !current);
            }}
            className="text-muted-foreground hover:text-foreground -mx-1 flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-medium transition-colors"
            aria-expanded={showAdvanced}
          >
            Mais opções
            <ChevronDown
              className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')}
            />
          </button>

          {showAdvanced ? (
            <div className="border-border/70 flex flex-col gap-4 rounded-lg border border-dashed p-4">
              <Field label="Forma de pagamento" htmlFor={`${fieldId}-method`}>
                <Select
                  id={`${fieldId}-method`}
                  value={values.paymentMethod}
                  onChange={(event) => {
                    update('paymentMethod', event.target.value as typeof values.paymentMethod);
                  }}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Natureza"
                htmlFor={`${fieldId}-flow`}
                hint={
                  values.flow === 'transfer'
                    ? 'Não conta como renda gerada no mês.'
                    : 'Dinheiro que entrou ou saiu de verdade neste mês.'
                }
              >
                <Select
                  id={`${fieldId}-flow`}
                  value={values.flow}
                  onChange={(event) => {
                    update('flow', event.target.value as (typeof FLOW_NATURES)[number]);
                  }}
                >
                  <option value="operational">Movimento do mês</option>
                  <option value="transfer">
                    {values.type === 'income' ? 'Vem da reserva' : 'Vai para a reserva'}
                  </option>
                </Select>
              </Field>

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

              {/*
                Cartao e divida.

                `linkOptions` garante que o valor atual SEMPRE exista entre as
                opcoes. Um `<select>` cujo value nao casa com nenhuma option
                nao reclama: ele passa a valer '', e salvar o formulario
                apagaria um vinculo historico sem nenhum sinal na tela.
                Quando a entidade foi excluida, a opcao aparece rotulada como
                removida — estado explicito, nao vinculo em branco.
              */}
              <Field
                label="Cartão"
                htmlFor={`${fieldId}-card`}
                hint="Para saber quais gastos são deste cartão. Não altera a fatura."
              >
                <Select
                  id={`${fieldId}-card`}
                  value={values.cardId}
                  onChange={(event) => {
                    update('cardId', event.target.value);
                  }}
                >
                  <option value="">Nenhum</option>
                  {linkOptions(cards, values.cardId, (name) =>
                    name === null ? 'Cartão removido' : `${name} (removido)`,
                  ).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Dívida"
                htmlFor={`${fieldId}-debt`}
                hint="Relaciona o lançamento à dívida. Não avança as parcelas pagas."
              >
                <Select
                  id={`${fieldId}-debt`}
                  value={values.debtId}
                  onChange={(event) => {
                    update('debtId', event.target.value);
                  }}
                >
                  <option value="">Nenhuma</option>
                  {linkOptions(debts, values.debtId, (name) =>
                    name === null ? 'Dívida removida' : `${name} (removida)`,
                  ).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
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
              // Sem lixeira em cada linha da lista: a exclusao vive aqui, a um
              // toque de distancia de quem ja abriu o lancamento para mexer.
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onRequestDelete}
                disabled={isSaving}
                aria-label="Excluir lançamento"
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
 * Entrada x gasto.
 *
 * A selecao usa os tokens `income`/`expense` e nunca `destructive`: um gasto e
 * um fato normal da vida financeira, nao um erro de preenchimento. O estado
 * selecionado tambem muda o peso da fonte e desenha a borda, entao a escolha
 * nao depende de distinguir duas cores.
 */
function TypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
}) {
  return (
    <div role="group" aria-label="Tipo de lançamento" className="grid grid-cols-2 gap-2">
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

/** "Pago/Pendente" para gastos, "Recebido/Pendente" para entradas. */
function StatusToggle({
  type,
  value,
  onChange,
}: {
  type: TransactionType;
  value: Transaction['status'];
  onChange: (status: Transaction['status']) => void;
}) {
  return (
    <div role="group" aria-label="Situação" className="grid grid-cols-2 gap-2">
      {(['paid', 'pending'] as const).map((status) => {
        const selected = value === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => {
              onChange(status);
            }}
            aria-pressed={selected}
            className={cn(
              'min-h-11 rounded-lg border text-[15px] transition-colors',
              selected
                ? 'border-foreground/25 bg-accent text-foreground font-semibold'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            {statusLabel(type, status)}
          </button>
        );
      })}
    </div>
  );
}
