import type { SVGProps } from 'react';

import { cn } from '@/lib/utils';

import { BRAND_NAME } from './brand';
import {
  MARK_COMPACT_PATH,
  MARK_PATH,
  WORDMARK_CAP,
  WORDMARK_DOT,
  WORDMARK_PATH,
} from './brand-geometry';
import { COMPACT_MARK_MAX_SIZE } from './brand-mark';

/**
 * Tinta do simbolo dentro do quadrado de 512 (a margem de 8 do arquivo fica
 * de fora: o logo encosta na tinta, e o alinhamento com o resto da UI e real).
 */
const INK = { left: 24.89, right: 487.12, top: 8, bottom: 504 };
const INK_HEIGHT = INK.bottom - INK.top;

/**
 * Centro OPTICO do simbolo: o centro de massa da tinta, medido rasterizando o
 * desenho. A cabeca pesa mais que a cauda, entao ele fica 2,4% acima do centro
 * da caixa. As letras centradas na caixa parecem baixas; centradas aqui, nao.
 */
const OPTICAL_CENTER_Y = 242.6;

/** Altura da maiuscula em relacao a altura do simbolo (referencia: 0,45). */
const CAP_RATIO = 0.48;
/** Espaco entre a tinta do simbolo e a haste do "L", em alturas de simbolo. */
const GAP_RATIO = 0.24;

const CAP = WORDMARK_CAP.baseline - WORDMARK_CAP.top;
const WORD_LEFT = 747;
const WORD_RIGHT = WORDMARK_DOT.cx + WORDMARK_DOT.r;
const scale = (CAP_RATIO * INK_HEIGHT) / CAP;
const capCenter = (WORDMARK_CAP.top + WORDMARK_CAP.baseline) / 2;
const tx = INK.right + GAP_RATIO * INK_HEIGHT - WORD_LEFT * scale;
const ty = OPTICAL_CENTER_Y - capCenter * scale;
const right = tx + WORD_RIGHT * scale;
const VIEW_BOX = `${INK.left} ${INK.top} ${right - INK.left} ${INK_HEIGHT}`;
const ASPECT = (right - INK.left) / INK_HEIGHT;
const WORD_TRANSFORM = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(5)})`;

type BrandLogoProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  /** Altura do simbolo em px; letras e espaco seguem a proporcao. */
  size?: number;
};

/**
 * Logo horizontal: simbolo + "Lumi".
 *
 * Mesmo desenho da referencia; a composicao (tamanho das letras, espaco,
 * alinhamento) e ajustada para a interface: letras no centro optico do
 * simbolo e um respiro de ~1/4 da altura dele.
 *
 * Simbolo e letras em `currentColor`; o pingo do "i" e o `--primary` do tema
 * ativo. Nada depende de `prefers-color-scheme`.
 */
export function BrandLogo({ size = 40, className, ...props }: BrandLogoProps) {
  const compact = size <= COMPACT_MARK_MAX_SIZE;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEW_BOX}
      height={size}
      width={Math.round(size * ASPECT)}
      fill="currentColor"
      role="img"
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    >
      <title>{BRAND_NAME}</title>
      <path fillRule="evenodd" d={compact ? MARK_COMPACT_PATH : MARK_PATH} />
      <g transform={WORD_TRANSFORM}>
        <path fillRule="evenodd" d={WORDMARK_PATH} />
        <circle className="fill-primary" {...WORDMARK_DOT} />
      </g>
    </svg>
  );
}
