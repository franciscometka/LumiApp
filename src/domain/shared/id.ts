/**
 * Identificadores sao UUID v4 desde a v1, mesmo com persistencia local.
 * Isso permite inserir os registros no Postgres (coluna `uuid`) sem remapear
 * chave nenhuma quando o Supabase entrar.
 */
export type ID = string;

export function createId(): ID {
  return crypto.randomUUID();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is ID {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Qualquer string nao vazia serve como ID no dominio. A validacao e
 * deliberadamente frouxa para nao travar seeds e fixtures legiveis
 * ("categoria-carro"); o formato UUID e garantido por `createId`.
 */
export function isId(value: unknown): value is ID {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Instante em ISO 8601 com fuso, usado em createdAt/updatedAt/deletedAt. */
export type Timestamp = string;

export function nowTimestamp(): Timestamp {
  return new Date().toISOString();
}

export function isTimestamp(value: unknown): value is Timestamp {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
