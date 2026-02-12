import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { Project, Material, ProjectPhase } from '../../domain/entities/Project';
import { ProjectDetails } from '../../domain/entities/ProjectDetails';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { initDatabase, getDatabase } from '../database/connection';
import { mapContactFromRow, mapPropertyFromRow } from '../mappers/ProjectMapper';

/**
 * Drizzle-based SQLite Project Repository
 * 
 * Implementation of ProjectRepository using Drizzle ORM.
 * Handles migrations automatically on initialization.
 */
export class DrizzleProjectRepository implements ProjectRepository {
  private drizzle: ReturnType<typeof drizzle> | null = null;

  async init(): Promise<void> {
    if (this.drizzle) return;
    
    // Initialize database with automatic migrations
    const { drizzle: db } = await initDatabase();
    this.drizzle = db;
  }

  async findAll(): Promise<Project[]> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql('SELECT * FROM projects');
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    return projects;
  }

  async findById(id: string): Promise<Project | null> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql('SELECT * FROM projects WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows.item(0);
    return await this.mapRowToProject(row);
  }

  async findDetailsById(id: string): Promise<ProjectDetails | null> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql(
      `SELECT p.*,
        c.local_id AS owner_local_id,
        c.id AS owner_id,
        c.name AS owner_name,
        c.roles AS owner_roles,
        c.trade AS owner_trade,
        c.phone AS owner_phone,
        c.email AS owner_email,
        c.address AS owner_address,
        c.rate AS owner_rate,
        c.notes AS owner_notes,
        c.created_at AS owner_created_at,
        c.updated_at AS owner_updated_at,
        pr.local_id AS property_local_id,
        pr.id AS property_id,
        pr.street AS property_street,
        pr.city AS property_city,
        pr.state AS property_state,
        pr.postal_code AS property_postal_code,
        pr.country AS property_country,
        pr.address AS property_address,
        pr.property_type AS property_property_type,
        pr.lot_size AS property_lot_size,
        pr.lot_size_unit AS property_lot_size_unit,
        pr.year_built AS property_year_built,
        pr.owner_id AS property_owner_id,
        pr.meta AS property_meta,
        pr.created_at AS property_created_at,
        pr.updated_at AS property_updated_at
      FROM projects p
      LEFT JOIN contacts c ON c.id = p.owner_id
      LEFT JOIN properties pr ON pr.id = p.property_id
      WHERE p.id = ?`,
      [id]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows.item(0);
    const project = await this.mapRowToProject(row);
    return this.buildProjectDetails(project, row);
  }

  async save(project: Project): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const existing = await this.findById(project.id);
    if (existing) {
      await this.update(project);
      return;
    }

    await db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO projects (
          id, property_id, owner_id, name, description, status,
          start_date, expected_end_date, budget, currency, meta,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          project.propertyId || null,
          project.ownerId || null,
          project.name,
          project.description || null,
          project.status,
          project.startDate ? project.startDate.getTime() : null,
          project.expectedEndDate ? project.expectedEndDate.getTime() : null,
          project.budget || null,
          project.currency || null,
          project.meta ? JSON.stringify(project.meta) : null,
          project.createdAt ? project.createdAt.getTime() : null,
          project.updatedAt ? project.updatedAt.getTime() : null,
        ]
      );

      for (const phase of project.phases || []) {
        await tx.executeSql(
          `INSERT INTO project_phases (
            id, project_id, name, description, start_date, end_date,
            dependencies, is_completed, materials_required
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            phase.id,
            project.id,
            phase.name,
            phase.description || null,
            phase.startDate ? phase.startDate.getTime() : null,
            phase.endDate ? phase.endDate.getTime() : null,
            phase.dependencies ? JSON.stringify(phase.dependencies) : null,
            phase.isCompleted ? 1 : 0,
            phase.materialsRequired ? JSON.stringify(phase.materialsRequired) : null,
          ]
        );
      }

      for (const material of project.materials || []) {
        await tx.executeSql(
          `INSERT INTO materials (
            id, project_id, name, quantity, unit, unit_cost,
            supplier, estimated_delivery_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            material.id,
            project.id,
            material.name,
            material.quantity,
            material.unit,
            material.unitCost,
            material.supplier || null,
            material.estimatedDeliveryDate ? material.estimatedDeliveryDate.getTime() : null,
          ]
        );
      }
    });
  }

  /**
   * Convenience create method (preserved for contract compatibility)
   */
  async create(project: Project): Promise<Project> {
    await this.save(project);
    return project;
  }

  /**
   * Create returns the created project after persisting.
   */
  // `create` removed: use `save` (upsert) for create/update semantics

  async findByExternalId(externalId: string): Promise<Project | null> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    // Prefer json_extract if available, fallback to LIKE search
    try {
      const [result] = await db.executeSql("SELECT * FROM projects WHERE json_extract(meta, '$.externalId') = ?", [externalId]);
      if (result.rows.length === 0) return null;
      return await this.mapRowToProject(result.rows.item(0));
    } catch (e) {
      const [result] = await db.executeSql('SELECT * FROM projects WHERE meta LIKE ?', [`%"externalId":"${externalId}"%`]);
      if (result.rows.length === 0) return null;
      return await this.mapRowToProject(result.rows.item(0));
    }
  }

  async list(filters: any = {}, options: { limit?: number; offset?: number; cursor?: string; sort?: string } = {}): Promise<{ items: Project[]; meta: { total: number; nextCursor?: string } }> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    // Simple filtering: support status filter for tests
    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitSql = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetSql = options.offset ? `OFFSET ${options.offset}` : '';

    const [rows] = await db.executeSql(`SELECT * FROM projects ${whereSql} ${limitSql} ${offsetSql}`);
    const items: Project[] = [];
    for (let i = 0; i < rows.rows.length; i++) {
      items.push(await this.mapRowToProject(rows.rows.item(i)));
    }

    const [countRows] = await db.executeSql(`SELECT COUNT(*) as cnt FROM projects ${whereSql}`, params);
    const total = countRows.rows.length ? countRows.rows.item(0).cnt : 0;

    return { items, meta: { total } };
  }

  async listDetails(filters: any = {}, options: { limit?: number; offset?: number; cursor?: string; sort?: string } = {}): Promise<{ items: ProjectDetails[]; meta: { total: number; nextCursor?: string } }> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('p.status = ?');
      params.push(filters.status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limitSql = options.limit ? `LIMIT ${options.limit}` : '';
    const offsetSql = options.offset ? `OFFSET ${options.offset}` : '';

    const [rows] = await db.executeSql(
      `SELECT p.*,
        c.local_id AS owner_local_id,
        c.id AS owner_id,
        c.name AS owner_name,
        c.roles AS owner_roles,
        c.trade AS owner_trade,
        c.phone AS owner_phone,
        c.email AS owner_email,
        c.address AS owner_address,
        c.rate AS owner_rate,
        c.notes AS owner_notes,
        c.created_at AS owner_created_at,
        c.updated_at AS owner_updated_at,
        pr.local_id AS property_local_id,
        pr.id AS property_id,
        pr.street AS property_street,
        pr.city AS property_city,
        pr.state AS property_state,
        pr.postal_code AS property_postal_code,
        pr.country AS property_country,
        pr.address AS property_address,
        pr.property_type AS property_property_type,
        pr.lot_size AS property_lot_size,
        pr.lot_size_unit AS property_lot_size_unit,
        pr.year_built AS property_year_built,
        pr.owner_id AS property_owner_id,
        pr.meta AS property_meta,
        pr.created_at AS property_created_at,
        pr.updated_at AS property_updated_at
      FROM projects p
      LEFT JOIN contacts c ON c.id = p.owner_id
      LEFT JOIN properties pr ON pr.id = p.property_id
      ${whereSql} ${limitSql} ${offsetSql}`,
      params
    );

    const items: ProjectDetails[] = [];
    for (let i = 0; i < rows.rows.length; i++) {
      const row = rows.rows.item(i);
      const project = await this.mapRowToProject(row);
      items.push(this.buildProjectDetails(project, row));
    }

    const [countRows] = await db.executeSql(`SELECT COUNT(*) as cnt FROM projects p ${whereSql}`, params);
    const total = countRows.rows.length ? countRows.rows.item(0).cnt : 0;

    return { items, meta: { total } };
  }

  async count(filters: any = {}): Promise<number> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const where: string[] = [];
    const params: any[] = [];
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [countRows] = await db.executeSql(`SELECT COUNT(*) as cnt FROM projects ${whereSql}`, params);
    return countRows.rows.length ? countRows.rows.item(0).cnt : 0;
  }

  /**
   * Provide a transactional context that accepts a repo-like object with a `save` method.
   * The provided function should throw to force rollback.
   */
  async withTransaction<T>(fn: (repo: ProjectRepository) => Promise<T>): Promise<T> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    return (db.transaction(async (tx: any) => {
      // Create a minimal fake repository that implements save() within the transaction
      // Cast to ProjectRepository to satisfy interface
      const txRepo = {
        save: async (project: Project) => {
          await tx.executeSql(
            `INSERT INTO projects (id, property_id, owner_id, name, description, status, start_date, expected_end_date, budget, currency, meta, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
             property_id=excluded.property_id,
             owner_id=excluded.owner_id,
             name=excluded.name,
             description=excluded.description,
             status=excluded.status,
             start_date=excluded.start_date,
             expected_end_date=excluded.expected_end_date,
             budget=excluded.budget,
             currency=excluded.currency,
             meta=excluded.meta,
             updated_at=excluded.updated_at`,
            [
              project.id,
              project.propertyId || null,
              project.ownerId || null,
              project.name,
              project.description || null,
              project.status,
              project.startDate ? project.startDate.getTime() : null,
              project.expectedEndDate ? project.expectedEndDate.getTime() : null,
              project.budget,
              project.currency,
              project.meta ? JSON.stringify(project.meta) : null,
              project.createdAt?.getTime() || Date.now(),
              project.updatedAt?.getTime() || Date.now()
            ]
          );
        },
        // Other methods aren't implemented in this transaction context yet
        
        findById: async (_id: string) => null,
        findDetailsById: async (_id: string) => null,
        
        findByExternalId: async (_id: string) => null,
        list: async () => ({ items: [], meta: { total: 0 } }),
        listDetails: async () => ({ items: [], meta: { total: 0 } }),
        count: async () => 0,
        
        findByStatus: async (_s: string) => [],
      } as unknown as ProjectRepository;

      return await fn(txRepo);
    }) as unknown) as Promise<T>;
  }

  async delete(id: string): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM projects WHERE id = ?', [id]);
  }

  async findByStatus(status: string): Promise<Project[]> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql('SELECT * FROM projects WHERE status = ?', [status]);
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      projects.push(await this.mapRowToProject(result.rows.item(i)));
    }
    return projects;
  }

  async findByPropertyId(propertyId: string): Promise<Project[]> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql('SELECT * FROM projects WHERE property_id = ?', [propertyId]);
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      projects.push(await this.mapRowToProject(result.rows.item(i)));
    }
    return projects;
  }

  async findByOwnerId(ownerId: string): Promise<Project[]> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const [result] = await db.executeSql('SELECT * FROM projects WHERE owner_id = ?', [ownerId]);
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      projects.push(await this.mapRowToProject(result.rows.item(i)));
    }
    return projects;
  }

  async findByPhaseDateRange(_startDate?: string, _endDate?: string): Promise<Project[]> {
    // TODO: Implement with JOIN on project_phases table
    if (!this.drizzle) throw new Error('Database not initialized');
    return [];
  }

  async findWithUpcomingPhases(_untilDate: string): Promise<Project[]> {
    // TODO: Implement with JOIN on project_phases table
    if (!this.drizzle) throw new Error('Database not initialized');
    return [];
  }

  async update(project: Project): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    await db.transaction(async (tx) => {
      await tx.executeSql(
        `UPDATE projects SET
          property_id = ?, owner_id = ?, name = ?, description = ?, status = ?,
          start_date = ?, expected_end_date = ?, budget = ?, currency = ?,
          meta = ?, updated_at = ?
         WHERE id = ?`,
        [
          project.propertyId || null,
          project.ownerId || null,
          project.name,
          project.description || null,
          project.status,
          project.startDate ? project.startDate.getTime() : null,
          project.expectedEndDate ? project.expectedEndDate.getTime() : null,
          project.budget || null,
          project.currency || null,
          project.meta ? JSON.stringify(project.meta) : null,
          project.updatedAt ? project.updatedAt.getTime() : Date.now(),
          project.id,
        ]
      );

      await tx.executeSql('DELETE FROM project_phases WHERE project_id = ?', [project.id]);
      await tx.executeSql('DELETE FROM materials WHERE project_id = ?', [project.id]);

      for (const phase of project.phases || []) {
        await tx.executeSql(
          `INSERT INTO project_phases (
            id, project_id, name, description, start_date, end_date,
            dependencies, is_completed, materials_required
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            phase.id,
            project.id,
            phase.name,
            phase.description || null,
            phase.startDate ? phase.startDate.getTime() : null,
            phase.endDate ? phase.endDate.getTime() : null,
            phase.dependencies ? JSON.stringify(phase.dependencies) : null,
            phase.isCompleted ? 1 : 0,
            phase.materialsRequired ? JSON.stringify(phase.materialsRequired) : null,
          ]
        );
      }

      for (const material of project.materials || []) {
        await tx.executeSql(
          `INSERT INTO materials (
            id, project_id, name, quantity, unit, unit_cost,
            supplier, estimated_delivery_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            material.id,
            project.id,
            material.name,
            material.quantity,
            material.unit,
            material.unitCost,
            material.supplier || null,
            material.estimatedDeliveryDate ? material.estimatedDeliveryDate.getTime() : null,
          ]
        );
      }
    });
  }

  async exists(id: string): Promise<boolean> {
    const project = await this.findById(id);
    return project !== null;
  }

  private buildProjectDetails(project: Project, row: any): ProjectDetails {
    const owner = mapContactFromRow(row, 'owner_');
    const property = mapPropertyFromRow(row, 'property_');

    return {
      ...project,
      owner: owner ?? { id: project.ownerId ?? 'unknown', name: 'Unknown' },
      property: property ?? undefined,
    };
  }
  private async mapRowToProject(row: any): Promise<Project> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    // Load phases
    const [phasesResult] = await db.executeSql('SELECT * FROM project_phases WHERE project_id = ?', [row.id]);
    const phases: ProjectPhase[] = [];
    for (let i = 0; i < phasesResult.rows.length; i++) {
      const phaseRow = phasesResult.rows.item(i);
      phases.push({
        id: phaseRow.id,
        localId: phaseRow.local_id,
        projectId: phaseRow.project_id,
        name: phaseRow.name,
        description: phaseRow.description || undefined,
        startDate: phaseRow.start_date ? new Date(phaseRow.start_date) : undefined,
        endDate: phaseRow.end_date ? new Date(phaseRow.end_date) : undefined,
        dependencies: phaseRow.dependencies ? JSON.parse(phaseRow.dependencies) : undefined,
        isCompleted: phaseRow.is_completed === 1,
        materialsRequired: phaseRow.materials_required ? JSON.parse(phaseRow.materials_required) : undefined,
      });
    }

    // Load materials
    const [materialsResult] = await db.executeSql('SELECT * FROM materials WHERE project_id = ?', [row.id]);
    const materials: Material[] = [];
    for (let i = 0; i < materialsResult.rows.length; i++) {
      const matRow = materialsResult.rows.item(i);
      materials.push({
        id: matRow.id,
        localId: matRow.local_id,
        projectId: matRow.project_id,
        name: matRow.name,
        quantity: matRow.quantity,
        unit: matRow.unit,
        unitCost: matRow.unit_cost,
        supplier: matRow.supplier || undefined,
        estimatedDeliveryDate: matRow.estimated_delivery_date ? new Date(matRow.estimated_delivery_date) : undefined,
      });
    }

    return {
      id: row.id,
      localId: row.local_id,
      propertyId: row.property_id || undefined,
      ownerId: row.owner_id || undefined,
      name: row.name,
      description: row.description || undefined,
      status: row.status,
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      expectedEndDate: row.expected_end_date ? new Date(row.expected_end_date) : undefined,
      budget: row.budget || undefined,
      currency: row.currency || undefined,
      materials,
      phases,
      meta: row.meta ? JSON.parse(row.meta) : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }

  async close(): Promise<void> {
    const { db } = getDatabase();
    if (db) await db.close();
  }
}
