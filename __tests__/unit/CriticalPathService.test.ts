import { CriticalPathService, CriticalPathLookupNotFoundError } from '../../src/application/services/CriticalPathService';
import { SuggestCriticalPathRequest } from '../../src/data/critical-path/schema';

describe('CriticalPathService', () => {
  let service: CriticalPathService;

  beforeEach(() => {
    service = new CriticalPathService();
  });

  // ── resolveKey ─────────────────────────────────────────────────────────────

  describe('resolveKey', () => {
    it('returns state-specific key when state is provided', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'NSW' };
      expect(service.resolveKey(req)).toBe('NSW/complete_rebuild');
    });

    it('returns National key when no state is provided', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'extension' };
      expect(service.resolveKey(req)).toBe('National/extension');
    });

    it('returns National key when state is National', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'renovation', state: 'National' };
      expect(service.resolveKey(req)).toBe('National/renovation');
    });
  });

  // ── loadFile ───────────────────────────────────────────────────────────────

  describe('loadFile', () => {
    it('loads NSW/complete_rebuild successfully', () => {
      const file = service.loadFile('NSW/complete_rebuild');
      expect(file.project_type).toBe('complete_rebuild');
      expect(file.state).toBe('NSW');
      expect(Array.isArray(file.tasks)).toBe(true);
      expect(file.tasks.length).toBeGreaterThan(0);
    });

    it('loads National/complete_rebuild successfully', () => {
      const file = service.loadFile('National/complete_rebuild');
      expect(file.project_type).toBe('complete_rebuild');
      expect(Array.isArray(file.tasks)).toBe(true);
      expect(file.tasks.length).toBeGreaterThanOrEqual(13);
    });

    it('loads National/extension successfully', () => {
      const file = service.loadFile('National/extension');
      expect(file.project_type).toBe('extension');
    });

    it('throws CriticalPathLookupNotFoundError for unknown key', () => {
      expect(() => service.loadFile('ZZ/unknown_type')).toThrow(CriticalPathLookupNotFoundError);
    });
  });

  // ── evaluateCondition ──────────────────────────────────────────────────────

  describe('evaluateCondition', () => {
    const req: SuggestCriticalPathRequest = {
      project_type: 'complete_rebuild',
      state: 'NSW',
      heritage_flag: true,
      constrained_site_flag: false,
      connects_to_existing: false,
    };

    it('returns true when heritage_flag === true and flag is true', () => {
      expect(service.evaluateCondition('heritage_flag === true', req)).toBe(true);
    });

    it('returns false when heritage_flag === true but flag is false', () => {
      const req2 = { ...req, heritage_flag: false };
      expect(service.evaluateCondition('heritage_flag === true', req2)).toBe(false);
    });

    it('returns true when constrained_site_flag === true and flag is true', () => {
      const req2 = { ...req, constrained_site_flag: true };
      expect(service.evaluateCondition('constrained_site_flag === true', req2)).toBe(true);
    });

    it('returns false when constrained_site_flag === true but flag is false', () => {
      expect(service.evaluateCondition('constrained_site_flag === true', req)).toBe(false);
    });

    it('returns true when connects_to_existing === true and flag is true', () => {
      const req2 = { ...req, connects_to_existing: true };
      expect(service.evaluateCondition('connects_to_existing === true', req2)).toBe(true);
    });

    it('returns true (fail-open) for unrecognised expression', () => {
      // Fail-safe: include task on unrecognised condition
      expect(service.evaluateCondition('some_unknown_flag === true', req)).toBe(true);
    });

    it('does NOT use eval() — no code injection possible', () => {
      // Any JS expression beyond the whitelist should return true (fail-open), not execute
      const injectionAttempt = 'process.exit(1) === true';
      expect(() => service.evaluateCondition(injectionAttempt, req)).not.toThrow();
    });
  });

  // ── suggest ────────────────────────────────────────────────────────────────

  describe('suggest', () => {
    it('returns suggestions with source: lookup and lookup_file set', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'NSW' };
      const result = service.suggest(req);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(s => {
        expect(s.source).toBe('lookup');
        expect(typeof s.lookup_file).toBe('string');
        expect(s.lookup_file.length).toBeGreaterThan(0);
      });
    });

    it('assigns contiguous 1-based order values', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'NSW' };
      const result = service.suggest(req);
      result.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
      });
    });

    it('excludes condition-gated task when flag is false and re-numbers order', () => {
      const req: SuggestCriticalPathRequest = {
        project_type: 'complete_rebuild',
        state: 'NSW',
        heritage_flag: false,
      };
      const result = service.suggest(req);
      // Heritage task should be excluded
      const heritageTask = result.find(t => /heritage/i.test(t.title));
      expect(heritageTask).toBeUndefined();
      // Order should still be contiguous 1-based
      result.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
      });
    });

    it('includes condition-gated task when flag is true', () => {
      const req: SuggestCriticalPathRequest = {
        project_type: 'complete_rebuild',
        state: 'NSW',
        heritage_flag: true,
      };
      const result = service.suggest(req);
      const heritageTask = result.find(t => /heritage/i.test(t.title));
      expect(heritageTask).toBeDefined();
    });

    it('falls back to National when state-specific file is not available', () => {
      // TAS has no state-specific complete_rebuild file; should fall back
      const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'TAS' };
      const result = service.suggest(req);
      expect(result.length).toBeGreaterThan(0);
      result.forEach(s => {
        expect(s.lookup_file).toContain('National/');
      });
    });

    it('throws when neither state nor National file exists for project_type', () => {
      const req: SuggestCriticalPathRequest = {
        project_type: 'dual_occupancy',
        state: 'TAS',
      };
      expect(() => service.suggest(req)).toThrow(CriticalPathLookupNotFoundError);
    });

    it('all returned suggestion IDs are unique', () => {
      const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'NSW' };
      const result = service.suggest(req);
      const ids = result.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
