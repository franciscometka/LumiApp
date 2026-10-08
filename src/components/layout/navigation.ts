import type { Route } from 'next';
import { ArrowLeftRight, CreditCard, Ellipsis, House, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavDestination {
  readonly href: Route;
  readonly label: string;
  /**
   * Rotulo da tab bar, quando o nome completo nao cabe em ~62px.
   * Abreviar e melhor do que truncar: "Planejame..." nao e um nome, e um
   * defeito. A tela em si continua se chamando "Planejamento".
   */
  readonly shortLabel?: string;
  readonly icon: LucideIcon;
  /** Rotas que tambem devem acender este destino (subpaginas). */
  readonly matchPrefix?: string;
  /**
   * Telas que vivem em rota propria mas pertencem a este destino. "Dividas"
   * esta em `/dividas`, nao em `/mais/dividas`, e mesmo assim e uma tela do
   * "Mais" — sem isto, nenhuma aba acendia ali.
   */
  readonly childRoutes?: readonly string[];
}

/** Telas alcancadas pelo "Mais". Unica lista; a tab e a sidebar a usam. */
export const MORE_ROUTES = ['/dividas', '/recorrentes', '/historico', '/ajustes'] as const;

/**
 * Rotas em que o mes selecionado muda o conteudo.
 *
 * O seletor de mes so aparece nelas. Em Cartoes, Dividas, Recorrentes,
 * Historico, Mais e Ajustes ele trocava a URL sem mudar nada na tela — um
 * controle que nao controla nada e pior do que nenhum.
 */
export const MONTH_SCOPED_ROUTES = ['/', '/transacoes', '/planejamento'] as const;

/**
 * Destinos principais, na ordem definida no briefing.
 *
 * A mesma lista alimenta a tab bar do mobile e a sidebar do desktop: dois
 * arrays separados divergiriam na primeira mudanca de rota.
 */
export const PRIMARY_DESTINATIONS: readonly NavDestination[] = [
  { href: '/' as Route, label: 'Início', icon: House },
  { href: '/transacoes' as Route, label: 'Transações', icon: ArrowLeftRight },
  { href: '/planejamento' as Route, label: 'Planejamento', shortLabel: 'Planos', icon: Target },
  { href: '/cartoes' as Route, label: 'Cartões', icon: CreditCard, matchPrefix: '/cartoes' },
  {
    href: '/mais' as Route,
    label: 'Mais',
    icon: Ellipsis,
    matchPrefix: '/mais',
    childRoutes: MORE_ROUTES,
  },
];

/** Rotulo a usar em espaco apertado. */
export function tabLabel(destination: NavDestination): string {
  return destination.shortLabel ?? destination.label;
}

/**
 * Se o destino corresponde a rota atual.
 *
 * A raiz exige igualdade exata — sem isso, "Início" ficaria aceso em todas as
 * telas, porque toda rota comeca com "/".
 */
export function isDestinationActive(destination: NavDestination, pathname: string): boolean {
  if (destination.href === '/') return pathname === '/';
  if (destination.childRoutes?.some((route) => isSameOrNested(pathname, route)) === true) {
    return true;
  }
  if (destination.matchPrefix !== undefined) {
    return isSameOrNested(pathname, destination.matchPrefix);
  }
  return pathname === destination.href;
}

/** Se o seletor de mes deve aparecer nesta rota. */
export function showsMonthSwitcher(pathname: string): boolean {
  return MONTH_SCOPED_ROUTES.some((route) =>
    route === '/' ? pathname === '/' : isSameOrNested(pathname, route),
  );
}

/** `/cartoes` e `/cartoes/1` sim; `/cartoes-antigos` nao. */
function isSameOrNested(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
