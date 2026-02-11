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
  description?: string;
  address?: string; // propertyId
  projectOwner?: string; // ownerId
  team?: string;
  visibility?: 'Public' | 'Private';
  startDate?: Date;
  expectedEndDate?: Date;
  budget?: number;
  priority?: 'Low' | 'Medium' | 'High';
  notes?: string;
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
      // Validate required fields
      if (!request.name || request.name.trim().length === 0) {
        return {
          success: false,
          errors: ['Project name is required']
        };
      }

      // Validate date range if both provided
      if (request.startDate && request.expectedEndDate) {
        if (request.startDate >= request.expectedEndDate) {
          return {
            success: false,
            errors: ['End date must be after start date']
          };
        }
      }

      // Check uniqueness: address + projectOwner
      if (request.address && request.projectOwner) {
        const existingProjects = (await this.projectRepository.list()).items;
        const duplicateExists = existingProjects.some((p: Project) => 
          p.propertyId === request.address && p.ownerId === request.projectOwner
        );

        if (duplicateExists) {
          return {
            success: false,
            errors: ['A project for this owner and address already exists']
          };
        }
      }

      // Create project entity with domain validation
      const projectEntity = ProjectEntity.create({
        name: request.name,
        description: request.description || request.notes || '',
        propertyId: request.address,
        ownerId: request.projectOwner,
        status: ProjectStatus.PLANNING,
        startDate: request.startDate,
        expectedEndDate: request.expectedEndDate,
        budget: request.budget,
        meta: {
          team: request.team,
          visibility: request.visibility || 'Public',
          priority: request.priority || 'Low',
          notes: request.notes
        },
        materials: [],
        phases: []
      });

      const project = projectEntity.data;

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