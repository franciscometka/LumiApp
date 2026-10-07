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
}

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
  { href: '/mais' as Route, label: 'Mais', icon: Ellipsis, matchPrefix: '/mais' },
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
  if (destination.matchPrefix !== undefined) {
    return pathname === destination.matchPrefix || pathname.startsWith(`${destination.matchPrefix}/`);
  }
  return pathname === destination.href;
}
