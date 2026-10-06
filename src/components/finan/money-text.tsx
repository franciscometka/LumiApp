import type { Money } from '@/domain/shared/money';
import { formatMoney, formatMoneySigned } from '@/domain/shared/money';
import { cn } from '@/lib/utils';

/**
 * Exibicao de valor monetario.
 *
 * Server Component: so formata e pinta. A formatacao em si vive no dominio
 * (`formatMoney`), nunca aqui — este componente escolhe tamanho e cor, nao
 * decide como um numero vira texto.
 *
 * `tabular-nums` e o detalhe que faz parecer app de banco: sem ele, trocar de
 * mes faz os digitos dancarem lateralmente porque "1" e mais estreito que "8".
 */

const SIZE_CLASSES = {
  sm: 'text-[15px]',
  md: 'text-[22px]',
  lg: 'text-3xl',
  hero: 'text-[2.75rem] leading-[1.05]',
} as const;

export type MoneySize = keyof typeof SIZE_CLASSES;

/** Como a cor deve reagir ao valor. */
export type MoneyTone =
  /** Herda a cor do texto ao redor. O padrao. */
  | 'inherit'
  /** Verde quando positivo, vermelho suave quando negativo, neutro no zero. */
  | 'signed'
  | 'income'
  | 'expense'
  | 'muted';

export function MoneyText({
  value,
  size = 'md',
  tone = 'inherit',
  showSign = false,
  className,
}: {
  value: Money;
  size?: MoneySize;
  tone?: MoneyTone;
  /** Prefixa "+" ou "−". O sinal de menos e o tipografico (U+2212). */
  showSign?: boolean;
  className?: string;
}) {
  const text = showSign
    ? formatMoneySigned(value, { minusSign: '−' })
    : formatMoney(value);

  return (
    <span
      className={cn(
        'money font-semibold',
        SIZE_CLASSES[size],
        tone === 'income' && 'text-income',
        tone === 'expense' && 'text-expense',
        tone === 'muted' && 'text-muted-foreground',
        // Zero fica neutro: pintar R$ 0,00 de verde sugeriria uma conquista
        // que nao houve.
        tone === 'signed' && value > 0 && 'text-income',
        tone === 'signed' && value < 0 && 'text-expense',
        className,
      )}
    >
      {text}
    </span>
  );
}

/**
 * Valor que pode nao existir.
 *
 * Metricas opcionais devem mostrar "—", nunca R$ 0,00: ausencia de informacao
 * nao e zero, e confundir as duas coisas e mentir sobre dinheiro.
 */
export function MoneyTextOrDash({
  value,
  fallback = '—',
  ...props
}: Omit<Parameters<typeof MoneyText>[0], 'value'> & {
  value: Money | null | undefined;
  fallback?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={cn('money text-muted-foreground font-semibold', SIZE_CLASSES[props.size ?? 'md'])}>
        {fallback}
      </span>
    );
  }
  return <MoneyText value={value} {...props} />;
}
