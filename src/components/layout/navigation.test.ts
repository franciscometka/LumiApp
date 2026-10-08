import { describe, expect, it } from 'vitest';

import {
  MORE_ROUTES,
  PRIMARY_DESTINATIONS,
  isDestinationActive,
  showsMonthSwitcher,
  tabLabel,
} from './navigation';

describe('destinos principais', () => {
  it('traz os cinco do briefing, na ordem', () => {
    expect(PRIMARY_DESTINATIONS.map((item) => item.label)).toEqual([
      'Início',
      'Transações',
      'Planejamento',
      'Cartões',
      'Mais',
    ]);
  });

  it('aponta para rotas em pt-BR', () => {
    expect(PRIMARY_DESTINATIONS.map((item) => item.href)).toEqual([
      '/',
      '/transacoes',
      '/planejamento',
      '/cartoes',
      '/mais',
    ]);
  });
});

describe('rotulo da tab bar', () => {
  it('abrevia so onde o nome completo nao cabe', () => {
    expect(tabLabel(PRIMARY_DESTINATIONS[2]!)).toBe('Planos');
    expect(tabLabel(PRIMARY_DESTINATIONS[0]!)).toBe('Início');
    expect(tabLabel(PRIMARY_DESTINATIONS[1]!)).toBe('Transações');
  });

  it('nenhum rotulo de tab passa de 10 caracteres', () => {
    // Cada aba tem ~62px a 10px: acima disso, truncaria.
    for (const destination of PRIMARY_DESTINATIONS) {
      expect(tabLabel(destination).length).toBeLessThanOrEqual(10);
    }
  });

  it('a sidebar continua usando o nome completo', () => {
    expect(PRIMARY_DESTINATIONS[2]?.label).toBe('Planejamento');
  });
});

describe('isDestinationActive', () => {
  const [inicio, transacoes, , cartoes, mais] = PRIMARY_DESTINATIONS;

  it('a raiz exige correspondencia exata', () => {
    // Sem isso, "Inicio" ficaria aceso em todas as telas: toda rota comeca
    // com barra.
    expect(isDestinationActive(inicio!, '/')).toBe(true);
    expect(isDestinationActive(inicio!, '/transacoes')).toBe(false);
    expect(isDestinationActive(inicio!, '/mais/dividas')).toBe(false);
  });

  it('rotas simples casam exatamente', () => {
    expect(isDestinationActive(transacoes!, '/transacoes')).toBe(true);
    expect(isDestinationActive(transacoes!, '/planejamento')).toBe(false);
  });

  it('destinos com subpaginas acendem nas filhas', () => {
    expect(isDestinationActive(cartoes!, '/cartoes')).toBe(true);
    expect(isDestinationActive(cartoes!, '/cartoes/abc-123')).toBe(true);
    expect(isDestinationActive(mais!, '/mais/dividas')).toBe(true);
  });

  it('nao acende por prefixo parcial de nome', () => {
    // "/cartoes-antigos" nao e filha de "/cartoes".
    expect(isDestinationActive(cartoes!, '/cartoes-antigos')).toBe(false);
  });

  it('no maximo um destino ativo por rota', () => {
    for (const pathname of ['/', '/transacoes', '/planejamento', '/cartoes', '/cartoes/1', '/mais', '/mais/dividas']) {
      const ativos = PRIMARY_DESTINATIONS.filter((item) => isDestinationActive(item, pathname));
      expect(ativos).toHaveLength(1);
    }
  });
});

describe('Mais acende nas telas que pertencem a ele', () => {
  const mais = PRIMARY_DESTINATIONS[4]!;

  it('acende em /mais e em todas as subtelas, mesmo em rota propria', () => {
    for (const pathname of ['/mais', '/dividas', '/recorrentes', '/historico', '/ajustes']) {
      expect(isDestinationActive(mais, pathname), pathname).toBe(true);
    }
  });

  it('nao acende por prefixo parcial', () => {
    expect(isDestinationActive(mais, '/dividas-antigas')).toBe(false);
    expect(isDestinationActive(mais, '/historicos')).toBe(false);
  });

  it('cada subtela acende exatamente um destino', () => {
    for (const pathname of MORE_ROUTES) {
      const ativos = PRIMARY_DESTINATIONS.filter((item) => isDestinationActive(item, pathname));
      expect(ativos.map((item) => item.label), pathname).toEqual(['Mais']);
    }
  });
});

describe('showsMonthSwitcher', () => {
  it('aparece onde o mes muda o conteudo', () => {
    for (const pathname of ['/', '/transacoes', '/planejamento']) {
      expect(showsMonthSwitcher(pathname), pathname).toBe(true);
    }
  });

  it('some onde o mes nao muda nada', () => {
    for (const pathname of ['/cartoes', '/cartoes/1', '/dividas', '/recorrentes', '/historico', '/mais', '/ajustes']) {
      expect(showsMonthSwitcher(pathname), pathname).toBe(false);
    }
  });

  it('a raiz nao vale como prefixo de tudo', () => {
    expect(showsMonthSwitcher('/qualquer')).toBe(false);
  });
});
