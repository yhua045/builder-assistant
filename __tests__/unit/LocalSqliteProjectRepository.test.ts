import { LocalSqliteProjectRepository } from '../../src/infrastructure/repositories/LocalSqliteProjectRepository';
import { ProjectEntity, ProjectStatus } from '../../src/domain/entities/Project';

// Provide a lightweight in-memory mock for react-native-sqlite-storage
jest.mock('react-native-sqlite-storage', () => {
  class MockDB {
    private projects: any[] = [];
    private phases: any[] = [];
    private materials: any[] = [];
    private projCounter = 0;
    private phaseCounter = 0;
    private matCounter = 0;

    async executeSql(sql: string, params: any[] = []) {
      const stmt = sql.trim().toUpperCase();

      // CREATE statements - no-op
      if (stmt.startsWith('CREATE')) {
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      }

      // INSERT INTO projects
      if (stmt.startsWith('INSERT INTO PROJECTS')) {
        this.projCounter += 1;
        const [id, property_id, owner_id, name, description, status,
          start_date, expected_end_date, budget, currency, meta, created_at, updated_at] = params;
        this.projects.push({
          local_id: this.projCounter,
          id,
          property_id,
          owner_id,
          name,
          description,
          status,
          start_date,
          expected_end_date,
          budget,
          currency,
          meta,
          created_at,
          updated_at
        });
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      }

      // INSERT INTO project_phases
      if (stmt.startsWith('INSERT INTO PROJECT_PHASES')) {
        this.phaseCounter += 1;
        const [id, project_id, name, description, start_date, end_date, dependencies, is_completed, materials_required] = params;
        this.phases.push({
          local_id: this.phaseCounter,
          id,
          project_id,
          name,
          description,
          start_date,
          end_date,
          dependencies,
          is_completed,
          materials_required
        });
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      }

      // INSERT INTO materials
      if (stmt.startsWith('INSERT INTO MATERIALS')) {
        this.matCounter += 1;
        const [id, project_id, name, quantity, unit, unit_cost, supplier, estimated_delivery_date] = params;
        this.materials.push({
          local_id: this.matCounter,
          id,
          project_id,
          name,
          quantity,
          unit,
          unit_cost,
          supplier,
          estimated_delivery_date
        });
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      }

      // SELECT * FROM projects WHERE id = ?
      if (stmt.startsWith('SELECT * FROM PROJECTS WHERE ID =')) {
        const id = params[0];
        const found = this.projects.filter(p => p.id === id);
        const rows = {
          length: found.length,
          item: (i: number) => found[i]
        };
        return [ { rows } ];
      }

      // SELECT * FROM PROJECTS
      if (stmt === 'SELECT * FROM PROJECTS') {
        const rows = {
          length: this.projects.length,
          item: (i: number) => this.projects[i]
        };
        return [ { rows } ];
      }

      // SELECT * FROM project_phases WHERE project_id = ?
      if (stmt.startsWith('SELECT * FROM PROJECT_PHASES WHERE PROJECT_ID =')) {
        const pid = params[0];
        const found = this.phases.filter(p => p.project_id === pid);
        const rows = { length: found.length, item: (i: number) => found[i] };
        return [ { rows } ];
      }

      // SELECT * FROM materials WHERE project_id = ?
      if (stmt.startsWith('SELECT * FROM MATERIALS WHERE PROJECT_ID =')) {
        const pid = params[0];
        const found = this.materials.filter(m => m.project_id === pid);
        const rows = { length: found.length, item: (i: number) => found[i] };
        return [ { rows } ];
      }

      // Fallback: empty result
      return [ { rows: { length: 0, item: (_: number) => undefined } } ];
    }

    async transaction(fn: any) {
      const tx = { executeSql: (sql: string, params?: any[]) => this.executeSql(sql, params) };
      await fn(tx);
    }

    async close() { /* noop */ }
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async (_: any) => new MockDB()
  };
});

describe('LocalSqliteProjectRepository (in-memory)', () => {
  it('saves and retrieves a project with phases and materials', async () => {
    const repo = new LocalSqliteProjectRepository();

    const projectEntity = ProjectEntity.create({
      id: 'test-project-1',
      name: 'Test Project',
      status: ProjectStatus.PLANNING,
      materials: [
        { id: 'mat-1', name: 'Bricks', quantity: 100, unit: 'pcs', unitCost: 0.5 }
      ],
      phases: [
        { id: 'phase-1', name: 'Foundation' }
      ]
    });

    await repo.save(projectEntity.data);

    const loaded = await repo.findById('test-project-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Test Project');
    expect(loaded!.materials.length).toBe(1);
    expect(loaded!.materials[0].id).toBe('mat-1');
    expect(loaded!.phases.length).toBe(1);
    expect(loaded!.phases[0].id).toBe('phase-1');

    const all = await repo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);

    await repo.close();
  });
});
