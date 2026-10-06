import type { DatabaseStatus } from '../../ports/data-source';
import type { RecordIssue } from '../../ports/errors';
import { DataError, isDataError } from '../../ports/errors';
import {
  cardCodec,
  categoryCodec,
  debtCodec,
  monthlyPlanCodec,
  recurringBillCodec,
  transactionCodec,
  userSettingsCodec,
} from '../../serialization/codecs';
import type { Codec } from '../../serialization/codecs';
import type { Migration, RawDatabase } from './migrations';
import { MIGRATIONS, runMigrations } from './migrations';
import type { CollectionName, PersistedCollections, PersistedDatabase } from './persisted-schema';
import {
  CURRENT_SCHEMA_VERSION,
  COLLECTION_NAMES,
  countRecords,
  createEmptyCollections,
  createEmptyDatabase,
  persistedDatabaseSchema,
  readSchemaVersion,
} from './persisted-schema';
import type { StorageDriver } from './storage-driver';

const COLLECTION_CODECS: { [K in CollectionName]: Codec<PersistedCollections[K][number]> } = {
  transactions: transactionCodec,
  categories: categoryCodec,
  cards: cardCodec,
  debts: debtCodec,
  recurringBills: recurringBillCodec,
  monthlyPlans: monthlyPlanCodec,
};

export type Clock = () => string;

export interface LocalDatabaseOptions {
  readonly key: string;
  readonly driver: StorageDriver;
  readonly clock?: Clock;
  readonly migrations?: readonly Migration[];
  readonly targetVersion?: number;
}

export interface RecoveryReport {
  readonly recovered: number;
  readonly discarded: readonly RecordIssue[];
}

/**
 * Carga, validacao, migracao e gravacao do documento persistido.
 *
 * Decisoes que governam este arquivo:
 *
 * - **Validacao na leitura, sempre.** Nada sai do storage sem passar pelos
 *   schemas Zod. O app escreveu o JSON, mas o usuario, uma extensao ou uma
 *   versao anterior podem te-lo alterado.
 *
 * - **Validar uma vez por sessao.** A carga valida o documento inteiro e
 *   guarda o resultado em memoria; leituras seguintes usam o cache e as
 *   escritas o atualizam. Revalidar a cada consulta seria correto e inutil.
 *
 * - **Corrupcao recusa, nao apaga.** Um documento irreconhecivel faz a abertura
 *   falhar com `DataError` carregando o conteudo bruto. Quem decide o destino
 *   dos dados e o usuario, atraves da API de manutencao.
 *
 * - **Migracao grava uma vez.** Depois de migrado, o documento e persistido na
 *   versao nova imediatamente; o proximo carregamento ja encontra a versao
 *   atual e nao reexecuta nada.
 */
export class LocalDatabase {
  private readonly key: string;
  private readonly driver: StorageDriver;
  private readonly clock: Clock;
  private readonly migrations: readonly Migration[];
  private readonly targetVersion: number;

  private cache: PersistedDatabase | null = null;

  constructor(options: LocalDatabaseOptions) {
    this.key = options.key;
    this.driver = options.driver;
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.migrations = options.migrations ?? MIGRATIONS;
    this.targetVersion = options.targetVersion ?? CURRENT_SCHEMA_VERSION;
  }

  now(): string {
    return this.clock();
  }

  /** Esquece o cache. A proxima leitura volta ao storage. */
  invalidate(): void {
    this.cache = null;
  }

  /**
   * Documento pronto para uso. Lanca `DataError` se os dados nao puderem ser
   * abertos com seguranca.
   */
  load(): PersistedDatabase {
    if (this.cache !== null) return this.cache;

    const raw = this.driver.read(this.key);

    // Storage vazio nao e erro: e um app novo. Nada e gravado aqui — a
    // primeira escrita real e que materializa o documento.
    if (raw === null) {
      const empty = createEmptyDatabase(this.now());
      this.cache = empty;
      return empty;
    }

    const parsed = this.parseJson(raw);
    const version = readSchemaVersion(parsed);

    if (version === null) {
      throw new DataError(
        'corrupted_structure',
        'Os dados salvos nao tem versao de schema reconhecivel.',
        { rawSnapshot: raw },
      );
    }

    if (version > this.targetVersion) {
      throw new DataError(
        'unsupported_schema_version',
        `Estes dados foram gravados por uma versao mais nova do Finan (schema ${version}, suportado ate ${this.targetVersion}). Atualize o aplicativo para abri-los.`,
        { rawSnapshot: raw },
      );
    }

    let migrated: RawDatabase;
    let changed = false;

    try {
      const result = runMigrations(parsed, version, this.targetVersion, this.migrations);
      migrated = result.data;
      changed = result.changed;
    } catch (cause) {
      if (isDataError(cause)) {
        throw new DataError(cause.code, cause.message, { rawSnapshot: raw, cause });
      }
      throw new DataError('migration_failed', 'Falha ao migrar os dados salvos.', {
        rawSnapshot: raw,
        cause,
      });
    }

    const result = persistedDatabaseSchema.safeParse(migrated);
    if (!result.success) {
      throw new DataError(
        'corrupted_structure',
        'Os dados salvos nao correspondem ao formato esperado. Nada foi alterado.',
        { rawSnapshot: raw, issues: this.collectIssues(migrated) },
      );
    }

    this.cache = result.data;

    // Persistir a migracao imediatamente garante que ela rode uma unica vez,
    // mesmo entre recarregamentos da pagina.
    if (changed) this.persist(result.data);

    return result.data;
  }

