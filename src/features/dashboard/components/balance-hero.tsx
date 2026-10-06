import { MoneyText } from '@/components/finan/money-text';
import type { PeriodSnapshot } from '@/domain/calculations/snapshot';
import { cn } from '@/lib/utils';

/**
 * Elemento principal da tela. Um numero grande e uma linha de contexto.
 *
 * Os dois saldos sao coisas diferentes e aparecem rotulados como tal:
 *
 * - "Saldo atual" e o REALIZADO — o que de fato ja passou pela conta. Nao e
 *   "disponivel": com faturas por vencer, parte dele ja esta comprometida, e
 *   chamar de disponivel convidaria a gastar dinheiro que tem dono.
 *   E o numero que responde "quanto tenho agora?".
 * - "Projetado para o fim do mês" inclui o que ainda vai entrar e sair. E o
 *   numero que responde "vou fechar no azul?".
 *
 * Mostrar so o primeiro faz a pessoa se achar rica com faturas por vencer;
 * mostrar so o segundo a faz se achar pobre antes do salario cair. Os dois,
 * com nomes claros, e a unica forma honesta.
 *
 * Saldo negativo usa a cor funcional de saida, nunca `destructive`: ficar no
 * vermelho e uma situacao financeira, nao um erro do sistema.
 */
export function BalanceHero({ snapshot }: { snapshot: PeriodSnapshot }) {
  const { totals, temporality, period } = snapshot;
  const copy = HERO_COPY[temporality];
  const primary = temporality === 'current' ? totals.realizedBalance : totals.balance;
  const isNegative = primary < 0;

  return (
    <section
      className={cn(
        'rounded-2xl border px-5 py-6 lg:px-7 lg:py-8',
        isNegative ? 'bg-expense-surface border-transparent' : 'bg-card',
      )}
    >
      <p
        className={cn(
          'text-xs font-medium tracking-wide uppercase',
          isNegative ? 'text-expense' : 'text-muted-foreground',
        )}
      >
        {copy.label}
        <span className="normal-case"> · </span>
        <span className="normal-case first-letter:uppercase">{period.label}</span>
      </p>

      <div className="mt-2">
        <MoneyText value={primary} size="hero" tone={isNegative ? 'expense' : 'inherit'} />
      </div>

      <SecondaryLine snapshot={snapshot} />
    </section>
  );
}

const HERO_COPY = {
  current: { label: 'Saldo atual' },
  past: { label: 'Saldo do mês' },
  future: { label: 'Saldo previsto' },
} as const;

/**
 * A linha de apoio muda com o tempo do periodo.
 *
 * No mes corrente ela projeta o fechamento. Em um mes encerrado, projetar nao
 * faz sentido — o que ainda interessa e se algo ficou em aberto. Em um mes
 * futuro nao ha nada realizado para comparar.
 */
function SecondaryLine({ snapshot }: { snapshot: PeriodSnapshot }) {
  const { totals, temporality } = snapshot;

  if (totals.transactionCount === 0) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        {temporality === 'future'
          ? 'Nenhum lançamento previsto para este mês.'
          : 'Nenhum lançamento neste mês.'}
      </p>
    );
  }

  if (temporality === 'current') {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        Projetado para o fim do mês{' '}
        <MoneyText
          value={totals.balance}
          size="sm"
          tone="signed"
          className="text-foreground ml-0.5"
        />
      </p>
    );
  }

  if (temporality === 'past' && totals.pendingCount > 0) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        {totals.pendingCount === 1 ? '1 conta ficou' : `${totals.pendingCount} contas ficaram`} em
        aberto neste mês
      </p>
    );
  }

  if (temporality === 'future') {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        Com base no que já está lançado para este mês.
      </p>
    );
  }

  return <p className="text-muted-foreground mt-3 text-sm">Mês encerrado, tudo pago.</p>;
}
