'use client';

import { Field } from '@/components/ui/field';
import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';
import { cn } from '@/lib/utils';

/**
 * Campo de dinheiro em linha de formulario.
 *
 * Mesmas regras do campo grande de lancamento, em tamanho de formulario:
 * o estado e o TEXTO digitado, `parseMoney` e o unico conversor, e a
 * normalizacao acontece no `blur` — nunca a cada tecla, que brigaria com o
 * cursor e com o teclado do Android.
 *
 * `inputMode="decimal"` e nao `type="number"`: este ultimo valida contra o
 * separador do locale do sistema, e "1.234,56" pode virar campo vazio numa
 * maquina configurada em ingles.
 */
export function MoneyField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = '0,00',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string;
}) {
  const normalizeOnBlur = () => {
    const parsed = parseMoney(value);
    // Texto invalido fica como esta, para a pessoa corrigir. Apagar o que ela
    // escreveu seria pior do que mostrar o erro.
    if (parsed !== null && parsed >= 0) onChange(formatMoneyPlain(parsed));
  };

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <span
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium"
        >
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value.replace(/[^\d.,]/g, ''));
          }}
          onBlur={normalizeOnBlur}
          aria-invalid={error !== undefined}
          placeholder={placeholder}
          className={cn(
            'bg-background border-input min-h-11 w-full rounded-lg border py-2 pr-3 pl-10',
            'money text-right text-[15px] font-semibold tabular-nums transition-colors',
            'placeholder:text-muted-foreground/60 placeholder:font-normal',
            'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none',
            error !== undefined && 'border-expense ring-expense/25 ring-[3px]',
          )}
        />
      </div>
    </Field>
  );
}
