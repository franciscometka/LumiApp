import { describe, expect, it, vi } from 'vitest';

import { DataError, isDataError } from '../../ports/errors';
import type { Migration, RawDatabase } from './migrations';
import { MIGRATIONS, assertMigrationRegistry, runMigrations } from './migrations';

function migration(from: number, to: number, apply?: (data: RawDatabase) => RawDatabase): Migration {
  return {
    from,
    to,
    description: `v${from} -> v${to}`,
    migrate: apply ?? ((data) => ({ ...data })),
  };
}

describe('registro de migracoes', () => {
  it('a v1 nao tem migracoes — e a versao inicial', () => {
    expect(MIGRATIONS).toHaveLength(0);
    expect(() => assertMigrationRegistry(MIGRATIONS)).not.toThrow();
  });

  it('recusa migracao que nao avanca a versao', () => {
    // Esta e a checagem que torna loop infinito impossivel por construcao.
    expect(() => assertMigrationRegistry([migration(2, 1)])).toThrow(DataError);
    expect(() => assertMigrationRegistry([migration(1, 1)])).toThrow(DataError);
  });

  it('recusa dois caminhos saindo da mesma versao', () => {
    expect(() => assertMigrationRegistry([migration(1, 2), migration(1, 3)])).toThrow(DataError);
  });

  it('recusa versoes nao inteiras', () => {
    expect(() => assertMigrationRegistry([migration(1, 1.5)])).toThrow(DataError);
  });

  it('aceita uma cadeia valida', () => {
    expect(() =>
      assertMigrationRegistry([migration(1, 2), migration(2, 3), migration(3, 4)]),
    ).not.toThrow();
  });
});

describe('runMigrations', () => {
  it('nao faz nada quando a versao ja e a atual', () => {
    const data: RawDatabase = { schemaVersion: 1, valor: 'intacto' };
    const result = runMigrations(data, 1, 1, []);

    expect(result.changed).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.data).toBe(data);
  });

  it('aplica a cadeia completa ate a versao alvo', () => {
    const migrations = [
      migration(1, 2, (data) => ({ ...data, passo1: true })),
      migration(2, 3, (data) => ({ ...data, passo2: true })),
    ];

    const result = runMigrations({ schemaVersion: 1, original: 'preservado' }, 1, 3, migrations);

    expect(result.data).toMatchObject({
      schemaVersion: 3,
      original: 'preservado',
      passo1: true,
      passo2: true,
    });
    expect(result.applied).toEqual(['v1 -> v2', 'v2 -> v3']);
    expect(result.changed).toBe(true);
  });

  it('executa cada migracao exatamente uma vez', () => {
    const spy = vi.fn((data: RawDatabase) => ({ ...data, tocado: true }));
    const migrations = [{ from: 1, to: 2, description: 'unica', migrate: spy }];

    runMigrations({ schemaVersion: 1 }, 1, 2, migrations);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('nao reexecuta ao rodar de novo sobre o resultado ja migrado', () => {
    const spy = vi.fn((data: RawDatabase) => ({
      ...data,
      contador: ((data.contador as number | undefined) ?? 0) + 1,
    }));
    const migrations = [{ from: 1, to: 2, description: 'incrementa', migrate: spy }];

    const primeira = runMigrations({ schemaVersion: 1 }, 1, 2, migrations);
    const segunda = runMigrations(primeira.data, 2, 2, migrations);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(segunda.data.contador).toBe(1);
    expect(segunda.changed).toBe(false);
  });

  it('nao muta o documento de entrada', () => {
    const original: RawDatabase = { schemaVersion: 1, lista: [1, 2, 3] };
    const copia = structuredClone(original);

    runMigrations(original, 1, 2, [migration(1, 2, (data) => ({ ...data, novo: true }))]);

    expect(original).toEqual(copia);
  });

  it('recusa versao futura sem tocar nos dados', () => {
    try {
      runMigrations({ schemaVersion: 99 }, 99, 1, []);
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect(isDataError(error)).toBe(true);
      expect((error as DataError).code).toBe('unsupported_schema_version');
    }
  });

  it('falha de forma controlada quando falta um passo na cadeia', () => {
    try {
      runMigrations({ schemaVersion: 1 }, 1, 3, [migration(2, 3)]);
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('migration_failed');
      expect((error as DataError).message).toContain('preservados');
    }
  });

  it('propaga falha dentro de uma migracao como migration_failed', () => {
    const migrations = [
      {
        from: 1,
        to: 2,
        description: 'quebrada',
        migrate: (): RawDatabase => {
          throw new Error('erro interno');
        },
      },
    ];

    try {
      runMigrations({ schemaVersion: 1 }, 1, 2, migrations);
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('migration_failed');
      expect((error as DataError).message).toContain('quebrada');
    }
  });

  it('recusa migracao que ultrapassa a versao alvo', () => {
    try {
      runMigrations({ schemaVersion: 1 }, 1, 2, [migration(1, 5)]);
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect((error as DataError).code).toBe('migration_failed');
    }
  });

  it('termina mesmo com registro adulterado — o laco tem limite rigido', () => {
    // Uma migracao que mente sobre o destino nao pode travar o app.
    const mentirosa: Migration = {
      from: 1,
      to: 2,
      description: 'nao avanca de verdade',
      migrate: (data) => ({ ...data, schemaVersion: 1 }),
    };

    // O runner reescreve schemaVersion a partir de `to`, entao a cadeia avanca
    // de qualquer forma; o que importa e que a chamada RETORNA.
    const result = runMigrations({ schemaVersion: 1 }, 1, 2, [mentirosa]);
    expect(result.data.schemaVersion).toBe(2);
  });
});
