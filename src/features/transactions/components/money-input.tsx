'use client';

import { formatMoneyPlain, parseMoney } from '@/domain/shared/money';
import { cn } from '@/lib/utils';

/**
 * Campo de valor em reais.
 *
 * Tres decisoes merecem explicacao:
 *
 * **1. O estado e o texto que a pessoa digitou, nao um numero.**
 * Guardar `Money` aqui obrigaria a converter em cada tecla, e "10," — um
 * estado legitimo no meio da digitacao — nao tem representacao em centavos.
 * O texto e a verdade do campo; `parseMoney` o traduz uma vez, na validacao.
 *
 * **2. Nenhuma mascara enquanto se digita.**
 * Mascara reposiciona o cursor a cada tecla e, no Android, briga com a
 * correcao do teclado. O campo normaliza apenas no `blur`, quando a pessoa ja
 * saiu: "10,5" vira "10,50" e "1234,5" vira "1.234,50". Enquanto o foco esta
 * la, ela digita em paz.
 *
 * **3. `inputMode="decimal"`, nao `type="number"`.**
 * `type="number"` em pt-BR e uma armadilha: o navegador valida contra o
 * separador do *locale do sistema*, entao "10,50" pode virar valor vazio em
 * uma maquina configurada em ingles — e `valueAsNumber` traria float, que e
 * exatamente o que este projeto evita. `inputMode="decimal"` abre o teclado
 * numerico com virgula e deixa o texto intacto.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  invalid = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const normalizeOnBlur = () => {
    const parsed = parseMoney(value);
    // So reescreve o que ja e interpretavel. Texto invalido permanece na tela
    // para a pessoa corrigir — apagar o que ela escreveu seria pior.
    if (parsed !== null && parsed > 0) onChange(formatMoneyPlain(parsed));
  };

  return (
    <div className="relative">
      <span
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xl font-medium"
      >
        R$
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        // O teclado do iOS respeita `pattern` para mostrar a virgula.
        pattern="[0-9.,]*"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          // Deixa passar apenas o que pode compor um valor. Barrar letras na
          // origem evita o estado "R$ abc" e o erro que viria depois dele.
          onChange(event.target.value.replace(/[^\d.,]/g, ''));
        }}
        onBlur={normalizeOnBlur}
        aria-invalid={invalid}
        placeholder="0,00"
        className={cn(
          'bg-background border-input w-full rounded-lg border py-3 pr-4 pl-14 transition-colors',
          'money text-right text-3xl font-semibold tabular-nums',
          'placeholder:text-muted-foreground/50',
          'focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] focus-visible:outline-none',
          invalid && 'border-expense ring-expense/25 ring-[3px]',
        )}
      />
    </div>
  );
}
