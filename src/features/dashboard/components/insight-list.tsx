import { Lightbulb, TrendingDown, TriangleAlert } from 'lucide-react';

import type { Insight } from '@/domain/insights/types';
import { cn } from '@/lib/utils';

/**
 * Uma ou duas frases, nunca mais.
 *
 * O motor ja descartou tudo que nao tinha base matematica valida e ordenou o
 * resto por relevancia; aqui so resta vestir. Se nenhuma regra teve o que
 * dizer, a secao desaparece — um card "nenhum insight disponivel" ocuparia
 * espaco para comunicar nada.
 */
export function InsightList({ insights }: { insights: readonly Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid gap-2">
      {insights.map((insight) => {
        const Icon = TONE_ICONS[insight.tone];

        return (
          <div
            key={insight.id}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-4 py-3',
              insight.tone === 'attention'
                ? 'bg-expense-surface border-transparent'
                : insight.tone === 'positive'
                  ? 'bg-income-surface border-transparent'
                  : 'bg-card',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                insight.tone === 'attention' && 'text-expense',
                insight.tone === 'positive' && 'text-income',
                insight.tone === 'neutral' && 'text-muted-foreground',
              )}
              strokeWidth={2.1}
            />
            <p
              className={cn(
                'text-sm leading-relaxed',
                insight.tone === 'attention' && 'text-expense',
                insight.tone === 'positive' && 'text-income',
              )}
            >
              {insight.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const TONE_ICONS = {
  neutral: Lightbulb,
  positive: TrendingDown,
  attention: TriangleAlert,
} as const;
