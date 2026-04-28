/**
 * Unit Tests: ProjectValidationService - Workflow Integration
 * 
 * Tests for integration of workflow validation into ProjectValidationService.
 */

import { ProjectValidationService } from '../../domain/ProjectValidationService';
import { ProjectWorkflowService } from '../../domain/ProjectWorkflowService';
import { ProjectStatus } from '../../../../domain/entities/Project';

describe('ProjectValidationService - Workflow Integration', () => {
  let service: ProjectValidationService;

  beforeEach(() => {
    service = new ProjectValidationService();
  });

  describe('validateStatusTransition', () => {
    it('should allow valid transition from PLANNING to IN_PROGRESS', () => {
      const result = service.validateStatusTransition(
        ProjectStatus.PLANNING,
        ProjectStatus.IN_PROGRESS
      );
      expect(result.ok).toBe(true);
    });

    it('should reject invalid transition from PLANNING to COMPLETED', () => {
      const result = service.validateStatusTransition(
        ProjectStatus.PLANNING,
        ProjectStatus.COMPLETED
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBeTruthy();
      }
    });

    it('should allow transition from IN_PROGRESS to COMPLETED', () => {
      const result = service.validateStatusTransition(
        ProjectStatus.IN_PROGRESS,
        ProjectStatus.COMPLETED
      );
      expect(result.ok).toBe(true);
    });

    it('should reject transitions from terminal states', () => {
      const result = service.validateStatusTransition(
        ProjectStatus.COMPLETED,
        ProjectStatus.IN_PROGRESS
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toContain('terminal');
      }
    });
  });

  describe('getAllowedNextStatuses', () => {
    it('should return correct allowed statuses for PLANNING', () => {
      const allowed = service.getAllowedNextStatuses(ProjectStatus.PLANNING);
      expect(allowed).toContain(ProjectStatus.IN_PROGRESS);
      expect(allowed).toContain(ProjectStatus.CANCELLED);
      expect(allowed).toHaveLength(2);
    });

    it('should return correct allowed statuses for IN_PROGRESS', () => {
      const allowed = service.getAllowedNextStatuses(ProjectStatus.IN_PROGRESS);
      expect(allowed).toContain(ProjectStatus.COMPLETED);
      expect(allowed).toContain(ProjectStatus.ON_HOLD);
      expect(allowed).toContain(ProjectStatus.CANCELLED);
      expect(allowed).toHaveLength(3);
    });

    it('should return empty array for terminal states', () => {
      const allowedCompleted = service.getAllowedNextStatuses(ProjectStatus.COMPLETED);
      const allowedCancelled = service.getAllowedNextStatuses(ProjectStatus.CANCELLED);
      
      expect(allowedCompleted).toHaveLength(0);
      expect(allowedCancelled).toHaveLength(0);
    });
  });

  describe('constructor with custom workflow service', () => {
    it('should use provided workflow service', () => {
      const customWorkflowService = new ProjectWorkflowService();
      const customService = new ProjectValidationService(customWorkflowService);
      
      const result = customService.validateStatusTransition(
        ProjectStatus.PLANNING,
        ProjectStatus.IN_PROGRESS
      );
      expect(result.ok).toBe(true);
    });

    it('should use default workflow service when none provided', () => {
      const defaultService = new ProjectValidationService();
      
      const result = defaultService.validateStatusTransition(
        ProjectStatus.PLANNING,
        ProjectStatus.IN_PROGRESS
      );
      expect(result.ok).toBe(true);
    });
  });
});
