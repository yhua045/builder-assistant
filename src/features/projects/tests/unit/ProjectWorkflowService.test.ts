/**
 * Unit Tests: ProjectWorkflowService
 * 
 * Tests for centralized workflow validation of project status transitions.
 */

import { ProjectWorkflowService } from '../../domain/ProjectWorkflowService';
import { ProjectStatus } from '../../../../domain/entities/Project';

describe('ProjectWorkflowService', () => {
  let service: ProjectWorkflowService;

  beforeEach(() => {
    service = new ProjectWorkflowService();
  });

  describe('canTransition', () => {
    describe('from PLANNING', () => {
      it('should allow transition to IN_PROGRESS', () => {
        const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS);
        expect(result.ok).toBe(true);
      });

      it('should allow transition to CANCELLED', () => {
        const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.CANCELLED);
        expect(result.ok).toBe(true);
      });

      it('should reject transition to COMPLETED', () => {
        const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.COMPLETED);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('Must move to IN_PROGRESS before COMPLETED');
        }
      });

      it('should reject transition to ON_HOLD', () => {
        const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.ON_HOLD);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBeTruthy();
        }
      });
    });

    describe('from IN_PROGRESS', () => {
      it('should allow transition to COMPLETED', () => {
        const result = service.canTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED);
        expect(result.ok).toBe(true);
      });

      it('should allow transition to ON_HOLD', () => {
        const result = service.canTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD);
        expect(result.ok).toBe(true);
      });

      it('should allow transition to CANCELLED', () => {
        const result = service.canTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED);
        expect(result.ok).toBe(true);
      });

      it('should reject transition to PLANNING', () => {
        const result = service.canTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.PLANNING);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBeTruthy();
        }
      });
    });

    describe('from ON_HOLD', () => {
      it('should allow transition back to IN_PROGRESS', () => {
        const result = service.canTransition(ProjectStatus.ON_HOLD, ProjectStatus.IN_PROGRESS);
        expect(result.ok).toBe(true);
      });

      it('should allow transition to CANCELLED', () => {
        const result = service.canTransition(ProjectStatus.ON_HOLD, ProjectStatus.CANCELLED);
        expect(result.ok).toBe(true);
      });

      it('should reject transition to COMPLETED', () => {
        const result = service.canTransition(ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain('Must resume to IN_PROGRESS before COMPLETED');
        }
      });

      it('should reject transition to PLANNING', () => {
        const result = service.canTransition(ProjectStatus.ON_HOLD, ProjectStatus.PLANNING);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBeTruthy();
        }
      });
    });

    describe('from COMPLETED', () => {
      it('should reject any transition (terminal state)', () => {
        const transitions = [
          ProjectStatus.PLANNING,
          ProjectStatus.IN_PROGRESS,
          ProjectStatus.ON_HOLD,
          ProjectStatus.CANCELLED,
        ];

        transitions.forEach(status => {
          const result = service.canTransition(ProjectStatus.COMPLETED, status);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.reason).toContain('terminal');
          }
        });
      });

      it('should allow staying in COMPLETED (no-op)', () => {
        const result = service.canTransition(ProjectStatus.COMPLETED, ProjectStatus.COMPLETED);
        expect(result.ok).toBe(true);
      });
    });

    describe('from CANCELLED', () => {
      it('should reject any transition (terminal state)', () => {
        const transitions = [
          ProjectStatus.PLANNING,
          ProjectStatus.IN_PROGRESS,
          ProjectStatus.ON_HOLD,
          ProjectStatus.COMPLETED,
        ];

        transitions.forEach(status => {
          const result = service.canTransition(ProjectStatus.CANCELLED, status);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.reason).toContain('terminal');
          }
        });
      });

      it('should allow staying in CANCELLED (no-op)', () => {
        const result = service.canTransition(ProjectStatus.CANCELLED, ProjectStatus.CANCELLED);
        expect(result.ok).toBe(true);
      });
    });

    describe('same-state transitions', () => {
      it('should allow staying in the same state for all statuses', () => {
        const statuses = [
          ProjectStatus.PLANNING,
          ProjectStatus.IN_PROGRESS,
          ProjectStatus.ON_HOLD,
          ProjectStatus.COMPLETED,
          ProjectStatus.CANCELLED,
        ];

        statuses.forEach(status => {
          const result = service.canTransition(status, status);
          expect(result.ok).toBe(true);
        });
      });
    });
  });

  describe('allowedNext', () => {
    it('should return allowed transitions from PLANNING', () => {
      const allowed = service.allowedNext(ProjectStatus.PLANNING);
      expect(allowed).toHaveLength(2);
      expect(allowed).toContain(ProjectStatus.IN_PROGRESS);
      expect(allowed).toContain(ProjectStatus.CANCELLED);
    });

    it('should return allowed transitions from IN_PROGRESS', () => {
      const allowed = service.allowedNext(ProjectStatus.IN_PROGRESS);
      expect(allowed).toHaveLength(3);
      expect(allowed).toContain(ProjectStatus.COMPLETED);
      expect(allowed).toContain(ProjectStatus.ON_HOLD);
      expect(allowed).toContain(ProjectStatus.CANCELLED);
    });

    it('should return allowed transitions from ON_HOLD', () => {
      const allowed = service.allowedNext(ProjectStatus.ON_HOLD);
      expect(allowed).toHaveLength(2);
      expect(allowed).toContain(ProjectStatus.IN_PROGRESS);
      expect(allowed).toContain(ProjectStatus.CANCELLED);
    });

    it('should return empty array for COMPLETED (terminal)', () => {
      const allowed = service.allowedNext(ProjectStatus.COMPLETED);
      expect(allowed).toHaveLength(0);
    });

    it('should return empty array for CANCELLED (terminal)', () => {
      const allowed = service.allowedNext(ProjectStatus.CANCELLED);
      expect(allowed).toHaveLength(0);
    });

    it('should return a new array (not mutate internal state)', () => {
      const allowed1 = service.allowedNext(ProjectStatus.PLANNING);
      const allowed2 = service.allowedNext(ProjectStatus.PLANNING);
      expect(allowed1).not.toBe(allowed2); // Different array instances
      expect(allowed1).toEqual(allowed2); // Same content
    });
  });

  describe('error messages', () => {
    it('should provide specific message for PLANNING -> COMPLETED', () => {
      const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.COMPLETED);
      if (!result.ok) {
        expect(result.reason).toBe('Must move to IN_PROGRESS before COMPLETED');
      }
    });

    it('should provide specific message for ON_HOLD -> COMPLETED', () => {
      const result = service.canTransition(ProjectStatus.ON_HOLD, ProjectStatus.COMPLETED);
      if (!result.ok) {
        expect(result.reason).toBe('Must resume to IN_PROGRESS before COMPLETED');
      }
    });

    it('should provide terminal state message for COMPLETED transitions', () => {
      const result = service.canTransition(ProjectStatus.COMPLETED, ProjectStatus.IN_PROGRESS);
      if (!result.ok) {
        expect(result.reason).toContain('terminal');
      }
    });

    it('should list allowed transitions in error message for generic cases', () => {
      const result = service.canTransition(ProjectStatus.PLANNING, ProjectStatus.ON_HOLD);
      if (!result.ok) {
        expect(result.reason).toContain('in_progress');
        expect(result.reason).toContain('cancelled');
      }
    });
  });
});
