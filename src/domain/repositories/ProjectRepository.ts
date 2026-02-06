/**
 * Domain Repository Interface: ProjectRepository
 * 
 * Defines the contract for project data persistence.
 * This interface is part of the domain layer and should be implemented
 * by the infrastructure layer.
 */

import { Project } from '../entities/Project';

export type ProjectFilters = {
  status?: string | string[];
  ownerId?: string;
  propertyId?: string;
  tag?: string;
  archived?: boolean;
  startDateGte?: string;
  startDateLte?: string;
  search?: string; // name substring
};

export interface ProjectRepository {
  // Save (upsert) a project to the data store
  save(project: Project): Promise<void>;

  // Find a project by ID
  findById(id: string): Promise<Project | null>;

  // Find by external id provided by upstream systems
  findByExternalId(externalId: string): Promise<Project | null>;

  // List projects with filters, pagination and sorting
  list(filters?: ProjectFilters, options?: { limit?: number; offset?: number; cursor?: string; sort?: string }): Promise<{ items: Project[]; meta: { total: number; nextCursor?: string } }>;

  // Count projects matching filters
  count(filters?: ProjectFilters): Promise<number>;

  // Find projects by status (convenience)
  findByStatus(status: string): Promise<Project[]>;

  // Find projects for a given property id
  findByPropertyId(propertyId: string): Promise<Project[]>;

  // Find projects for a given owner/contact id
  findByOwnerId(ownerId: string): Promise<Project[]>;

  // Find projects that have any phases starting or ending within the given date range (ISO strings)
  findByPhaseDateRange(startDate?: string, endDate?: string): Promise<Project[]>;

  // Find projects that contain phases with upcoming start dates on or before the provided ISO date
  findWithUpcomingPhases(untilDate: string): Promise<Project[]>;

  // Hard delete (use with caution)
  delete(id: string): Promise<void>;


  // Provide a transaction-scoped execution wrapper if supported by the adapter
  withTransaction<T>(work: (repo: ProjectRepository) => Promise<T>): Promise<T>;
}