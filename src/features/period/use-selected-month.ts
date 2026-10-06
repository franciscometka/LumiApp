'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { Period } from '@/domain/shared/period';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { MONTH_PARAM, buildMonthQuery, isCurrentMonth, resolveMonthParam } from './selected-month';

export interface SelectedMonth {
  readonly month: MonthKey;
  readonly period: Period;
  readonly label: string;
  readonly isCurrent: boolean;
  goTo(month: MonthKey): void;
  goToPrevious(): void;
  goToNext(): void;
  goToCurrent(): void;
}

/**
 * Periodo selecionado, com a URL como fonte de verdade.
 *
 * Por que a URL e nao o Zustand:
 * - recarregar a pagina mantem o mes;
 * - voltar e avancar do navegador percorrem os meses visitados;
 * - um link como `/transacoes?month=2026-09` abre exatamente naquele mes —
 *   isso vale para compartilhar, para favoritar e para depurar.
 *
 * Guardar isso em estado de memoria perderia as tres coisas. O Zustand fica
 * com o que de fato e efemero: sheet aberta, sidebar recolhida.
 *
 * A navegacao usa `push`, nao `replace`, justamente para que o botao Voltar
 * ande entre meses como o usuario espera.
 */
export function useSelectedMonth(): SelectedMonth {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `todayPlainDate()` le o relogio: fixar por render evita que duas leituras
  // dentro do mesmo render discordem na virada da meia-noite.
  const today = useMemo(() => todayPlainDate(), []);

  const month = resolveMonthParam(searchParams.get(MONTH_PARAM), today);
  const period = useMemo(() => civilMonthResolver.resolve(month), [month]);

  const goTo = useCallback(
    (next: MonthKey) => {
      const query = buildMonthQuery(new URLSearchParams(searchParams.toString()), next);
      // `typedRoutes` nao consegue verificar uma rota montada em tempo de
      // execucao; o pathname vem do proprio router, entao ja e valido.
      router.push(`${pathname}?${query}` as Route);
    },
    [pathname, router, searchParams],
  );

  return {
    month,
    period,
    label: period.label,
    isCurrent: isCurrentMonth(month, today),
    goTo,
    goToPrevious: useCallback(() => {
      goTo(civilMonthResolver.previous(month));
    }, [goTo, month]),
    goToNext: useCallback(() => {
      goTo(civilMonthResolver.next(month));
    }, [goTo, month]),
    goToCurrent: useCallback(() => {
      goTo(civilMonthResolver.keyOf(today));
    }, [goTo, today]),
  };
}
