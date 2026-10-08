import { filterTransactions } from '@/domain/calculations/filters';
import type { TransactionFilter } from '@/domain/calculations/filters';
import type { Card } from '@/domain/entities/card';
import type { Category } from '@/domain/entities/category';
import type { Debt } from '@/domain/entities/debt';
import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { Transaction } from '@/domain/entities/transaction';
import type { UserSettings } from '@/domain/entities/user-settings';
import { DEFAULT_SALARY_DAY, DEFAULT_TIME_ZONE } from '@/domain/entities/user-settings';
import type { ID } from '@/domain/shared/id';
import { createId } from '@/domain/shared/id';
import type { MonthKey } from '@/domain/shared/plain-date';

import type {
  DataSource,
  DatabaseStatus,
  ImportPreview,
  MaintenanceApi,
} from '../../ports/data-source';
import type { RecordIssue } from '../../ports/errors';
import { DataError, notFound } from '../../ports/errors';
import type {
  CategoryRepository,
  MonthlyPlanRepository,
  RecurringBillRepository,
  SettingsRepository,
  TransactionRepository,
} from '../../ports/repositories';
import type {
  CreateInput,
  ListOptions,
  PersistedRecord,
  Repository,
  UpdateInput,
} from '../../ports/repository';
import type { Codec } from '../../serialization/codecs';
import {
  cardCodec,
  categoryCodec,
  debtCodec,
  monthlyPlanCodec,
  recurringBillCodec,
  transactionCodec,
  userSettingsCodec,
} from '../../serialization/codecs';
import { LocalDatabase } from './local-database';
import type { Clock } from './local-database';
import type { CollectionName, PersistedDatabase } from './persisted-schema';
import { STORAGE_KEY } from './persisted-schema';
import type { StorageDriver } from './storage-driver';
import { createBrowserStorageDriver } from './storage-driver';

export const LOCAL_USER_ID = 'local-user';

/** Gerador de identidade injetavel: os testes precisam de ids deterministicos. */
export type IdFactory = () => ID;

interface RepositoryContext {
  readonly database: LocalDatabase;
  readonly createId: IdFactory;
}

function visible<T extends PersistedRecord>(rows: readonly T[], options?: ListOptions): T[] {
  return options?.includeDeleted === true
    ? [...rows]
    : rows.filter((row) => row.deletedAt === undefined);
}

/**
 * Implementacao generica dos ports sobre uma colecao do documento local.
 *
 * Toda escrita passa pelo codec antes de entrar no array: o storage nunca
 * recebe uma entidade que o schema recusaria.
 *
 * Todos os metodos sao `async`, nao apenas tipados como `Promise`. A diferenca
 * importa: um metodo que declara `Promise<T>` mas lanca sincronamente quebra
 * quem usa `.catch()` — a excecao escapa antes da Promise existir. Com `async`,
 * a validacao do codec vira rejeicao, como o contrato promete.
 */
function createCollectionRepository<K extends CollectionName, T extends PersistedRecord>(
  context: RepositoryContext,
  collection: K,
  codec: Codec<T>,
): Repository<T> {
  const read = (): T[] => context.database.load().collections[collection] as unknown as T[];

  const write = (draft: PersistedDatabase, rows: readonly T[]): void => {
    (draft.collections as Record<string, unknown[]>)[collection] = [...rows];
  };

  return {
    async findAll(options?: ListOptions): Promise<T[]> {
      return visible(read(), options);
    },

    async findById(id: ID, options?: ListOptions): Promise<T | null> {
      return visible(read(), options).find((row) => row.id === id) ?? null;
    },

    async count(options?: ListOptions): Promise<number> {
      return visible(read(), options).length;
    },

    async create(input: CreateInput<T>): Promise<T> {
      const now = context.database.now();
      const entity = codec.parse({
        ...input,
        id: context.createId(),
        createdAt: now,
        updatedAt: now,
      });

      context.database.mutate((draft) => {
        write(draft, [...(draft.collections[collection] as unknown as T[]), entity]);
      });

      return entity;
    },

    async update(id: ID, patch: UpdateInput<T>): Promise<T> {
      const rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) throw notFound(collection, id);

      const current = rows[index] as T;
      const updated = codec.parse({
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: context.database.now(),
      });

      context.database.mutate((draft) => {
        const next = [...(draft.collections[collection] as unknown as T[])];
        next[index] = updated;
        write(draft, next);
      });

      return updated;
    },

    async remove(id: ID): Promise<void> {
      const rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) throw notFound(collection, id);

      const current = rows[index] as T;
      if (current.deletedAt !== undefined) return;

      const now = context.database.now();
      const removed = codec.parse({ ...current, deletedAt: now, updatedAt: now });

      context.database.mutate((draft) => {
        const next = [...(draft.collections[collection] as unknown as T[])];
        next[index] = removed;
        write(draft, next);
      });
    },

    async restore(id: ID): Promise<T> {
      const rows = read();
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) throw notFound(collection, id);

      const current = rows[index] as T;
      const { deletedAt: _deletedAt, ...rest } = current;
      const restored = codec.parse({ ...rest, updatedAt: context.database.now() });

      context.database.mutate((draft) => {
        const next = [...(draft.collections[collection] as unknown as T[])];
        next[index] = restored;
        write(draft, next);
      });

      return restored;
    },
  };
}

