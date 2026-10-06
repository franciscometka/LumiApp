import { z } from 'zod';

import { dayOfMonthSchema, idSchema, timestampSchema } from '../shared/schemas';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/**
 * `salaryDay` responde a pergunta "quanto posso gastar ate o proximo salario?".
 * Na v1 ele nao define o periodo — o ciclo e o mes civil. Quando o
 * `salaryCycleResolver` existir, e deste campo que ele vai sair.
 *
 * `periodResolverId` ja esta aqui para que a troca de ciclo seja uma mudanca
 * de preferencia, nao uma migracao de dados.
 */
export const userSettingsSchema = z.object({
  userId: idSchema,
  currency: z.literal('BRL'),
  locale: z.literal('pt-BR'),
  timeZone: z.string().min(1),
  salaryDay: dayOfMonthSchema,
  periodResolverId: z.literal('civil-month'),
  theme: z.enum(THEME_PREFERENCES),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
export const DEFAULT_SALARY_DAY = 5;
