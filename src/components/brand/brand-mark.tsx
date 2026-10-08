import type { SVGProps } from 'react';

import { MARK_COMPACT_PATH, MARK_PATH, MARK_VIEW_BOX } from './brand-geometry';

/** Ate este tamanho o simbolo usa o desenho compacto (fendas finas fechadas). */
export const COMPACT_MARK_MAX_SIZE = 32;

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Lado em px. */
  size?: number;
  /** Forca uma versao; por padrao, compacto ate 32 px. */
  compact?: boolean;
  /** Nome acessivel. Sem ele, o simbolo e decorativo. */
  title?: string;
};

/**
 * Simbolo do Lumi.
 *
 * Inline e em `currentColor`: a cor vem do contexto (`text-foreground`,
 * `text-primary`...), entao segue o tema escolhido no app — nunca o tema do
 * sistema operacional.
 */
export function BrandMark({ size = 32, compact, title, ...props }: BrandMarkProps) {
  const useCompact = compact ?? size <= COMPACT_MARK_MAX_SIZE;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MARK_VIEW_BOX}
      width={size}
      height={size}
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path fillRule="evenodd" d={useCompact ? MARK_COMPACT_PATH : MARK_PATH} />
    </svg>
  );
}
