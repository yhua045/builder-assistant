import { toOverview } from '../../src/hooks/useProjectsOverview';
import { Project, ProjectStatus } from '../../src/domain/entities/Project';
import { Task } from '../../src/domain/entities/Task';

describe('useProjectsOverview - toOverview', () => {
  const mockProject: Project = {
    id: 'p1',
    name: 'Test Project',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: ProjectStatus.IN_PROGRESS,
    materials: [],
    phases: []
  };

  it('calculates progress percent correctly using only critical tasks', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'Critical 1', status: 'completed', isCriticalPath: true },
      { id: 't2', projectId: 'p1', title: 'Critical 2', status: 'pending', isCriticalPath: true },
      { id: 't3', projectId: 'p1', title: 'Non-critical 1', status: 'pending', isCriticalPath: false },
    ];

    const overview = toOverview(mockProject, tasks);
    
    expect(overview.criticalTasksTotal).toBe(2);
    expect(overview.criticalTasksCompleted).toBe(1);
    expect(overview.progressPercent).toBe(50); // 1 / 2 completed
  });

  it('correctly handles 0 critical tasks', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'Non-critical 1', status: 'completed', isCriticalPath: false },
    ];

    const overview = toOverview(mockProject, tasks);
    
    expect(overview.criticalTasksTotal).toBe(0);
    expect(overview.progressPercent).toBe(0);
  });

  it('identifies overdue and due-soon tasks appropriately', () => {
    const now = Date.now();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

    const overdueDate = new Date(now - TWO_DAYS_MS).toISOString();
    const dueSoonDate = new Date(now + TWO_DAYS_MS).toISOString();
    const futureDate = new Date(now + TEN_DAYS_MS).toISOString();

    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'Overdue', status: 'pending', isCriticalPath: true, dueDate: overdueDate },
      { id: 't2', projectId: 'p1', title: 'Due Soon', status: 'in_progress', isCriticalPath: true, dueDate: dueSoonDate },
      { id: 't3', projectId: 'p1', title: 'Future', status: 'pending', isCriticalPath: true, dueDate: futureDate },
      // Check that non-critical tasks don't count
      { id: 't4', projectId: 'p1', title: 'Overdue NC', status: 'pending', isCriticalPath: false, dueDate: overdueDate },
    ];

    const overview = toOverview(mockProject, tasks);
    
    expect(overview.overdueCriticalTasksCount).toBe(1);
    expect(overview.dueSoonCriticalTasksCount).toBe(1);
    expect(overview.nextCriticalTask?.id).toBe('t1'); // sorted by nearest/overdue date first
  });
});