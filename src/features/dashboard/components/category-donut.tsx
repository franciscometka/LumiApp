'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { MoneyText } from '@/components/finan/money-text';
import type { CategoryBreakdown, CategoryBreakdownItem } from '@/domain/calculations/by-category';
import { OTHER_CATEGORIES_ID } from '@/domain/calculations/by-category';
import type { Category } from '@/domain/entities/category';
import type { ID } from '@/domain/shared/id';
import { formatMoney } from '@/domain/shared/money';
import { displayPercentages, formatPercentage } from '@/domain/shared/percentage';

/**
 * Distribuicao de gastos por categoria.
 *
 * Decisoes que governam este componente:
 *
 * - **A UI nao agrupa.** O recorte em "Outros" ja veio pronto de
 *   `groupSmallCategories`, no dominio. Reagrupar aqui seria somar dinheiro
 *   dentro de um componente visual.
 *
 * - **A legenda e obrigatoria e carrega tudo.** Nome, valor e percentual ficam
 *   visiveis o tempo todo. No celular nao existe hover; um grafico que so
 *   revela os numeros ao passar o mouse e, no mobile, um grafico sem numeros.
 *
 * - **A cor nunca e a unica pista.** Dois dos cinco passos da escala ficam
 *   abaixo de 3:1 contra a superficie, e a legenda textual e justamente o
 *   alivio exigido por isso.
 *
 * Sobre a atribuicao de cor por posicao: com 11 categorias e 5 passos, uma cor
 * fixa por categoria produziria fatias repetidas no mesmo grafico — pior que
 * recolorir entre meses. A identidade estavel fica a cargo do nome na legenda.
 */
export function CategoryDonut({
  breakdown,
  categoriesById,
}: {
  breakdown: CategoryBreakdown;
  categoriesById: ReadonlyMap<ID, Category>;
}) {
  // Sem gasto nenhum nao existe distribuicao. Um donut de uma fatia cinza
  // seria um grafico falso: desenharia uma forma onde nao ha dado.
  if (breakdown.items.length === 0 || breakdown.totalCents === 0) {
    return (
      <Section>
        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          Nenhum gasto registrado neste mês.
        </div>
      </Section>
    );
  }

  /**
   * Percentuais da legenda normalizados de uma vez, pelo maior resto, a partir
   * dos valores exatos em centavos.
   *
   * Arredondar fatia por fatia exibia 44 + 35 + 17 + 5 = 101%, e uma legenda
   * que nao fecha 100 faz desconfiar da conta, nao do arredondamento. Isto
   * muda apenas o texto: as fatias desenhadas continuam vindo de `totalCents`
   * e o `item.percentage` do dominio segue intocado.
   */
  const normalized = displayPercentages(breakdown.items.map((item) => item.totalCents));

  const data = breakdown.items.map((item, index) => ({
    item,
    color: sliceColor(item, index),
    name: resolveName(item, categoriesById),
    // Sem normalizacao possivel, vale o percentual individual de antes.
    percentage: normalized?.[index] ?? item.percentage,
  }));

  return (
    <Section>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto size-40 shrink-0 sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={(entry: (typeof data)[number]) => entry.item.totalCents}
                innerRadius="64%"
                outerRadius="100%"
                // Uma unica categoria vira um anel inteiro, que continua
                // significando "100% aqui". Sem angulo de separacao nesse
                // caso, para o anel nao aparecer com uma fenda sem motivo.
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="var(--color-card)"
                strokeWidth={2}
                isAnimationActive={false}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry) => (
                  <Cell key={entry.item.categoryId} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                Total
              </p>
              <MoneyText value={breakdown.totalCents} size="sm" className="mt-0.5 block" />
            </div>
          </div>
        </div>

        <ul className="flex-1 space-y-2.5">
          {data.map((entry) => (
            <Legend
              key={entry.item.categoryId}
              name={entry.name}
              color={entry.color}
              item={entry.item}
              percentage={entry.percentage}
              categoriesById={categoriesById}
            />
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Gastos por categoria
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Legend({
  name,
  color,
  item,
  percentage,
  categoriesById,
}: {
  name: string;
  color: string;
  item: CategoryBreakdownItem;
  percentage: number | null;
  categoriesById: ReadonlyMap<ID, Category>;
}) {
  // "Outros" diz o que escondeu. Uma fatia anonima com 12% dos gastos e
  // exatamente o tipo de coisa que faz a pessoa desconfiar do app.
  const grouped = item.groupedCategoryIds
    ?.map((id) => categoriesById.get(id)?.name)
    .filter((value): value is string => value !== undefined);

  return (
    <li className="flex items-baseline gap-2.5">
      <span
        aria-hidden
        className="size-2.5 shrink-0 translate-y-0.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm">{name}</span>
          <span className="money text-sm font-medium tabular-nums">
            {formatMoney(item.totalCents)}
          </span>
        </div>
        {grouped !== undefined && grouped.length > 0 ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {grouped.join(', ')}
          </p>
        ) : null}
      </div>
      <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
        {formatPercentage(percentage)}
      </span>
    </li>
  );
}

const SLICE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

/** "Outros" nao e uma entidade: recebe neutro, nao um passo da escala. */
function sliceColor(item: CategoryBreakdownItem, index: number): string {
  if (item.categoryId === OTHER_CATEGORIES_ID) return 'var(--color-muted-foreground)';
  return SLICE_COLORS[index % SLICE_COLORS.length] as string;
}

function resolveName(item: CategoryBreakdownItem, categoriesById: ReadonlyMap<ID, Category>): string {
  if (item.categoryId === OTHER_CATEGORIES_ID) return 'Outros';
  return categoriesById.get(item.categoryId)?.name ?? 'Sem categoria';
}
