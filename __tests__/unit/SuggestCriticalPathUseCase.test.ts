import { SuggestCriticalPathUseCase } from '../../src/application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { CriticalPathService } from '../../src/application/services/CriticalPathService';
import { SuggestCriticalPathRequest } from '../../src/data/critical-path/schema';

describe('SuggestCriticalPathUseCase', () => {
  const service = new CriticalPathService();
  let useCase: SuggestCriticalPathUseCase;

  beforeEach(() => {
    useCase = new SuggestCriticalPathUseCase(service);
  });

  it('complete rebuild NSW — returns 13+ tasks in correct order, all ids unique', () => {
    const req: SuggestCriticalPathRequest = {
      project_type: 'complete_rebuild',
      state: 'NSW',
    };
    const result = useCase.execute(req);
    expect(result.length).toBeGreaterThanOrEqual(13);
    // ordered 1-based contiguous
    result.forEach((s, i) => expect(s.order).toBe(i + 1));
    // unique IDs
    const ids = result.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('extension National — returns extension canonical sequence with correct project_type', () => {
    const req: SuggestCriticalPathRequest = {
      project_type: 'extension',
      state: 'National',
    };
    const result = useCase.execute(req);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(s => expect(s.source).toBe('lookup'));
  });

  it('heritage_flag=true adds heritage task to result for NSW complete_rebuild', () => {
    const req: SuggestCriticalPathRequest = {
      project_type: 'complete_rebuild',
      state: 'NSW',
      heritage_flag: true,
    };
    const result = useCase.execute(req);
    const heritageTask = result.find(t => /heritage/i.test(t.title));
    expect(heritageTask).toBeDefined();
    expect(heritageTask!.source).toBe('lookup');
    expect(heritageTask!.lookup_file).toContain('NSW/');
  });

  it('heritage_flag=false excludes heritage task from result', () => {
    const req: SuggestCriticalPathRequest = {
      project_type: 'complete_rebuild',
      state: 'NSW',
      heritage_flag: false,
    };
    const result = useCase.execute(req);
    const heritageTask = result.find(t => /heritage/i.test(t.title));
    expect(heritageTask).toBeUndefined();
  });

  it('delegates entirely to service (thin orchestrator)', () => {
    const mockService = {
      suggest: jest.fn().mockReturnValue([]),
    } as unknown as CriticalPathService;
    const uc = new SuggestCriticalPathUseCase(mockService);
    const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild' };
    uc.execute(req);
    expect(mockService.suggest).toHaveBeenCalledWith(req);
  });
});
