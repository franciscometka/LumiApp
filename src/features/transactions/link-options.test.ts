import { describe, expect, it } from 'vitest';

import type { ID } from '@/domain/shared/id';

import { availableForLinking, isRemovedReference, linkOptions } from './link-options';

/**
 * Estes testes protegem contra uma perda de dado silenciosa: editar um
 * lancamento antigo e, ao salvar, descobrir que o vinculo com um cartao
 * excluido sumiu — sem erro, sem aviso, sem nada na tela que indicasse que
 * ele existia.
 */

interface Linkable {
  id: ID;
  name: string;
  deletedAt?: string;
  archivedAt?: string;
}

const INTER = { id: 'card-inter' as ID, name: 'Inter' };
const MAGALU = { id: 'card-magalu' as ID, name: 'Magalu' };
const EXCLUIDO = {
  id: 'card-velho' as ID,
  name: 'Antigo',
  deletedAt: '2026-09-01T12:00:00.000Z',
};
const ARQUIVADO = {
  id: 'card-arq' as ID,
  name: 'Arquivado',
  archivedAt: '2026-09-01T12:00:00.000Z',
};

const TODOS: Linkable[] = [MAGALU, INTER, EXCLUIDO, ARQUIVADO];

const rotulo = (name: string | null) => (name === null ? 'Cartão removido' : `${name} (removido)`);

describe('availableForLinking', () => {
  it('oferece apenas o que pode receber novo vinculo, em ordem alfabetica', () => {
    expect(availableForLinking(TODOS).map((c) => c.id)).toEqual(['card-inter', 'card-magalu']);
  });

  it('exclui excluidos e arquivados', () => {
    const ids = availableForLinking(TODOS).map((c) => c.id);
    expect(ids).not.toContain('card-velho');
    expect(ids).not.toContain('card-arq');
  });

  it('nao muta a lista recebida', () => {
    const antes = TODOS.map((c) => c.id);
    availableForLinking(TODOS);
    expect(TODOS.map((c) => c.id)).toEqual(antes);
  });
});

describe('linkOptions — o valor atual nunca pode sumir', () => {
  it('sem vinculo, lista so os disponiveis', () => {
    expect(linkOptions(TODOS, '', rotulo).map((o) => o.id)).toEqual([
      'card-inter',
      'card-magalu',
    ]);
  });

  it('vinculo valido nao duplica a opcao', () => {
    const options = linkOptions(TODOS, 'card-inter', rotulo);
    expect(options.filter((o) => o.id === 'card-inter')).toHaveLength(1);
    expect(options).toHaveLength(2);
  });

  it('vinculo para cartao EXCLUIDO continua na lista, rotulado', () => {
    // Sem isto, o <select> ficaria sem opcao correspondente, assumiria '' e
    // salvar apagaria o vinculo historico.
    const options = linkOptions(TODOS, 'card-velho', rotulo);

    const preservada = options.find((o) => o.id === 'card-velho');
    expect(preservada).toBeDefined();
    expect(preservada?.label).toBe('Antigo (removido)');
    expect(preservada?.removed).toBe(true);
  });

  it('vinculo para cartao ARQUIVADO tambem e preservado', () => {
    const options = linkOptions(TODOS, 'card-arq', rotulo);
    expect(options.some((o) => o.id === 'card-arq')).toBe(true);
  });

  it('vinculo para entidade que sumiu do repositorio usa o rotulo generico', () => {
    // Nao sabemos o nome: o app diz "removido" em vez de inventar um.
    const options = linkOptions(TODOS, 'card-fantasma', rotulo);
    const orfa = options.find((o) => o.id === 'card-fantasma');

    expect(orfa?.label).toBe('Cartão removido');
    expect(orfa?.removed).toBe(true);
  });

  it('a opcao preservada vai para o fim, sem atrapalhar a escolha normal', () => {
    const options = linkOptions(TODOS, 'card-velho', rotulo);
    expect(options[options.length - 1]?.id).toBe('card-velho');
  });

  it('o valor atual SEMPRE existe entre as opcoes', () => {
    // A invariante do modulo, afirmada diretamente.
    for (const atual of ['', 'card-inter', 'card-velho', 'card-arq', 'card-sumido']) {
      const options = linkOptions(TODOS, atual, rotulo);
      if (atual === '') continue;
      expect(options.some((o) => o.id === atual), `valor "${atual}" sumiu`).toBe(true);
    }
  });

  it('lista vazia de entidades ainda preserva o vinculo atual', () => {
    const options = linkOptions([], 'card-velho', rotulo);
    expect(options).toHaveLength(1);
    expect(options[0]?.removed).toBe(true);
  });
});

describe('isRemovedReference', () => {
  it('reconhece referencia valida, excluida, arquivada e inexistente', () => {
    expect(isRemovedReference(TODOS, '')).toBe(false);
    expect(isRemovedReference(TODOS, 'card-inter')).toBe(false);
    expect(isRemovedReference(TODOS, 'card-velho')).toBe(true);
    expect(isRemovedReference(TODOS, 'card-arq')).toBe(true);
    expect(isRemovedReference(TODOS, 'card-fantasma')).toBe(true);
  });
});
