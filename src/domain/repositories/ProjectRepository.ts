/**
 * Domain Repository Interface: ProjectRepository
 * 
 * Defines the contract for project data persistence.
 * This interface is part of the domain layer and should be implemented
 * by the infrastructure layer.
 */

import { Project } from '../entities/Project';

export interface ProjectRepository {
  /**
   * Save a project to the data store
   */
  save(project: Project): Promise<void>;

  /**
   * Find a project by ID
   */
  findById(id: string): Promise<Project | null>;

  /**
   * Find all projects
   */
  findAll(): Promise<Project[]>;

  /**
   * Find projects by status
   */
  findByStatus(status: string): Promise<Project[]>;

  /**
   * Find projects for a given property id
   */
  findByPropertyId(propertyId: string): Promise<Project[]>;

  /**
   * Find projects for a given owner/contact id
   */
  findByOwnerId(ownerId: string): Promise<Project[]>;

  /**
   * Find projects that have any phases starting or ending within the given date range (ISO strings)
   */
  findByPhaseDateRange(startDate?: string, endDate?: string): Promise<Project[]>;

  /**
   * Find projects that contain phases with upcoming start dates on or before the provided ISO date
   * Useful for building upcoming schedule queries.
   */
  findWithUpcomingPhases(untilDate: string): Promise<Project[]>;

  /**
   * Update an existing project
   */
  update(project: Project): Promise<void>;

  /**
   * Delete a project by ID
   */
  delete(id: string): Promise<void>;

  /**
   * Check if a project exists by ID
   */
  exists(id: string): Promise<boolean>;
}