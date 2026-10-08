'use client';

import { Repeat } from 'lucide-react';

import { formatMonthKey } from '@/domain/shared/plain-date';
import type { MonthKey } from '@/domain/shared/plain-date';

import type { MaterializationResult } from '../recurring/materialize';

/**
 * Aviso de que contas recorrentes foram criadas ao abrir um mes.
 *
 * Aparece apenas quando o app criou algo num mes que a pessoa nao tinha
 * visitado — tipicamente um mes passado. Materializar em silencio ali seria
 * desconcertante: o saldo de setembro mudaria sozinho entre duas visitas, sem
 * que nada explicasse por que.
 *
 * No mes corrente o aviso nao aparece: lancar as contas do mes e o
 * comportamento esperado do app, e anunciar o obvio toda vez vira ruido.
 *
 * Discreto de proposito — uma linha, sem modal, sem bloquear a tela, sem cor
 * de alerta. Nada aconteceu de errado; e so uma explicacao.
 */
export function MaterializationNotice({
  result,
  month,
  isCurrentMonth,
}: {
  result: MaterializationResult | null;
  month: MonthKey;
  isCurrentMonth: boolean;
}) {
  if (result === null || result.created === 0) return null;
  if (isCurrentMonth) return null;

  const count = result.created;

  return (
    <p
      role="status"
      className="text-muted-foreground bg-muted/50 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed"
    >
      <Repeat aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {count === 1
          ? '1 conta recorrente foi adicionada a '
          : `${String(count)} contas recorrentes foram adicionadas a `}
        <span className="first-letter:uppercase">{formatMonthKey(month)}</span>.
      </span>
    </p>
  );
}
