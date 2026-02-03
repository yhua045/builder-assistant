/**
 * Infrastructure: SQLite Project Repository
 * 
 * Implementation of ProjectRepository using SQLite via react-native-sqlite-storage.
 * Uses INTEGER PRIMARY KEY (local_id) internally and maps to/from domain UUID (id).
 */

import SQLite from 'react-native-sqlite-storage';
import { Project, Material, ProjectPhase } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';

SQLite.enablePromise(true);

const DATABASE_NAME = 'builder_assistant.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAY_NAME = 'Builder Assistant Database';
const DATABASE_SIZE = 200000;

export class LocalSqliteProjectRepository implements ProjectRepository {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    
    this.db = await SQLite.openDatabase({
      name: DATABASE_NAME,
      location: 'default',
    });

    // Initialize schema
    await this.createTables();
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schemaSQL = `
      CREATE TABLE IF NOT EXISTS projects (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        property_id TEXT,
        owner_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        start_date INTEGER,
        expected_end_date INTEGER,
        budget REAL,
        currency TEXT,
        meta TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS project_phases (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        start_date INTEGER,
        end_date INTEGER,
        dependencies TEXT,
        is_completed INTEGER DEFAULT 0,
        materials_required TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS materials (
        local_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        unit_cost REAL NOT NULL,
        supplier TEXT,
        estimated_delivery_date INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_projects_property ON projects(property_id);
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
      CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);
    `;

    const statements = schemaSQL.split(';').filter(s => s.trim());
    for (const statement of statements) {
      await this.db.executeSql(statement);
    }
  }

  async save(project: Project): Promise<void> {
    if (!this.db) await this.init();

    const existing = await this.findById(project.id);
    if (existing) {
      await this.update(project);
      return;
    }

    await this.db!.transaction(async (tx) => {
      // Insert project
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

      // Insert phases
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

      // Insert materials
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

  async findById(id: string): Promise<Project | null> {
    if (!this.db) await this.init();

    const [result] = await this.db!.executeSql(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );

    if (result.rows.length === 0) return null;

    const projectRow = result.rows.item(0);
    return await this.mapRowToProject(projectRow);
  }

  async findAll(): Promise<Project[]> {
    if (!this.db) await this.init();

    const [result] = await this.db!.executeSql('SELECT * FROM projects');
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async findByStatus(status: string): Promise<Project[]> {
    if (!this.db) await this.init();

    const [result] = await this.db!.executeSql(
      'SELECT * FROM projects WHERE status = ?',
      [status]
    );
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async findByPropertyId(propertyId: string): Promise<Project[]> {
    if (!this.db) await this.init();

    const [result] = await this.db!.executeSql(
      'SELECT * FROM projects WHERE property_id = ?',
      [propertyId]
    );
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async findByOwnerId(ownerId: string): Promise<Project[]> {
    if (!this.db) await this.init();

    const [result] = await this.db!.executeSql(
      'SELECT * FROM projects WHERE owner_id = ?',
      [ownerId]
    );
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async findByPhaseDateRange(startDate?: string, endDate?: string): Promise<Project[]> {
    if (!this.db) await this.init();

    const start = startDate ? new Date(startDate).getTime() : null;
    const end = endDate ? new Date(endDate).getTime() : null;

    let query = `
      SELECT DISTINCT p.* FROM projects p
      JOIN project_phases ph ON ph.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start) {
      query += ' AND ph.start_date >= ?';
      params.push(start);
    }
    if (end) {
      query += ' AND ph.end_date <= ?';
      params.push(end);
    }

    const [result] = await this.db!.executeSql(query, params);
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async findWithUpcomingPhases(untilDate: string): Promise<Project[]> {
    if (!this.db) await this.init();

    const until = new Date(untilDate).getTime();

    const [result] = await this.db!.executeSql(
      `SELECT DISTINCT p.* FROM projects p
       JOIN project_phases ph ON ph.project_id = p.id
       WHERE ph.start_date <= ?`,
      [until]
    );
    
    const projects: Project[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      projects.push(await this.mapRowToProject(row));
    }
    
    return projects;
  }

  async update(project: Project): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.transaction(async (tx) => {
      // Update project
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
          project.updatedAt ? project.updatedAt.getTime() : new Date().getTime(),
          project.id,
        ]
      );

      // Delete and re-insert phases and materials
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

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init();

    await this.db!.executeSql('DELETE FROM projects WHERE id = ?', [id]);
  }

  async exists(id: string): Promise<boolean> {
    const project = await this.findById(id);
    return project !== null;
  }

  private async mapRowToProject(row: any): Promise<Project> {
    if (!this.db) throw new Error('Database not initialized');

    // Load phases
    const [phasesResult] = await this.db.executeSql(
      'SELECT * FROM project_phases WHERE project_id = ?',
      [row.id]
    );
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
    const [materialsResult] = await this.db.executeSql(
      'SELECT * FROM materials WHERE project_id = ?',
      [row.id]
    );
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
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
