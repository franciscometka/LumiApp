'use client';

import { Search, X } from 'lucide-react';

import { Select } from '@/components/ui/field';
import type { Category } from '@/domain/entities/category';
import { sortCategories } from '@/domain/entities/category';
import type { ID } from '@/domain/shared/id';
import { cn } from '@/lib/utils';

import type { ListFilters } from '../list-filters';
import { ALL, hasActiveFilters } from '../list-filters';

/**
 * Busca e tres filtros. Nao dez.
 *
 * Todos / Entradas / Gastos fica em segmentos visiveis porque e o recorte mais
 * usado e merece um toque. Categoria e situacao viram `<select>`, que no
 * celular abre o seletor nativo e nao ocupa altura permanente na tela.
 *
 * O mes nao esta aqui: ele e do `MonthSwitcher` global.
 */
export function TransactionFilters({
  filters,
  categories,
  onChange,
  resultCount,
}: {
  filters: ListFilters;
  categories: readonly Category[];
  onChange: (next: ListFilters) => void;
  resultCount: number;
}) {
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <input
          type="search"
          value={filters.search}
          onChange={(event) => {
            // Sem debounce: a lista do mes ja esta na memoria e o filtro e uma
            // passada por algumas dezenas de itens. Adiar isso em 300ms so
            // tornaria a digitacao menos responsiva.
            onChange({ ...filters, search: event.target.value });
          }}
          placeholder="Buscar por descrição ou categoria"
          aria-label="Buscar lançamentos"
          className={cn(
            'bg-background border-input min-h-11 w-full rounded-lg border pl-9 text-[15px]',
            'placeholder:text-muted-foreground/70 pr-9',
            'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none',
            '[&::-webkit-search-cancel-button]:appearance-none',
          )}
        />
        {filters.search === '' ? null : (
          <button
            type="button"
            onClick={() => {
              onChange({ ...filters, search: '' });
            }}
            aria-label="Limpar busca"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Tipo"
        className="bg-muted/60 grid grid-cols-3 gap-1 rounded-lg p-1"
      >
        {(
          [
            { value: ALL, label: 'Todos' },
            { value: 'income', label: 'Entradas' },
            { value: 'expense', label: 'Gastos' },
          ] as const
        ).map((option) => {
          const selected = filters.type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange({ ...filters, type: option.value });
              }}
              aria-pressed={selected}
              className={cn(
                'min-h-9 rounded-md text-sm transition-colors',
                selected
                  ? 'bg-card text-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select
          value={filters.categoryId}
          onChange={(event) => {
            onChange({ ...filters, categoryId: event.target.value as ID | typeof ALL });
          }}
          aria-label="Categoria"
          className="min-h-10 pr-7 text-[13px]"
        >
          <option value={ALL}>Todas as categorias</option>
          {sortCategories([...categories]).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.status}
          onChange={(event) => {
            onChange({ ...filters, status: event.target.value as ListFilters['status'] });
          }}
          aria-label="Situação"
          className="min-h-10 pr-7 text-[13px]"
        >
          <option value={ALL}>Pagos e pendentes</option>
          <option value="paid">Só concluídos</option>
          <option value="pending">Só pendentes</option>
        </Select>
      </div>

      {active ? (
        <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
          <span>
            {resultCount === 1 ? '1 lançamento encontrado' : `${String(resultCount)} lançamentos encontrados`}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange({ type: ALL, status: ALL, categoryId: ALL, search: '' });
            }}
            className="hover:text-foreground font-medium underline-offset-4 transition-colors hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}
