/**
 * Taxonomia de erros da camada de dados.
 *
 * Toda falha de persistencia vira um `DataError` com codigo conhecido. A UI
 * decide o que oferecer a partir do codigo — nunca a partir do texto da
 * mensagem, que e para humanos e pode mudar.
 *
 * Principio que atravessa este arquivo: a camada de dados NUNCA apaga nada por
 * conta propria. Quando algo esta corrompido ela recusa abrir, preserva o
 * conteudo bruto dentro do proprio erro e deixa a decisao (exportar, tentar
 * recuperar, resetar) para quem esta por cima.
 */

export const DATA_ERROR_CODES = [
  /** `localStorage` indisponivel: SSR, modo privado, storage bloqueado. */
  'storage_unavailable',
  /** A escrita falhou, tipicamente por cota estourada. */
  'storage_write_failed',
  /** O conteudo salvo nao e JSON valido. */
  'corrupted_json',
  /** O JSON e valido mas nao corresponde ao formato esperado. */
  'corrupted_structure',
  /** Dados gravados por uma versao mais nova do app. */
  'unsupported_schema_version',
  /** Nao existe caminho de migracao da versao salva ate a atual. */
  'migration_failed',
  /** Registro inexistente. */
  'not_found',
  /** A entidade recusada pelo schema antes de ser gravada. */
  'validation_failed',
] as const;

export type DataErrorCode = (typeof DATA_ERROR_CODES)[number];

/** Localiza com precisao um registro recusado pela validacao. */
export interface RecordIssue {
  readonly collection: string;
  /** Posicao no array persistido. Util quando o registro nem tem `id` legivel. */
  readonly index: number | null;
  readonly id: string | null;
  readonly path: string;
  readonly message: string;
}

export interface DataErrorOptions {
  readonly issues?: readonly RecordIssue[];
  /**
   * Conteudo bruto do storage no momento da falha.
   *
   * E o que torna a recuperacao possivel: mesmo sem conseguir interpretar os
   * dados, a UI consegue oferecer "baixar meus dados" antes de qualquer reset.
   */
  readonly rawSnapshot?: string | null;
  readonly cause?: unknown;
}

/**
 * Codigos em que existe conteudo a preservar e, portanto, faz sentido oferecer
 * exportacao/recuperacao ao usuario antes de qualquer acao destrutiva.
 */
const RECOVERABLE_CODES: ReadonlySet<DataErrorCode> = new Set([
  'corrupted_json',
  'corrupted_structure',
  'unsupported_schema_version',
  'migration_failed',
]);

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly issues: readonly RecordIssue[];
  readonly rawSnapshot: string | null;

  constructor(code: DataErrorCode, message: string, options: DataErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DataError';
    this.code = code;
    this.issues = options.issues ?? [];
    this.rawSnapshot = options.rawSnapshot ?? null;
  }

  /** Se a UI deve oferecer exportar/recuperar em vez de simplesmente seguir. */
  get isRecoverable(): boolean {
    return RECOVERABLE_CODES.has(this.code);
  }
}

export function isDataError(value: unknown): value is DataError {
  return value instanceof DataError;
}

export function notFound(collection: string, id: string): DataError {
  return new DataError('not_found', `Registro nao encontrado em ${collection}: ${id}`);
}
