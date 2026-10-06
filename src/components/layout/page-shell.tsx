import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Moldura de conteudo das paginas.
 *
 * Sem `'use client'` de proposito: e so apresentacao, entao continua sendo
 * Server Component e nao entra no JavaScript enviado ao navegador.
 *
 * A largura maxima de 48rem no desktop e deliberada. O briefing pediu que o
 * desktop use melhor o espaco sem virar painel corporativo; uma coluna com
 * medida de leitura confortavel faz isso, enquanto largura total convidaria a
 * encher a tela de caixinhas.
 */
export function PageShell({
  title,
  description,
  children,
  className,
  hideTitle = false,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /**
   * Esconde o titulo visualmente, sem remove-lo da arvore de acessibilidade.
   *
   * A Dashboard usa isto: o saldo precisa ser a primeira coisa que a pessoa ve
   * no celular, e um "Inicio" de 40px acima dele empurraria o numero mais
   * importante da tela para baixo sem informar nada que o menu ja nao diga.
   */
  hideTitle?: boolean;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-3xl px-4 py-6 lg:px-8 lg:py-10', className)}>
      <h1
        className={cn(
          hideTitle ? 'sr-only' : 'text-2xl font-semibold tracking-tight lg:text-3xl',
        )}
      >
        {title}
      </h1>
      {description === undefined ? null : (
        <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{description}</p>
      )}
      {children === undefined ? null : (
        <div className={hideTitle ? undefined : 'mt-8'}>{children}</div>
      )}
    </div>
  );
}

/** Marcador honesto de tela ainda nao construida. */
export function ComingSoon({ lote }: { lote: string }) {
  return (
    <div className="border-border/70 text-muted-foreground rounded-xl border border-dashed px-5 py-12 text-center">
      <p className="text-sm">Esta tela chega no {lote}.</p>
    </div>
  );
}
