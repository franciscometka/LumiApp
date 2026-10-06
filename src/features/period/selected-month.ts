import type { MonthKey, PlainDate } from '@/domain/shared/plain-date';
import { monthKeyOf, parseMonthKey } from '@/domain/shared/plain-date';

/** Nome do parametro de busca que carrega o periodo selecionado. */
export const MONTH_PARAM = 'month';

/**
 * Resolve o mes a partir do parametro da URL.
 *
 * Funcao pura, separada do hook de proposito: e aqui que mora a regra, e ela
 * precisa ser testavel sem React, sem router e sem navegador.
 *
 * Valor ausente ou invalido cai no mes de hoje, em silencio. Um `?month=xpto`
 * digitado a mao ou um link antigo nao pode quebrar a aplicacao — o pior
 * resultado aceitavel e abrir no mes corrente.
 */
export function resolveMonthParam(raw: string | null | undefined, today: PlainDate): MonthKey {
  if (raw === null || raw === undefined) return monthKeyOf(today);
  return parseMonthKey(raw) ?? monthKeyOf(today);
}

/**
 * Monta a query string preservando os demais parametros.
 *
 * Reescrever a query inteira descartaria filtros e buscas que outras telas
 * guardarem na URL mais adiante.
 */
export function buildMonthQuery(current: URLSearchParams, month: MonthKey): string {
  const next = new URLSearchParams(current);
  next.set(MONTH_PARAM, month);
  return next.toString();
}

/** Se o mes selecionado e o mes corrente — usado para destacar "voltar para hoje". */
export function isCurrentMonth(month: MonthKey, today: PlainDate): boolean {
  return month === monthKeyOf(today);
}
