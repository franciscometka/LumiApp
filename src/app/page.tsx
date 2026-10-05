import { ThemeToggle } from '@/components/theme/theme-toggle';

/**
 * Tela de fundacao do Lote 0.
 * Unico proposito: provar que tema, fonte, tokens e pipeline do Tailwind estao
 * de pe nos dois modos. Sera substituida pela Dashboard no Lote 4.
 */

const surfaceTokens = [
  { name: 'background', className: 'bg-background' },
  { name: 'card', className: 'bg-card' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'border', className: 'bg-border' },
];

const chartTokens = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8 sm:px-8 sm:py-14">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-[15px] font-semibold">
            F
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Finan</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center py-16">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Lote 0 &middot; Fundacao
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Design system no ar.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-[15px] leading-relaxed">
          Tokens, tipografia e tema claro/escuro validados. O dominio financeiro
          entra no Lote 1.
        </p>

        <section className="bg-card mt-12 rounded-xl border p-5">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Superficies
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {surfaceTokens.map((token) => (
              <div
                key={token.name}
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
              >
                <span className={`size-4 rounded-sm border ${token.className}`} />
                <span className="text-muted-foreground font-mono text-[11px]">
                  {token.name}
                </span>
              </div>
            ))}
          </div>

          <h2 className="text-muted-foreground mt-7 text-xs font-medium tracking-wide uppercase">
            Cores funcionais
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="bg-income-surface rounded-lg px-4 py-3">
              <p className="text-income text-[11px] font-medium tracking-wide uppercase">
                Entrada
              </p>
              <p className="money text-income mt-1 text-[22px] font-semibold">
                + R$ 3.100,00
              </p>
            </div>
            <div className="bg-expense-surface rounded-lg px-4 py-3">
              <p className="text-expense text-[11px] font-medium tracking-wide uppercase">
                Saida
              </p>
              <p className="money text-expense mt-1 text-[22px] font-semibold">
                &minus; R$ 2.610,00
              </p>
            </div>
          </div>

          <h2 className="text-muted-foreground mt-7 text-xs font-medium tracking-wide uppercase">
            Escala de graficos
          </h2>
          <div className="mt-3 flex gap-1.5">
            {chartTokens.map((token) => (
              <span key={token} className={`h-9 flex-1 rounded-md ${token}`} />
            ))}
          </div>
        </section>
      </div>

      <footer className="text-muted-foreground border-t pt-6 text-xs">
        Next.js &middot; TypeScript strict &middot; Tailwind CSS &middot; shadcn/ui
      </footer>
    </main>
  );
}
