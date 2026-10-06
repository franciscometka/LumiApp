import type { PeriodSnapshot } from '../calculations/snapshot';

import { INSIGHT_RULES } from './rules';
import type { CategoryNameLookup, Insight, InsightRule } from './types';

export interface GenerateInsightsOptions {
  readonly categoryName?: CategoryNameLookup;
  /**
   * Quantas frases a tela inicial comporta.
   *
   * O padrao e 2 por decisao de produto: tres ou mais insights viram um mural
   * e nenhum e lido. Escassez e o que faz a frase valer.
   */
  readonly limit?: number;
  readonly rules?: readonly InsightRule[];
}

const noCategoryName: CategoryNameLookup = () => null;

/**
 * Avalia todas as regras e devolve as mais relevantes.
 *
 * Funcao pura: mesmas entradas, mesma saida. Nenhuma IA nesta versao — cada
 * frase vem de um numero conferivel na propria tela.
 */
export function generateInsights(
  snapshot: PeriodSnapshot,
  options: GenerateInsightsOptions = {},
): Insight[] {
  const { categoryName = noCategoryName, limit = 2, rules = INSIGHT_RULES } = options;

  if (limit <= 0) return [];

  const context = { snapshot, categoryName };

  return rules
    .map((rule) => rule.evaluate(context))
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, limit);
}
