/**
 * Application Use Case: Create Project
 * 
 * Handles the business logic for creating a new project.
 * This is part of the application layer that orchestrates domain entities.
 */

import { ProjectEntity, ProjectStatus } from '../../../domain/entities/Project';
import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';
import { ValidationError } from '../../../domain/errors/ValidationError';

export interface CreateProjectRequest {
  name: string;
  description: string;
  budget: number;
  startDate: Date;
  expectedEndDate: Date;
}

export interface CreateProjectResponse {
  success: boolean;
  projectId?: string;
  errors?: string[];
  warnings?: string[];
}

export class CreateProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(request: CreateProjectRequest): Promise<CreateProjectResponse> {
    // Validate request fields explicitly to provide clear errors
    const errors: string[] = [];
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Project name is required');
    }
    if (request.budget !== undefined && request.budget < 0) {
      errors.push('Project budget cannot be negative');
    }
    if (request.startDate && request.expectedEndDate) {
      if (!(request.startDate instanceof Date) || isNaN(request.startDate.getTime()) ||
          !(request.expectedEndDate instanceof Date) || isNaN(request.expectedEndDate.getTime())) {
        errors.push('Invalid date for startDate or expectedEndDate');
      } else if (request.startDate.getTime() >= request.expectedEndDate.getTime()) {
        errors.push('Expected end date must be after start date');
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    try {
      // Create project entity (additional domain-level validation may run here)
      const projectEntity = ProjectEntity.create({
        name: request.name,
        description: request.description,
        status: ProjectStatus.PLANNING,
        startDate: request.startDate,
        expectedEndDate: request.expectedEndDate,
        budget: request.budget,
        materials: [],
        phases: []
      });

      const project = projectEntity.data;

      // Check if project with same name already exists
      const existingProjects = await this.projectRepository.findAll();
      const nameExists = existingProjects.some(p => 
        p.name.toLowerCase() === project.name.toLowerCase()
      );

      if (nameExists) {
        return {
          success: false,
          errors: ['A project with this name already exists']
        };
      }

      // Save the project
      await this.projectRepository.save(project);

      // Generate warnings for potential issues
      const warnings: string[] = [];
      if (project.expectedEndDate && project.startDate) {
        const timelineDuration = project.expectedEndDate.getTime() - project.startDate.getTime();
        const daysDuration = timelineDuration / (1000 * 60 * 60 * 24);

        if (daysDuration < 30) {
          warnings.push('Project timeline is very short - ensure adequate planning time');
        }
      }

      if (project.budget !== undefined && project.budget < 10000) {
        warnings.push('Project budget seems low - double-check cost estimates');
      }

      return {
        success: true,
        projectId: project.id,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { success: false, errors: [error.message, ...(error.details || [])] };
      }
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }
}