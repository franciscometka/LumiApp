'use client';

import { useState } from 'react';

/**
 * ============================================================================
 * Sessao de uma Sheet: formulario limpo a cada abertura E saida animada.
 * ============================================================================
 *
 * As telas montavam cada Sheet so enquanto aberta —
 * \`{editing === null ? null : <CardFormSheet open ... />}\` — para que o
 * formulario nascesse dos inicializadores e nao sobrasse rascunho do cartao
 * anterior. O efeito colateral: ao fechar, o pai desmontava tudo no mesmo
 * instante, e nao existia componente para animar a saida.
 *
 * A sessao separa as duas coisas:
 * - \`open\` segue o estado da tela, e o Radix anima a saida;
 * - \`value\` RETEM o ultimo item enquanto a Sheet sai, para o conteudo nao
 *   trocar no meio da animacao ("Editar Inter" virando "Novo cartao");
 * - \`key\` muda a cada nova abertura: usada como \`key\` do formulario, ele
 *   remonta e nasce limpo, exatamente como antes.
 */
export interface SheetSessionState<T> {
  /** Ultimo valor visto da tela. */
  readonly seen: T | null;
  /** Ultimo valor nao nulo: o que a Sheet mostra enquanto sai. */
  readonly retained: T | null;
  readonly key: number;
}

export interface SheetSession<T> {
  readonly open: boolean;
  /** \`null\` so antes da primeira abertura: ai nao ha o que montar. */
  readonly value: T | null;
  readonly key: number;
}

/** Transicao pura. Uma abertura nova, ou a troca de item, gera chave nova. */
export function nextSheetSession<T>(
  state: SheetSessionState<T>,
  current: T | null,
): SheetSessionState<T> {
  if (current === state.seen) return state;
  return {
    seen: current,
    retained: current ?? state.retained,
    key: current === null ? state.key : state.key + 1,
  };
}

export function sheetSessionView<T>(
  state: SheetSessionState<T>,
  current: T | null,
): SheetSession<T> {
  return { open: current !== null, value: current ?? state.retained, key: state.key };
}

/**
 * \`current\`: o que a tela quer mostrar agora (\`null\` = fechada). Para Sheets
 * de criacao, passe \`isOpen ? true : null\`.
 */
export function useSheetSession<T>(current: T | null): SheetSession<T> {
  const [state, setState] = useState<SheetSessionState<T>>({
    seen: current,
    retained: current,
    key: 0,
  });

  // Ajuste de estado durante o render, o padrao do React para "estado que
  // depende de uma prop que mudou": sem efeito, sem render intermediario com
  // a chave errada.
  const next = nextSheetSession(state, current);
  if (next !== state) setState(next);

  return sheetSessionView(next, current);
}
