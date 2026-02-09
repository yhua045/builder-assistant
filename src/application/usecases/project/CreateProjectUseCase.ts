/**
 * Application Use Case: Create Project
 * 
 * Handles the business logic for creating a new project.
 * This is part of the application layer that orchestrates domain entities.
 */

import { ProjectEntity, ProjectStatus, Project } from '../../../domain/entities/Project';
import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';

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
    try {
      // Create project entity with domain validation
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
      const existingProjects = (await this.projectRepository.list()).items;
      const nameExists = existingProjects.some((p: Project) => 
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
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }
}