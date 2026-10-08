import type { HistoryWindowSize } from '@/domain/calculations/history';
import { DEFAULT_HISTORY_WINDOW_SIZE, isHistoryWindowSize } from '@/domain/calculations/history';

/** Parametro da URL que guarda o tamanho da janela: `/historico?meses=12`. */
export const WINDOW_PARAM = 'meses';

/**
 * Le o tamanho da janela da URL. Qualquer coisa fora de 6 e 12 — ausente,
 * `?meses=3`, `?meses=abc` — cai no padrao, em silencio, como o mes faz.
 */
export function resolveWindowParam(raw: string | null | undefined): HistoryWindowSize {
  if (raw === null || raw === undefined) return DEFAULT_HISTORY_WINDOW_SIZE;
  const parsed = Number(raw);
  return isHistoryWindowSize(parsed) && String(parsed) === raw.trim()
    ? parsed
    : DEFAULT_HISTORY_WINDOW_SIZE;
}
