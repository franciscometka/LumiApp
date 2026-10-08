import { DataError } from '../../ports/errors';
import { CURRENT_SCHEMA_VERSION } from './persisted-schema';

/** Documento persistido ainda nao validado. */
export type RawDatabase = Record<string, unknown>;

export interface Migration {
  readonly from: number;
  readonly to: number;
  readonly description: string;
  /** Deve ser pura: recebe o documento e devolve um novo, sem mutar a entrada. */
  migrate(data: RawDatabase): RawDatabase;
}

/**
 * Registro de migracoes.
 *
 * Vazio na v1 porque esta e a primeira versao do formato. A estrutura ja
 * existe para que a primeira mudanca de schema seja apenas adicionar um item
 * aqui — e nao reprojetar a carga de dados com o app em producao.
 *
 * Contrato de cada migracao:
 * - `to` sempre maior que `from` (o runner recusa o contrario);
 * - nenhum campo e removido sem que o dado tenha para onde ir;
 * - a funcao e pura e idempotente em relacao ao documento que recebe.
 */
export const MIGRATIONS: readonly Migration[] = [];

export interface MigrationResult {
  readonly data: RawDatabase;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly applied: readonly string[];
  /** Se houve mudanca a persistir. */
  readonly changed: boolean;
}

/**
 * Valida o registro antes de executar qualquer coisa.
 *
 * Esta checagem e o que impede loop infinito de migracao: sem passos que
 * retrocedem ou ficam parados, e com no maximo um passo por versao de origem,
 * a cadeia e estritamente crescente e termina sempre.
 */
export function assertMigrationRegistry(migrations: readonly Migration[]): void {
  const origins = new Set<number>();

  for (const migration of migrations) {
    if (!Number.isInteger(migration.from) || !Number.isInteger(migration.to)) {
      throw new DataError(
        'migration_failed',
        `Migracao com versao nao inteira: ${migration.description}`,
      );
    }

    if (migration.to <= migration.from) {
      throw new DataError(
        'migration_failed',
        `Migracao nao avanca a versao (${migration.from} -> ${migration.to}): ${migration.description}`,
      );
    }

    if (origins.has(migration.from)) {
      throw new DataError(
        'migration_failed',
        `Ha mais de uma migracao saindo da versao ${migration.from}. O caminho seria ambiguo.`,
      );
    }

    origins.add(migration.from);
  }
}

/**
 * Leva o documento da versao gravada ate a versao alvo.
 *
 * Nao escreve nada e nao conhece storage: recebe e devolve documento. Quem
 * persiste o resultado e o `LocalDatabase`, uma unica vez.
 */
export function runMigrations(
  data: RawDatabase,
  fromVersion: number,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationResult {
  assertMigrationRegistry(migrations);

  if (fromVersion > targetVersion) {
    throw new DataError(
      'unsupported_schema_version',
      `Os dados foram gravados pela versao ${fromVersion}, mais nova que a suportada (${targetVersion}).`,
    );
  }

  if (fromVersion === targetVersion) {
    return {
      data,
      fromVersion,
      toVersion: targetVersion,
      applied: [],
      changed: false,
    };
  }

  let current = data;
  let version = fromVersion;
  const applied: string[] = [];

  // Limite rigido: mesmo com um registro adulterado, o laco termina.
  const maxSteps = migrations.length + 1;

  for (let step = 0; step < maxSteps; step += 1) {
    if (version === targetVersion) break;

    const migration = migrations.find((candidate) => candidate.from === version);
    if (migration === undefined) {
      throw new DataError(
        'migration_failed',
        `Não existe migração da versão ${version} para ${targetVersion}. Os dados foram preservados.`,
      );
    }

    if (migration.to > targetVersion) {
      throw new DataError(
        'migration_failed',
        `A migracao "${migration.description}" ultrapassa a versao alvo (${migration.to} > ${targetVersion}).`,
      );
    }

    try {
      current = { ...migration.migrate(current), schemaVersion: migration.to };
    } catch (cause) {
      throw new DataError(
        'migration_failed',
        `A migracao "${migration.description}" falhou. Os dados originais foram preservados.`,
        { cause },
      );
    }

    applied.push(migration.description);
    version = migration.to;
  }

  if (version !== targetVersion) {
    throw new DataError(
      'migration_failed',
      `A cadeia de migracoes parou na versao ${version} sem alcancar ${targetVersion}.`,
    );
  }

  return {
    data: current,
    fromVersion,
    toVersion: targetVersion,
    applied,
    changed: applied.length > 0,
  };
}
