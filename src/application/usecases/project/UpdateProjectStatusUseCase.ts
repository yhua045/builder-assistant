/**
 * Use Case: Update Project Status
 * 
 * Changes a project's status, validating the transition through workflow rules.
 */

import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';
import { ProjectStatus } from '../../../domain/entities/Project';
import { ProjectValidationService } from '../../../domain/services/ProjectValidationService';

export type UseCaseResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export interface UpdateProjectStatusRequest {
  projectId: string;
  newStatus: ProjectStatus;
  reason?: string; // Optional reason for status change
}

export interface UpdateProjectStatusResponse {
  projectId: string;
  previousStatus: ProjectStatus;
  newStatus: ProjectStatus;
  updatedAt: Date;
}

export class UpdateProjectStatusUseCase {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly validationService: ProjectValidationService
  ) {}

  async execute(
    request: UpdateProjectStatusRequest
  ): Promise<UseCaseResult<UpdateProjectStatusResponse>> {
    try {
      // 1. Fetch the project
      const project = await this.projectRepository.findById(request.projectId);
      if (!project) {
        return {
          success: false,
          error: `Project not found: ${request.projectId}`,
        };
      }

      const currentStatus = project.status;

      // 2. Validate the status transition using workflow service
      const validationResult = this.validationService.validateStatusTransition(
        currentStatus,
        request.newStatus
      );

      if (!validationResult.ok) {
        return {
          success: false,
          error: validationResult.reason,
        };
      }

      // 3. Update the project
      const now = new Date();
      const updatedProject = {
        ...project,
        status: request.newStatus,
        updatedAt: now,
        meta: {
          ...(project.meta || {}),
          lastStatusChange: {
            from: currentStatus,
            to: request.newStatus,
            changedAt: now.toISOString(),
            reason: request.reason,
          },
        },
      };

      // 4. Persist the change
      await this.projectRepository.save(updatedProject);

      // 5. Return success response
      return {
        success: true,
        data: {
          projectId: request.projectId,
          previousStatus: currentStatus,
          newStatus: request.newStatus,
          updatedAt: now,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Gets allowed next statuses for a project
   */
  async getAllowedStatuses(projectId: string): Promise<UseCaseResult<ProjectStatus[]>> {
    try {
      const project = await this.projectRepository.findById(projectId);
      if (!project) {
        return {
          success: false,
          error: `Project not found: ${projectId}`,
        };
      }

      const allowedStatuses = this.validationService.getAllowedNextStatuses(project.status);
      
      return {
        success: true,
        data: allowedStatuses,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
