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
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const results = await this.drizzle.select().from(schema.projects);
    return results.map(this.mapToProject);
  }

  async findById(id: string): Promise<Project | null> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const results = await this.drizzle
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);
    
    if (results.length === 0) return null;
    return this.mapToProject(results[0]);
  }

  async save(project: Project): Promise<void> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const existing = await this.findById(project.id);
    
    if (existing) {
      await this.drizzle
        .update(schema.projects)
        .set({
          propertyId: project.propertyId,
          ownerId: project.ownerId,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate ? new Date(project.startDate).getTime() : null,
          expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate).getTime() : null,
          budget: project.budget,
          currency: project.currency,
          meta: project.meta ? JSON.stringify(project.meta) : null,
          updatedAt: Date.now(),
        })
        .where(eq(schema.projects.id, project.id));
    } else {
      await this.drizzle.insert(schema.projects).values({
        id: project.id,
        propertyId: project.propertyId,
        ownerId: project.ownerId,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate).getTime() : null,
        expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate).getTime() : null,
        budget: project.budget,
        currency: project.currency,
        meta: project.meta ? JSON.stringify(project.meta) : null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    await this.drizzle
      .delete(schema.projects)
      .where(eq(schema.projects.id, id));
  }

  async findByStatus(status: string): Promise<Project[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const results = await this.drizzle
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.status, status as any));
    
    return results.map(this.mapToProject);
  }

  async findByPropertyId(propertyId: string): Promise<Project[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const results = await this.drizzle
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.propertyId, propertyId));
    
    return results.map(this.mapToProject);
  }

  async findByOwnerId(ownerId: string): Promise<Project[]> {
    if (!this.drizzle) throw new Error('Database not initialized');
    
    const results = await this.drizzle
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.ownerId, ownerId));
    
    return results.map(this.mapToProject);
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
    await this.save(project);
  }

  async exists(id: string): Promise<boolean> {
    const project = await this.findById(id);
    return project !== null;
  }

  private mapToProject(row: any): Project {
    return {
      id: row.id,
      propertyId: row.propertyId,
      ownerId: row.ownerId,
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.startDate ? new Date(row.startDate) : undefined,
      expectedEndDate: row.expectedEndDate ? new Date(row.expectedEndDate) : undefined,
      budget: row.budget,
      currency: row.currency,
      phases: [],
      materials: [],
      meta: row.meta ? JSON.parse(row.meta) : undefined,
    };
  }
}
