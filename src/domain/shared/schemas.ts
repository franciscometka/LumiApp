import { z } from 'zod';

import type { ID, Timestamp } from './id';
import { isId, isTimestamp } from './id';
import type { Money } from './money';
import { MONEY_MAX_CENTS, isMoney } from './money';
import type { MonthKey, PlainDate } from './plain-date';
import { isValidMonthKey, isValidPlainDate } from './plain-date';

/**
 * Primitivos validados na fronteira dos dados.
 *
 * Usamos `z.custom` em vez de `z.number()` / `z.string()` encadeados porque ele
 * preserva o tipo nominal (`Money`, `PlainDate`) na entrada e na saida. Nenhum
 * schema aqui faz coercao: converter texto em centavos e responsabilidade da
 * camada de formulario, nao do dominio.
 */

export const idSchema = z.custom<ID>(isId, {
  message: 'Identificador invalido',
});

export const timestampSchema = z.custom<Timestamp>(isTimestamp, {
  message: 'Instante invalido (esperado ISO 8601)',
});

export const moneySchema = z.custom<Money>(isMoney, {
  message: `Valor deve ser um inteiro em centavos entre -${MONEY_MAX_CENTS} e ${MONEY_MAX_CENTS}`,
});

/** Para campos que nao admitem zero nem negativo, como o valor de uma transacao. */
export const positiveMoneySchema = z.custom<Money>(
  (value) => isMoney(value) && value > 0,
  { message: 'Valor deve ser maior que zero' },
);

/** Para limites e metas, onde zero e legitimo mas negativo nao. */
export const nonNegativeMoneySchema = z.custom<Money>(
  (value) => isMoney(value) && value >= 0,
  { message: 'Valor nao pode ser negativo' },
);

export const plainDateSchema = z.custom<PlainDate>(isValidPlainDate, {
  message: 'Data invalida (esperado YYYY-MM-DD)',
});

export const monthKeySchema = z.custom<MonthKey>(isValidMonthKey, {
  message: 'Mes invalido (esperado YYYY-MM)',
});

/** Dia do mes para vencimentos e fechamentos. 31 e aceito e depois ajustado
 *  ao ultimo dia do mes por `makePlainDateClamped`. */
export const dayOfMonthSchema = z.number().int().min(1).max(31);

export const shortTextSchema = z.string().trim().min(1).max(120);
export const longTextSchema = z.string().trim().max(1000);
