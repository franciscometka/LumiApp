import { describe, expect, it } from 'vitest';

import type { SheetSessionState } from './sheet-session';
import { nextSheetSession, sheetSessionView } from './sheet-session';

const fechada: SheetSessionState<string> = { seen: null, retained: null, key: 0 };

function percorrer(valores: (string | null)[]) {
  let state = fechada;
  return valores.map((valor) => {
    state = nextSheetSession(state, valor);
    return sheetSessionView(state, valor);
  });
}

describe('sessao de Sheet', () => {
  it('antes da primeira abertura nao ha o que montar', () => {
    expect(sheetSessionView(fechada, null)).toEqual({ open: false, value: null, key: 0 });
  });

  it('abrir monta com o item e uma chave nova', () => {
    const [aberta] = percorrer(['inter']);
    expect(aberta).toEqual({ open: true, value: 'inter', key: 1 });
  });

  it('fechar mantem o ultimo item enquanto a Sheet sai', () => {
    const [, saindo] = percorrer(['inter', null]);
    expect(saindo).toEqual({ open: false, value: 'inter', key: 1 });
  });

  it('reabrir gera chave nova: o formulario nasce limpo', () => {
    const passos = percorrer(['inter', null, 'inter']);
    expect(passos[2]?.key).toBe(2);
  });

  it('trocar de item sem fechar tambem gera chave nova', () => {
    const passos = percorrer(['inter', 'magalu']);
    expect(passos[1]).toEqual({ open: true, value: 'magalu', key: 2 });
  });

  it('render repetido com o mesmo valor nao muda nada', () => {
    const state = nextSheetSession(fechada, 'inter');
    expect(nextSheetSession(state, 'inter')).toBe(state);
  });

  it('Sheet de criacao: true/null', () => {
    let state: SheetSessionState<true> = { seen: null, retained: null, key: 0 };
    state = nextSheetSession(state, true);
    expect(sheetSessionView(state, true)).toEqual({ open: true, value: true, key: 1 });
    state = nextSheetSession(state, null);
    expect(sheetSessionView(state, null)).toEqual({ open: false, value: true, key: 1 });
  });
});
