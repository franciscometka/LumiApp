import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

/**
 * Layout do grupo de rotas da aplicacao.
 *
 * Server Component: nao tem estado, nao tem efeito e nao toca no navegador.
 * Seu unico trabalho e montar a casca cliente ao redor das paginas, que
 * tambem sao Server Components. A fronteira cliente comeca dentro do
 * `AppShell`, e nao aqui.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
