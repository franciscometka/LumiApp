import { beforeEach, describe, expect, it, vi } from 'vitest';

import { briefingScenario } from '@/domain/__testing__/factories';

import { DataError, isDataError } from '../../ports/errors';
import { transactionCodec } from '../../serialization/codecs';
import { LocalDatabase } from './local-database';
import type { Migration, RawDatabase } from './migrations';
import { CURRENT_SCHEMA_VERSION, createEmptyDatabase } from './persisted-schema';
import { createMemoryStorageDriver } from './storage-driver';

const KEY = 'finan:test';
const NOW = '2026-10-15T12:00:00.000Z';

function makeDatabase(initial?: string, migrations?: readonly Migration[]) {
  const driver = createMemoryStorageDriver(initial === undefined ? {} : { [KEY]: initial });
  const database = new LocalDatabase({
    key: KEY,
    driver,
    clock: () => NOW,
    ...(migrations === undefined ? {} : { migrations }),
  });
  return { driver, database };
}

function validDocument(overrides: Partial<RawDatabase> = {}): string {
  return JSON.stringify({ ...createEmptyDatabase(NOW), ...overrides });
}

function documentWithTransactions(): string {
  const base = createEmptyDatabase(NOW);
  return JSON.stringify({
    ...base,
    collections: {
      ...base.collections,
      transactions: briefingScenario().map((item) => transactionCodec.serialize(item)),
    },
  });
}

describe('storage vazio', () => {
  it('abre um documento vazio na versao atual', () => {
    const { database } = makeDatabase();
    const result = database.load();

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.collections.transactions).toEqual([]);
    expect(result.settings).toBeNull();
  });

  it('nao grava nada so por ter sido lido', () => {
    // Leitura nao deve ter efeito colateral: o documento so nasce na primeira
    // escrita real.
    const { driver, database } = makeDatabase();
    database.load();

    expect(driver.read(KEY)).toBeNull();
    expect(database.status().state).toBe('empty');
  });

  it('persiste a partir da primeira alteracao', () => {
    const { driver, database } = makeDatabase();
    database.mutate((draft) => {
      draft.meta = { ...draft.meta, seededAt: NOW };
    });

    expect(driver.read(KEY)).not.toBeNull();
    expect(database.status().state).toBe('ready');
  });
});

