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