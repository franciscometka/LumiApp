import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Campos de formulario.
 *
 * `<select>` nativo de proposito. No celular ele abre o seletor do proprio
 * sistema — rolagem com inercia, alcance do polegar, acessibilidade de graca —
 * e nenhum componente feito a mao empata com isso. Um dropdown customizado
 * aqui seria trabalho para piorar.
 *
 * A altura minima e 44px: alvo de toque confortavel, nao 32px de formulario de
 * desktop.
 */

const CONTROL = cn(
  'bg-background border-input w-full rounded-lg border px-3 text-[15px] transition-colors',
  'min-h-11 placeholder:text-muted-foreground/70',
  'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-invalid:border-expense aria-invalid:ring-expense/25',
);

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error === undefined ? (
        hint === undefined ? null : (
          <p className="text-muted-foreground text-xs">{hint}</p>
        )
      ) : (
        // `role="alert"` para que o leitor de tela anuncie o erro no momento
        // em que ele aparece, sem precisar reencontrar o campo.
        <p role="alert" className="text-expense text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        CONTROL,
        // `appearance-none` mais a seta desenhada: sem isso o controle nativo
        // fica com a altura do sistema e desalinha das outras linhas.
        'appearance-none bg-[length:1.1rem] bg-[right_0.6rem_center] bg-no-repeat py-2 pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-20 resize-y py-2.5', className)} {...props} />;
}