function createTransactionRepository(context: RepositoryContext): TransactionRepository {
  const base = createCollectionRepository<'transactions', Transaction>(
    context,
    'transactions',
    transactionCodec,
  );

  return {
    ...base,

    async findByFilter(filter: TransactionFilter, options?: ListOptions): Promise<Transaction[]> {
      const rows = await base.findAll(options);
      // A mesma funcao pura que o dominio usa. O adapter Supabase traduzira
      // este mesmo objeto para WHERE, sem mudar o contrato.
      return filterTransactions(rows, filter);
    },

    async findByCardId(cardId: ID, options?: ListOptions): Promise<Transaction[]> {
      const rows = await base.findAll(options);
      return rows.filter((row) => row.cardId === cardId);
    },

    async findByDebtId(debtId: ID, options?: ListOptions): Promise<Transaction[]> {
      const rows = await base.findAll(options);
      return rows.filter((row) => row.debtId === debtId);
    },

    async createMany(inputs: readonly CreateInput<Transaction>[]): Promise<Transaction[]> {
      if (inputs.length === 0) return [];

      const now = context.database.now();
      // Validar tudo ANTES de gravar: ou o lote inteiro entra, ou nada entra.
      const entities = inputs.map((input) =>
        transactionCodec.parse({
          ...input,
          id: context.createId(),
          createdAt: now,
          updatedAt: now,
        }),
      );

      context.database.mutate((draft) => {
        draft.collections.transactions = [...draft.collections.transactions, ...entities];
      });

      return entities;
    },

    /**
     * Insere so o que ainda nao existe, respeitando o id do chamador.
     *
     * A checagem de existencia acontece DENTRO do `mutate`, sobre o mesmo
     * snapshot que sera gravado — nao antes dele. E considera os registros
     * excluidos logicamente: uma ocorrencia apagada pelo usuario continua
     * ocupando o id, entao nao e recriada.
     */
    async insertManyIgnoringExisting(
      inputs: readonly (CreateInput<Transaction> & { id: ID })[],
    ): Promise<Transaction[]> {
      if (inputs.length === 0) return [];

      const now = context.database.now();
      const candidates = inputs.map((input) =>
        transactionCodec.parse({ ...input, createdAt: now, updatedAt: now }),
      );

      let inserted: Transaction[] = [];

      context.database.mutate((draft) => {
        // Inclui excluidos de proposito: o id continua ocupado.
        const taken = new Set(draft.collections.transactions.map((row) => row.id));
        inserted = candidates.filter((entity) => !taken.has(entity.id));

        if (inserted.length > 0) {
          draft.collections.transactions = [...draft.collections.transactions, ...inserted];
        }
      });

      return inserted;
    },
  };
}

function createCategoryRepository(context: RepositoryContext): CategoryRepository {
  const base = createCollectionRepository<'categories', Category>(
    context,
    'categories',
    categoryCodec,
  );

  return {
    ...base,
    async findByName(name: string): Promise<Category | null> {
      const rows = await base.findAll();
      const needle = name.trim().toLocaleLowerCase('pt-BR');
      return rows.find((row) => row.name.toLocaleLowerCase('pt-BR') === needle) ?? null;
    },
  };
}

function createRecurringBillRepository(context: RepositoryContext): RecurringBillRepository {
  const base = createCollectionRepository<'recurringBills', RecurringBill>(
    context,
    'recurringBills',
    recurringBillCodec,
  );

  return {
    ...base,
    async findActive(): Promise<RecurringBill[]> {
      const rows = await base.findAll();
      return rows.filter((row) => row.isActive);
    },
  };
}

function createMonthlyPlanRepository(context: RepositoryContext): MonthlyPlanRepository {
  const base = createCollectionRepository<'monthlyPlans', MonthlyPlan>(
    context,
    'monthlyPlans',
    monthlyPlanCodec,
  );

  return {
    ...base,
    async findByMonth(month: MonthKey): Promise<MonthlyPlan | null> {
      const rows = await base.findAll();
      return rows.find((row) => row.month === month) ?? null;
    },
  };
}

