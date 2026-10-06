import type { ID } from '../shared/id';

import type { PeriodSnapshot } from '../calculations/snapshot';

/**
 * Como a frase deve soar. Nao e severidade de erro: um saldo negativo merece
 * atencao, nao um alarme vermelho de sistema quebrado.
 */
export type InsightTone = 'neutral' | 'positive' | 'attention';

export interface Insight {
  readonly id: string;
  readonly text: string;
  readonly tone: InsightTone;
  /**
   * Quanto esta frase merece o espaco escasso da tela inicial.
   * Maior vence. Serve para escolher 1 ou 2 entre varias candidatas.
   */
  readonly priority: number;
}

/** Nomes de categoria, para que as frases falem "Carro" e nao um UUID. */
export type CategoryNameLookup = (categoryId: ID) => string | null;

export interface InsightContext {
  readonly snapshot: PeriodSnapshot;
  readonly categoryName: CategoryNameLookup;
}

/**
 * Uma regra devolve `null` sempre que a base matematica nao sustenta a frase:
 * metrica `null`, divisao por zero, periodo sem dados, variacao irrelevante.
 *
 * Esta e a regra mais importante do modulo. Um insight so existe se for
 * verdadeiro; silencio e sempre preferivel a um numero inventado.
 */
export interface InsightRule {
  readonly id: string;
  evaluate(context: InsightContext): Insight | null;
}