describe('versao atual', () => {
  it('abre sem migrar e sem reescrever', () => {
    const conteudo = documentWithTransactions();
    const { driver, database } = makeDatabase(conteudo);

    const result = database.load();

    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.collections.transactions).toHaveLength(9);
    expect(driver.read(KEY)).toBe(conteudo);
  });

  it('reconstroi os tipos nominais pela validacao, nao por cast', () => {
    const { database } = makeDatabase(documentWithTransactions());
    const [primeira] = database.load().collections.transactions;

    expect(typeof primeira?.amountCents).toBe('number');
    expect(Number.isSafeInteger(primeira?.amountCents)).toBe(true);
    expect(primeira?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('status informa o estado e a contagem', () => {
    const { database } = makeDatabase(documentWithTransactions());
    const status = database.status();

    expect(status.state).toBe('ready');
    expect(status.schemaVersion).toBe(1);
    expect(status.recordCount).toBe(9);
    expect(status.error).toBeNull();
    expect(status.issues).toEqual([]);
  });
});

describe('versao antiga', () => {
  const migrations: Migration[] = [
    {
      from: 1,
      to: 2,
      description: 'adiciona bloco de teste',
      migrate: (data) => ({ ...data, marcadorDeMigracao: true }),
    },
  ];

  function makeV2Database(initial: string) {
    const driver = createMemoryStorageDriver({ [KEY]: initial });
    const database = new LocalDatabase({
      key: KEY,
      driver,
      clock: () => NOW,
      migrations,
      targetVersion: 2,
    });
    return { driver, database };
  }

  it('migra da versao antiga para a atual', () => {
    const { database } = makeV2Database(documentWithTransactions());
    const result = database.load();

    expect(result.schemaVersion).toBe(2);
    expect(result.collections.transactions).toHaveLength(9);
  });

  it('persiste a migracao imediatamente, para nao reexecutar entre sessoes', () => {
    const { driver, database } = makeV2Database(validDocument());
    database.load();

    const salvo = JSON.parse(driver.read(KEY) as string) as RawDatabase;
    expect(salvo.schemaVersion).toBe(2);
  });

  it('executa a migracao uma unica vez, mesmo com varias leituras', () => {
    const spy = vi.fn((data: RawDatabase) => ({ ...data, migrada: true }));
    const driver = createMemoryStorageDriver({ [KEY]: validDocument() });

    const abrir = () =>
      new LocalDatabase({
        key: KEY,
        driver,
        clock: () => NOW,
        migrations: [{ from: 1, to: 2, description: 'unica', migrate: spy }],
        targetVersion: 2,
      });

    // Tres leituras na mesma instancia: o cache evita reexecutar.
    const primeira = abrir();
    primeira.load();
    primeira.load();
    primeira.load();
    expect(spy).toHaveBeenCalledTimes(1);

    // Nova instancia sobre o MESMO storage: ja encontra a versao 2 gravada.
    abrir().load();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('nao perde dados ao migrar', () => {
    const { database } = makeV2Database(documentWithTransactions());
    const total = database
      .load()
      .collections.transactions.reduce((soma, item) => soma + item.amountCents, 0);

    expect(total).toBe(310000 + 261000);
  });
});

describe('versao futura', () => {
  it('recusa abrir e preserva o conteudo', () => {
    const futuro = JSON.stringify({ ...JSON.parse(validDocument()), schemaVersion: 99 });
    const { driver, database } = makeDatabase(futuro);

    try {
      database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect(isDataError(error)).toBe(true);
      expect((error as DataError).code).toBe('unsupported_schema_version');
      expect((error as DataError).rawSnapshot).toBe(futuro);
      expect((error as DataError).isRecoverable).toBe(true);
    }

    // Nada foi apagado nem sobrescrito.
    expect(driver.read(KEY)).toBe(futuro);
  });

  it('status reporta unsupported_version sem lancar', () => {
    const futuro = JSON.stringify({ ...JSON.parse(validDocument()), schemaVersion: 99 });
    const { database } = makeDatabase(futuro);
    const status = database.status();

    expect(status.state).toBe('unsupported_version');
    expect(status.schemaVersion).toBe(99);
    expect(status.currentSchemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(status.error?.code).toBe('unsupported_schema_version');
  });
});

describe('JSON invalido', () => {
  const lixo = '{"schemaVersion": 1, isso nao e json';

  it('recusa com codigo corrupted_json e preserva o bruto', () => {
    const { driver, database } = makeDatabase(lixo);

    try {
      database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('corrupted_json');
      expect((error as DataError).rawSnapshot).toBe(lixo);
    }

    expect(driver.read(KEY)).toBe(lixo);
  });

  it('status nao lanca e expoe o erro', () => {
    const { database } = makeDatabase(lixo);
    const status = database.status();

    expect(status.state).toBe('corrupted');
    expect(status.error?.code).toBe('corrupted_json');
    expect(status.schemaVersion).toBeNull();
  });

  it('exportRaw continua funcionando com dados corrompidos', () => {
    // E o que sustenta o "baixe seus dados antes de resetar".
    const { database } = makeDatabase(lixo);
    expect(database.exportRaw()).toBe(lixo);
  });

  it('trata conteudo que nao e objeto', () => {
    expect(() => makeDatabase('[]').database.load()).toThrow(DataError);
    expect(() => makeDatabase('"texto"').database.load()).toThrow(DataError);
    expect(() => makeDatabase('null').database.load()).toThrow(DataError);
  });
});

describe('dados estruturalmente invalidos', () => {
  function documentoComTransacaoRuim(): string {
    const base = JSON.parse(documentWithTransactions()) as {
      collections: { transactions: Record<string, unknown>[] };
    };
    base.collections.transactions[2] = { ...base.collections.transactions[2], amountCents: -5 };
    base.collections.transactions[4] = { ...base.collections.transactions[4], date: '2026-02-30' };
    return JSON.stringify(base);
  }

  it('recusa abrir e aponta exatamente o que esta errado', () => {
    const conteudo = documentoComTransacaoRuim();
    const { database } = makeDatabase(conteudo);

    try {
      database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      const dataError = error as DataError;
      expect(dataError.code).toBe('corrupted_structure');
      expect(dataError.rawSnapshot).toBe(conteudo);
      expect(dataError.issues).toHaveLength(2);
      expect(dataError.issues.map((issue) => issue.index).sort()).toEqual([2, 4]);
      expect(dataError.issues[0]?.collection).toBe('transactions');
      expect(dataError.issues[0]?.id).not.toBeNull();
    }
  });

  it('nao apaga nada', () => {
    const conteudo = documentoComTransacaoRuim();
    const { driver, database } = makeDatabase(conteudo);

    expect(() => database.load()).toThrow(DataError);
    expect(driver.read(KEY)).toBe(conteudo);
  });

  it('detecta colecao ausente', () => {
    const base = JSON.parse(validDocument()) as { collections: Record<string, unknown> };
    delete base.collections.cards;

    const { database } = makeDatabase(JSON.stringify(base));

    try {
      database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('corrupted_structure');
      expect((error as DataError).issues.some((issue) => issue.collection === 'cards')).toBe(true);
    }
  });

  it('detecta bloco de colecoes inteiro invalido', () => {
    const { database } = makeDatabase(validDocument({ collections: 'nao e objeto' }));

    try {
      database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('corrupted_structure');
      expect((error as DataError).issues[0]?.collection).toBe('collections');
    }
  });

  it('detecta documento sem versao de schema', () => {
    const base = JSON.parse(validDocument()) as Record<string, unknown>;
    delete base.schemaVersion;

    try {
      makeDatabase(JSON.stringify(base)).database.load();
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('corrupted_structure');
    }
  });
});

describe('recuperacao', () => {
  function documentoParcialmenteRuim(): string {
    const base = JSON.parse(documentWithTransactions()) as {
      collections: { transactions: Record<string, unknown>[] };
    };
    base.collections.transactions[0] = { ...base.collections.transactions[0], amountCents: 0 };
    return JSON.stringify(base);
  }

  it('recupera o que e valido e lista o que foi descartado', () => {
    const { database } = makeDatabase(documentoParcialmenteRuim());
    const { database: recuperado, recovered, discarded } = database.recover();

    expect(recovered).toBe(8);
    expect(discarded).toHaveLength(1);
    expect(discarded[0]?.collection).toBe('transactions');
    expect(discarded[0]?.index).toBe(0);
    expect(recuperado.collections.transactions).toHaveLength(8);
  });

  it('recuperar e uma leitura: nao grava nada', () => {
    const conteudo = documentoParcialmenteRuim();
    const { driver, database } = makeDatabase(conteudo);

    database.recover();
    expect(driver.read(KEY)).toBe(conteudo);
  });

  it('preserva o marcador de seed ao recuperar', () => {
    const base = JSON.parse(documentoParcialmenteRuim()) as { meta: Record<string, unknown> };
    base.meta.seededAt = NOW;

    const { database } = makeDatabase(JSON.stringify(base));
    expect(database.recover().database.meta.seededAt).toBe(NOW);
  });

  it('reset e a unica operacao destrutiva, e so quando chamada', () => {
    const { driver, database } = makeDatabase(documentWithTransactions());

    expect(driver.read(KEY)).not.toBeNull();
    database.reset();
    expect(driver.read(KEY)).toBeNull();
    expect(database.status().state).toBe('empty');
  });
});

describe('exportacao e importacao', () => {
  let database: LocalDatabase;

  beforeEach(() => {
    database = makeDatabase(documentWithTransactions()).database;
  });

  it('exporta JSON legivel e reimporta sem perda', () => {
    const exportado = database.exportJson();
    const destino = makeDatabase().database;

    destino.importJson(exportado);
    expect(destino.load().collections.transactions).toHaveLength(9);
  });

  it('recusa importar conteudo invalido sem tocar no que ja existe', () => {
    expect(() => database.importJson('nao e json')).toThrow(DataError);
    expect(() => database.importJson('{"schemaVersion":1}')).toThrow(DataError);
    expect(() => database.importJson('{"schemaVersion":99}')).toThrow(DataError);

    expect(database.load().collections.transactions).toHaveLength(9);
  });
});

describe('escrita', () => {
  it('nao grava alteracao que deixaria os dados invalidos', () => {
    const { driver, database } = makeDatabase(documentWithTransactions());
    const antes = driver.read(KEY);

    expect(() =>
      database.mutate((draft) => {
        draft.collections.transactions = [
          ...draft.collections.transactions,
          { naoEUmaTransacao: true } as never,
        ];
      }),
    ).toThrow(DataError);

    expect(driver.read(KEY)).toBe(antes);
    expect(database.load().collections.transactions).toHaveLength(9);
  });

  it('atualiza updatedAt a cada escrita', () => {
    let instante = '2026-10-15T12:00:00.000Z';
    const driver = createMemoryStorageDriver({ [KEY]: documentWithTransactions() });
    const database = new LocalDatabase({ key: KEY, driver, clock: () => instante });

    instante = '2026-10-16T08:00:00.000Z';
    database.mutate((draft) => {
      draft.settings = null;
    });

    expect(database.load().meta.updatedAt).toBe(instante);
  });
});