function createSettingsRepository(context: RepositoryContext, userId: ID): SettingsRepository {
  return {
    async get(): Promise<UserSettings> {
      const stored = context.database.load().settings;
      if (stored !== null) return stored;

      // Padroes nao sao gravados: o registro so nasce quando o usuario
      // efetivamente muda alguma preferencia.
      const now = context.database.now();
      return userSettingsCodec.parse({
        userId,
        currency: 'BRL',
        locale: 'pt-BR',
        timeZone: DEFAULT_TIME_ZONE,
        salaryDay: DEFAULT_SALARY_DAY,
        periodResolverId: 'civil-month',
        theme: 'dark',
        createdAt: now,
        updatedAt: now,
      });
    },

    async save(settings: UserSettings): Promise<UserSettings> {
      const next = userSettingsCodec.parse({
        ...settings,
        updatedAt: context.database.now(),
      });

      context.database.mutate((draft) => {
        draft.settings = next;
      });

      return next;
    },

    async exists(): Promise<boolean> {
      return context.database.load().settings !== null;
    },
  };
}

function createMaintenanceApi(database: LocalDatabase): MaintenanceApi {
  return {
    async status(): Promise<DatabaseStatus> {
      return database.status();
    },

    async exportRaw(): Promise<string | null> {
      return database.exportRaw();
    },

    async exportJson(): Promise<string> {
      return database.exportJson();
    },

    async previewImport(content: string): Promise<ImportPreview> {
      const valid = database.validateImport(content);
      const { collections } = valid;
      return {
        schemaVersion: valid.schemaVersion,
        counts: {
          transactions: collections.transactions.length,
          categories: collections.categories.length,
          cards: collections.cards.length,
          debts: collections.debts.length,
          recurringBills: collections.recurringBills.length,
          monthlyPlans: collections.monthlyPlans.length,
        },
        hasSettings: valid.settings !== null,
      };
    },

    async importJson(content: string): Promise<void> {
      database.importJson(content);
    },

    async recover(): Promise<{ recovered: number; discarded: readonly RecordIssue[] }> {
      const { recovered, discarded } = database.recover();
      return { recovered, discarded };
    },

    async reset(confirmation: 'apagar-tudo'): Promise<void> {
      if (confirmation !== 'apagar-tudo') {
        throw new DataError('validation_failed', 'Apagar os dados exige confirmação explícita.');
      }
      database.reset();
    },
  };
}

export interface LocalDataSourceOptions {
  readonly driver?: StorageDriver;
  readonly key?: string;
  readonly clock?: Clock;
  readonly createId?: IdFactory;
  readonly userId?: ID;
}

/**
 * `DataSource` mais a instancia de `LocalDatabase` que o sustenta.
 *
 * O seed precisa do documento bruto (para ler e gravar `meta.seededAt` e para
 * inserir tudo numa unica escrita atomica). Expor a mesma instancia e
 * obrigatorio: duas instancias sobre a mesma chave teriam caches
 * independentes e divergiriam na primeira escrita.
 */
export interface LocalStack {
  readonly dataSource: DataSource;
  readonly database: LocalDatabase;
  readonly userId: ID;
}

/**
 * Monta a pilha local.
 *
 * Sem `driver`, cria o de navegador — e e nesse momento, nao no import, que o
 * ambiente e verificado. Chamar isto no servidor lanca `storage_unavailable`.
 */
export function createLocalStack(options: LocalDataSourceOptions = {}): LocalStack {
  const driver = options.driver ?? createBrowserStorageDriver();

  const database = new LocalDatabase({
    key: options.key ?? STORAGE_KEY,
    driver,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });

  const context: RepositoryContext = {
    database,
    createId: options.createId ?? createId,
  };

  const userId = options.userId ?? LOCAL_USER_ID;

  const dataSource: DataSource = {
    id: `local:${driver.id}`,
    transactions: createTransactionRepository(context),
    categories: createCategoryRepository(context),
    cards: createCollectionRepository<'cards', Card>(context, 'cards', cardCodec),
    debts: createCollectionRepository<'debts', Debt>(context, 'debts', debtCodec),
    recurringBills: createRecurringBillRepository(context),
    monthlyPlans: createMonthlyPlanRepository(context),
    settings: createSettingsRepository(context, userId),
    maintenance: createMaintenanceApi(database),
  };

  return { dataSource, database, userId };
}

export function createLocalDataSource(options: LocalDataSourceOptions = {}): DataSource {
  return createLocalStack(options).dataSource;
}
