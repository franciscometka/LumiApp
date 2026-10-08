import type { SVGProps } from 'react';

import { cn } from '@/lib/utils';

import { BRAND_NAME } from './brand';
import {
  LOCKUP_MARK_TRANSFORM,
  LOCKUP_SIZE,
  LOCKUP_VIEW_BOX,
  MARK_COMPACT_PATH,
  MARK_PATH,
  WORDMARK_DOT,
  WORDMARK_PATH,
} from './brand-geometry';

/**
 * Abaixo desta altura o simbolo do logo tem 32 px ou menos e usa o desenho
 * compacto, como o `BrandMark`.
 */
const COMPACT_LOGO_MAX_HEIGHT = 36;

type BrandLogoProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Altura em px; a largura segue a proporcao do logo. */
  height?: number;
};

/**
 * Logo horizontal: simbolo + "Lumi", na composicao da referencia aprovada.
 *
 * Simbolo e letras em `currentColor`; o pingo do "i" e o `--primary` do tema
 * ativo. Nada depende de `prefers-color-scheme`.
 */
export function BrandLogo({ height = 32, className, ...props }: BrandLogoProps) {
  const compact = height <= COMPACT_LOGO_MAX_HEIGHT;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LOCKUP_VIEW_BOX}
      height={height}
      width={Math.round((height * LOCKUP_SIZE.width) / LOCKUP_SIZE.height)}
      fill="currentColor"
      role="img"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      <title>{BRAND_NAME}</title>
      <path
        fillRule="evenodd"
        transform={LOCKUP_MARK_TRANSFORM}
        d={compact ? MARK_COMPACT_PATH : MARK_PATH}
      />
      <path fillRule="evenodd" d={WORDMARK_PATH} />
      <circle className="fill-primary" {...WORDMARK_DOT} />
    </svg>
  );
}