  /**
   * Abre descartando apenas os registros invalidos.
   *
   * Nao grava: devolve o que conseguiu ler e a lista do que foi recusado, para
   * que o usuario veja exatamente o que perderia antes de confirmar.
   */
  recover(): RecoveryReport & { database: PersistedDatabase } {
    const raw = this.driver.read(this.key);
    if (raw === null) {
      return { database: createEmptyDatabase(this.now()), recovered: 0, discarded: [] };
    }

    const parsed = this.parseJson(raw);
    const version = readSchemaVersion(parsed) ?? this.targetVersion;

    let source: RawDatabase = parsed;
    if (version < this.targetVersion) {
      source = runMigrations(parsed, version, this.targetVersion, this.migrations).data;
    }

    const now = this.now();
    const database = createEmptyDatabase(now);
    const discarded: RecordIssue[] = [];
    let recovered = 0;

    const rawCollections = asRecord(source.collections);

    for (const name of COLLECTION_NAMES) {
      const rows = rawCollections === null ? null : rawCollections[name];
      if (!Array.isArray(rows)) {
        if (rows !== undefined) {
          discarded.push({
            collection: name,
            index: null,
            id: null,
            path: '',
            message: 'Colecao ausente ou com formato invalido',
          });
        }
        continue;
      }

      const codec = COLLECTION_CODECS[name];
      const kept: unknown[] = [];

      rows.forEach((row, index) => {
        const outcome = codec.safeParse(row, index);
        if (outcome.ok) {
          kept.push(outcome.value);
          recovered += 1;
        } else {
          discarded.push(...outcome.issues);
        }
      });

      // O cast e seguro: cada item de `kept` saiu do codec da propria colecao.
      (database.collections as Record<string, unknown[]>)[name] = kept;
    }

    const rawSettings = source.settings;
    if (rawSettings !== null && rawSettings !== undefined) {
      const outcome = userSettingsCodec.safeParse(rawSettings);
      if (outcome.ok) {
        database.settings = outcome.value;
      } else {
        discarded.push(...outcome.issues);
      }
    }

    const meta = asRecord(source.meta);
    if (meta !== null && typeof meta.seededAt === 'string') {
      database.meta = { ...database.meta, seededAt: meta.seededAt };
    }

    return { database, recovered, discarded };
  }

  /** Diagnostico. Nunca lanca: e o que se chama justamente quando algo quebrou. */
  status(): DatabaseStatus {
    const base = {
      currentSchemaVersion: this.targetVersion,
      issues: [] as readonly RecordIssue[],
      error: null as DataError | null,
    };

    let raw: string | null;
    try {
      raw = this.driver.read(this.key);
    } catch (cause) {
      return {
        ...base,
        state: 'corrupted',
        schemaVersion: null,
        recordCount: 0,
        seededAt: null,
        error: isDataError(cause)
          ? cause
          : new DataError('storage_unavailable', 'Falha ao ler o armazenamento.', { cause }),
      };
    }

    if (raw === null) {
      return {
        ...base,
        state: 'empty',
        schemaVersion: null,
        recordCount: 0,
        seededAt: null,
      };
    }

    try {
      const database = this.load();
      return {
        ...base,
        state: 'ready',
        schemaVersion: database.schemaVersion,
        recordCount: countRecords(database),
        seededAt: database.meta.seededAt ?? null,
      };
    } catch (cause) {
      const error = isDataError(cause)
        ? cause
        : new DataError('corrupted_structure', 'Falha ao abrir os dados salvos.', {
            rawSnapshot: raw,
            cause,
          });

      let schemaVersion: number | null = null;
      try {
        schemaVersion = readSchemaVersion(JSON.parse(raw));
      } catch {
        schemaVersion = null;
      }

      return {
        ...base,
        state: error.code === 'unsupported_schema_version' ? 'unsupported_version' : 'corrupted',
        schemaVersion,
        recordCount: 0,
        seededAt: null,
        issues: error.issues,
        error,
      };
    }
  }

