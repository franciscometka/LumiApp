export * from './ports';
export * from './provider';

export type { Codec, CodecResult, JsonValue } from './serialization/codecs';

export type { LocalStack, LocalDataSourceOptions } from './adapters/local/local-data-source';
export { createLocalDataSource, createLocalStack, LOCAL_USER_ID } from './adapters/local/local-data-source';

export type { StorageDriver } from './adapters/local/storage-driver';
export {
  createBrowserStorageDriver,
  createMemoryStorageDriver,
  isBrowserStorageAvailable,
} from './adapters/local/storage-driver';

export {
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
  type PersistedDatabase,
} from './adapters/local/persisted-schema';

export type { Migration } from './adapters/local/migrations';
export { MIGRATIONS } from './adapters/local/migrations';

export type { SeedResult, SeedOutcome } from './seed/seed';
export { seedIfEmpty } from './seed/seed';
export { SEED_IDS } from './seed/demo-data';
