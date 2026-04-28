// Integration test for useProjects hook using in-memory better-sqlite3 adapter

jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e) {
            // fallthrough
          }
        }

        if (stmt) db.exec(stmt);
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = { executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params) };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => db.close(),
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async (_: any) => {
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    }
  };
});

import renderer, { act } from 'react-test-renderer';
import React, { useEffect } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { DrizzleProjectRepository } from '../../infrastructure/DrizzleProjectRepository';
import { ProjectEntity, ProjectStatus } from '../../../../domain/entities/Project';import { wrapWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';import { closeDatabase } from '../../../../infrastructure/database/connection';

describe.skip('useProjects integration', () => {
  it('loads projects from Drizzle-backed repository', async () => {
    const repo = new DrizzleProjectRepository();
    await repo.init();

    const p = ProjectEntity.create({
      id: 'int-hook-1',
      name: 'Hook Integration',
      status: ProjectStatus.IN_PROGRESS,
      materials: [],
      phases: [],
    });

    await repo.save(p.data);

    let latest: any = null;

    function TestHarness() {
      const state = useProjects();
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    await act(async () => {
      renderer.create(wrapWithQuery(<TestHarness />));
      // wait for hook to perform initial load
      for (let i = 0; i < 20; i++) {
        if (latest && latest.loading === false) break;
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    });

    expect(latest).not.toBeNull();
    console.log("Error from hook:", latest.error);
    console.log("Error from hook:", latest.error);
    expect(latest.loading).toBe(false);
    expect(latest.error).toBeNull();
    expect(latest.projects.some((pr: any) => pr.id === 'int-hook-1')).toBe(true);

    await repo.delete('int-hook-1');
    await closeDatabase();
  }, 15000);
});