  /**
   * Aplica uma alteracao e persiste.
   *
   * O rascunho e uma copia: se a funcao lancar, nem o cache nem o storage sao
   * tocados, e o estado anterior continua valido.
   */
  mutate<R>(apply: (draft: PersistedDatabase) => R): R {
    const current = this.load();
    const draft = cloneDatabase(current);

    const result = apply(draft);

    draft.meta = { ...draft.meta, updatedAt: this.now() };
    draft.schemaVersion = this.targetVersion;

    const validated = persistedDatabaseSchema.safeParse(draft);
    if (!validated.success) {
      throw new DataError(
        'validation_failed',
        'A alteracao deixaria os dados em estado invalido. Nada foi gravado.',
        { issues: this.collectIssues(draft) },
      );
    }

    this.persist(validated.data);
    this.cache = validated.data;

    return result;
  }

  exportRaw(): string | null {
    return this.driver.read(this.key);
  }

  exportJson(): string {
    return JSON.stringify(this.load(), null, 2);
  }

  importJson(content: string): void {
    const parsed = this.parseJson(content);
    const version = readSchemaVersion(parsed);

    if (version === null) {
      throw new DataError('corrupted_structure', 'O arquivo nao tem versao de schema reconhecivel.');
    }
    if (version > this.targetVersion) {
      throw new DataError(
        'unsupported_schema_version',
        `O arquivo foi gerado por uma versao mais nova do Finan (schema ${version}).`,
      );
    }

    const migrated = runMigrations(parsed, version, this.targetVersion, this.migrations).data;
    const result = persistedDatabaseSchema.safeParse(migrated);

    if (!result.success) {
      throw new DataError(
        'corrupted_structure',
        'O arquivo nao corresponde ao formato esperado. Nada foi importado.',
        { issues: this.collectIssues(migrated) },
      );
    }

    this.persist(result.data);
    this.cache = result.data;
  }

  /** Unica operacao destrutiva da camada. Chamada so com confirmacao explicita. */
  reset(): void {
    this.driver.remove(this.key);
    this.cache = null;
  }

  private persist(database: PersistedDatabase): void {
    this.driver.write(this.key, JSON.stringify(database));
  }

  private parseJson(raw: string): RawDatabase {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new DataError(
        'corrupted_json',
        'Os dados salvos nao sao um JSON valido. Nada foi alterado.',
        { rawSnapshot: raw, cause },
      );
    }

    const record = asRecord(parsed);
    if (record === null) {
      throw new DataError(
        'corrupted_structure',
        'Os dados salvos nao sao um objeto. Nada foi alterado.',
        { rawSnapshot: raw },
      );
    }

    return record;
  }

  /**
   * Percorre registro a registro para dizer exatamente o que esta errado.
   *
   * O erro bruto do Zod aponta "collections.transactions.3.amountCents"; esta
   * lista aponta a colecao, o indice e o id — o que a tela de recuperacao
   * precisa mostrar.
   */
  private collectIssues(source: RawDatabase): RecordIssue[] {
    const issues: RecordIssue[] = [];
    const rawCollections = asRecord(source.collections);

    if (rawCollections === null) {
      issues.push({
        collection: 'collections',
        index: null,
        id: null,
        path: 'collections',
        message: 'Bloco de colecoes ausente ou invalido',
      });
      return issues;
    }

    for (const name of COLLECTION_NAMES) {
      const rows = rawCollections[name];
      if (!Array.isArray(rows)) {
        issues.push({
          collection: name,
          index: null,
          id: null,
          path: `collections.${name}`,
          message: 'Colecao ausente ou com formato invalido',
        });
        continue;
      }

      const codec = COLLECTION_CODECS[name];
      rows.forEach((row, index) => {
        const outcome = codec.safeParse(row, index);
        if (!outcome.ok) issues.push(...outcome.issues);
      });
    }

    const rawSettings = source.settings;
    if (rawSettings !== null && rawSettings !== undefined) {
      const outcome = userSettingsCodec.safeParse(rawSettings);
      if (!outcome.ok) issues.push(...outcome.issues);
    }

    return issues;
  }
}

function asRecord(value: unknown): RawDatabase | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as RawDatabase;
}

/** Copia rasa por colecao: suficiente, porque as entidades sao tratadas como imutaveis. */
function cloneDatabase(database: PersistedDatabase): PersistedDatabase {
  const collections = createEmptyCollections();
  for (const name of COLLECTION_NAMES) {
    (collections as Record<string, unknown[]>)[name] = [...database.collections[name]];
  }

  return {
    schemaVersion: database.schemaVersion,
    meta: { ...database.meta },
    collections,
    settings: database.settings,
  };
}
