import { toOverview } from '../../hooks/useProjectsOverview';
import { Project, ProjectStatus } from '../../../../domain/entities/Project';
import { Task } from '../../../../domain/entities/Task';

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

    const overview = toOverview(mockProject, tasks, [] as any);
    
    expect(overview.criticalTasksTotal).toBe(2);
    expect(overview.criticalTasksCompleted).toBe(1);
    expect(overview.progressPercent).toBe(50); // 1 / 2 completed
  });

  it('correctly handles 0 critical tasks', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'Non-critical 1', status: 'completed', isCriticalPath: false },
    ];

    const overview = toOverview(mockProject, tasks, [] as any);
    
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

    const overview = toOverview(mockProject, tasks, [] as any);
    
    expect(overview.overdueCriticalTasksCount).toBe(1);
    expect(overview.dueSoonCriticalTasksCount).toBe(1);
    expect(overview.nextCriticalTask?.id).toBe('t1'); // sorted by nearest/overdue date first
  });
});

describe('useProjectsOverview - toOverview - R-series (new fields)', () => {
  const mockProject: Project = {
    id: 'p1',
    name: 'Test Project',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: ProjectStatus.IN_PROGRESS,
    materials: [],
    phases: [],
  };

  // R1: totalTasksCount equals the total number of tasks for this project
  it('R1: totalTasksCount equals tasks.length for the project', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'T1', status: 'completed', isCriticalPath: false },
      { id: 't2', projectId: 'p1', title: 'T2', status: 'pending', isCriticalPath: false },
      { id: 't3', projectId: 'p1', title: 'T3', status: 'blocked', isCriticalPath: false },
    ];
    const overview = toOverview(mockProject, tasks, []);
    expect(overview.totalTasksCount).toBe(3);
  });

  // R2: totalTasksCompleted counts only completed tasks
  it('R2: totalTasksCompleted counts tasks with status=completed', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'T1', status: 'completed', isCriticalPath: false },
      { id: 't2', projectId: 'p1', title: 'T2', status: 'completed', isCriticalPath: false },
      { id: 't3', projectId: 'p1', title: 'T3', status: 'completed', isCriticalPath: false },
      { id: 't4', projectId: 'p1', title: 'T4', status: 'pending', isCriticalPath: false },
      { id: 't5', projectId: 'p1', title: 'T5', status: 'blocked', isCriticalPath: false },
    ];
    const overview = toOverview(mockProject, tasks, []);
    expect(overview.totalTasksCompleted).toBe(3);
  });

  // R3: overallStatus === 'blocked' when any task is blocked
  it('R3: overallStatus is blocked when a blocked task exists', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'T1', status: 'completed', isCriticalPath: true },
      { id: 't2', projectId: 'p1', title: 'T2', status: 'blocked', isCriticalPath: true },
      { id: 't3', projectId: 'p1', title: 'T3', status: 'pending', isCriticalPath: false },
    ];
    const overview = toOverview(mockProject, tasks, []);
    expect(overview.overallStatus).toBe('blocked');
    expect(overview.blockedTasks).toHaveLength(1);
    expect(overview.blockedTasks[0].id).toBe('t2');
  });

  // R4: overallStatus === 'at_risk' when no blocked tasks but overdue critical task exists
  it('R4: overallStatus is at_risk when there are overdue critical tasks but no blocked tasks', () => {
    const overdueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'Overdue', status: 'pending', isCriticalPath: true, dueDate: overdueDate },
      { id: 't2', projectId: 'p1', title: 'Normal', status: 'pending', isCriticalPath: false },
    ];
    const overview = toOverview(mockProject, tasks, []);
    expect(overview.overallStatus).toBe('at_risk');
    expect(overview.blockedTasks).toHaveLength(0);
  });

  // R5: overallStatus === 'on_track' when no blocked tasks and no overdue tasks
  it('R5: overallStatus is on_track when no blocked or overdue tasks', () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'T1', status: 'completed', isCriticalPath: true },
      { id: 't2', projectId: 'p1', title: 'T2', status: 'pending', isCriticalPath: true, dueDate: futureDate },
    ];
    const overview = toOverview(mockProject, tasks, []);
    expect(overview.overallStatus).toBe('on_track');
    expect(overview.blockedTasks).toHaveLength(0);
  });

  // allTasksPercent: derived from all tasks (not just critical)
  it('allTasksPercent is based on all tasks, not just critical', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'C1', status: 'completed', isCriticalPath: true },
      { id: 't2', projectId: 'p1', title: 'C2', status: 'pending', isCriticalPath: true },
      { id: 't3', projectId: 'p1', title: 'NC1', status: 'completed', isCriticalPath: false },
      { id: 't4', projectId: 'p1', title: 'NC2', status: 'pending', isCriticalPath: false },
    ];
    const overview = toOverview(mockProject, tasks, []);
    // 2 of 4 completed → 50%
    expect(overview.allTasksPercent).toBe(50);
    // critical-path progressPercent: 1 of 2 → 50% too, but derivation is separate
    expect(overview.progressPercent).toBe(50);
  });
});