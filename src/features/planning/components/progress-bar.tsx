'use client';

import { clampPercentage, formatPercentage } from '@/domain/shared/percentage';
import { cn } from '@/lib/utils';

/**
 * Barra de progresso de uma meta.
 *
 * ## O clamp mora AQUI, e só aqui
 *
 * O dominio entrega o percentual com sinal: economia projetada de -R$ 110
 * contra meta de R$ 500 e **-22%**. Uma barra de -22% nao existe graficamente,
 * entao a largura e limitada a 0-100 — mas esse limite e uma decisao de
 * desenho, nao de financas.
 *
 * O numero exibido ao lado continua sendo o real. Se o clamp subisse para o
 * dominio, "nao economizou nada" e "ficou R$ 110 no vermelho" virariam o mesmo
 * 0%, e a tela perderia a diferenca entre empatar e perder.
 *
 * `null` nunca vira 0%: sem meta declarada a barra some e o valor e "—".
 */
export function ProgressBar({
  percentage,
  secondaryPercentage,
  tone = 'primary',
}: {
  /** Valor REAL, com sinal. O clamp acontece dentro deste componente. */
  percentage: number | null;
  /**
   * Fracao ja realizada, desenhada solida sobre a mesma trilha. Usada nos
   * gastos para separar o que ja saiu da conta do que apenas esta lancado.
   */
  secondaryPercentage?: number | null;
  tone?: 'primary' | 'expense' | 'income';
}) {
  if (percentage === null) return null;

  const width = clampPercentage(percentage);
  const solidWidth = secondaryPercentage === null || secondaryPercentage === undefined
    ? null
    : clampPercentage(secondaryPercentage);

  const fill =
    tone === 'expense' ? 'bg-expense' : tone === 'income' ? 'bg-income' : 'bg-primary';

  return (
    <div
      className="bg-muted relative mt-2 h-2 overflow-hidden rounded-full"
      role="presentation"
    >
      {/* Camada clara: tudo que esta comprometido. */}
      <div
        className={cn('absolute inset-y-0 left-0 rounded-full opacity-40', fill)}
        style={{ width: `${String(width)}%` }}
      />
      {/* Camada solida: o que ja foi efetivamente pago. */}
      {solidWidth === null ? null : (
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full', fill)}
          style={{ width: `${String(solidWidth)}%` }}
        />
      )}
    </div>
  );
}

/**
 * Cabecalho de uma meta: rotulo e percentual em cima, valores embaixo.
 *
 * Empilhado de proposito. Numa unica linha, "Gastos R$ 2.610,00 de R$ 2.500,00
 * 104%" quebra no meio do segundo valor a 375px, separando o "R$" do numero —
 * exatamente o tipo de quebra que faz um app de dinheiro parecer descuidado.
 */
export function GoalRow({
  label,
  hint,
  percentage,
  children,
}: {
  label: string;
  /** Definicao curta da grandeza, quando o nome sozinho nao basta. */
  hint?: string;
  percentage: number | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-[13px]">{label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatPercentage(percentage)}
        </span>
      </div>
      <div className="mt-0.5 text-sm">{children}</div>
      {hint === undefined ? null : (
        <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>
      )}
    </div>
  );
}
