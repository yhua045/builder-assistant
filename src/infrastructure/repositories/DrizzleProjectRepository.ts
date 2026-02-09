import { drizzle } from 'drizzle-orm/sqlite-proxy';
import SQLite from 'react-native-sqlite-storage';
import { eq } from 'drizzle-orm';
import { Project, Material, ProjectPhase } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { initDatabase, getDatabase } from '../database/connection';
import * as schema from '../database/schema';

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
      const [result] = await db.executeSql('SELECT * FROM projects WHERE meta LIKE ?', [`%\"externalId\":\"${externalId}\"%`]);
      if (result.rows.length === 0) return null;
      return await this.mapRowToProject(result.rows.item(0));
    }
  }

  async list(filters: any = {}, options: { limit?: number; offset?: number } = {}): Promise<{ items: Project[]; total: number }> {
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

    return { items, total };
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
  async withTransaction(fn: (txRepo: { save: (p: Project) => Promise<void> }) => Promise<void>): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    await db.transaction(async (tx: any) => {
      // txRepo.save will insert minimal project record using the provided tx
      const txRepo = {
        save: async (project: Project) => {
          await tx.executeSql(
            `INSERT INTO projects (id, property_id, owner_id, name, description, status, start_date, expected_end_date, budget, currency, meta, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
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
        }
      };

      await fn(txRepo);
    });
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

  async findByPhaseDateRange(startDate?: string, endDate?: string): Promise<Project[]> {
    // TODO: Implement with JOIN on project_phases table
    if (!this.drizzle) throw new Error('Database not initialized');
    return [];
  }

  async findWithUpcomingPhases(untilDate: string): Promise<Project[]> {
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
