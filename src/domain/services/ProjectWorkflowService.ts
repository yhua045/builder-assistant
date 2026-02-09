/**
 * Domain Service: ProjectWorkflowService
 * 
 * Centralized workflow validator for project status transitions.
 * Ensures that project status changes follow allowed business rules.
 */

import { ProjectStatus } from '../entities/Project';

/**
 * Result of a workflow transition check
 */
export type WorkflowCheck = 
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Service interface for validating project status transitions
 */
export interface IProjectWorkflowService {
  /**
   * Checks if a transition from current to next status is allowed
   * @param current - The current project status
   * @param next - The desired next project status
   * @returns WorkflowCheck indicating if transition is allowed
   */
  canTransition(current: ProjectStatus, next: ProjectStatus): WorkflowCheck;

  /**
   * Returns the list of allowed next statuses from the current status
   * @param current - The current project status
   * @returns Array of allowed next statuses
   */
  allowedNext(current: ProjectStatus): ProjectStatus[];
}

/**
 * Default implementation of project workflow validation
 * Uses an explicit transition map to define allowed status changes
 */
export class ProjectWorkflowService implements IProjectWorkflowService {
  /**
   * Map of allowed transitions for each status
   */
  private static readonly TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
    [ProjectStatus.PLANNING]: [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
    [ProjectStatus.IN_PROGRESS]: [ProjectStatus.COMPLETED, ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED],
    [ProjectStatus.ON_HOLD]: [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED],
    [ProjectStatus.COMPLETED]: [],
    [ProjectStatus.CANCELLED]: [],
  };

  canTransition(current: ProjectStatus, next: ProjectStatus): WorkflowCheck {
    // Allow staying in the same status (no-op)
    if (current === next) {
      return { ok: true };
    }

    const allowedTransitions = ProjectWorkflowService.TRANSITIONS[current];
    
    if (allowedTransitions.includes(next)) {
      return { ok: true };
    }

    return {
      ok: false,
      reason: this.getTransitionErrorMessage(current, next),
    };
  }

  allowedNext(current: ProjectStatus): ProjectStatus[] {
    return [...ProjectWorkflowService.TRANSITIONS[current]];
  }

  /**
   * Generates a helpful error message for invalid transitions
   */
  private getTransitionErrorMessage(current: ProjectStatus, next: ProjectStatus): string {
    const allowed = ProjectWorkflowService.TRANSITIONS[current];
    
    if (allowed.length === 0) {
      return `Cannot transition from ${current}: status is terminal`;
    }

    // Provide specific guidance for common invalid transitions
    if (current === ProjectStatus.PLANNING && next === ProjectStatus.COMPLETED) {
      return 'Must move to IN_PROGRESS before COMPLETED';
    }

    if (current === ProjectStatus.ON_HOLD && next === ProjectStatus.COMPLETED) {
      return 'Must resume to IN_PROGRESS before COMPLETED';
    }

    return `Cannot transition from ${current} to ${next}. Allowed: ${allowed.join(', ')}`;
  }
}
