import { selectTopBlockedTasks, BlockedTaskItem } from '../../src/features/tasks/utils/selectTopBlockedTasks';

describe('selectTopBlockedTasks', () => {
  it('Scenario 1: Empty input returns []', () => {
    expect(selectTopBlockedTasks([])).toEqual([]);
  });

  it('Scenario 2: All tasks same project, 5 tasks, returns earliest 2', () => {
    const tasks: BlockedTaskItem[] = [
      { id: '1', title: 'T1', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-25' },
      { id: '2', title: 'T2', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-10' },
      { id: '3', title: 'T3', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-30' },
      { id: '4', title: 'T4', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-15' },
      { id: '5', title: 'T5', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-05' },
    ];

    const result = selectTopBlockedTasks(tasks, 2);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('5'); // Oct 05
    expect(result[1].id).toBe('2'); // Oct 10
  });

  it('Scenario 3: 3 projects x 3 tasks each, returns 2 per project = 6 globally sorted', () => {
    const tasks: BlockedTaskItem[] = [
      { id: 'p1_1', title: 'T1', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-05' },
      { id: 'p1_2', title: 'T2', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-15' },
      { id: 'p1_3', title: 'T3', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-25' },
      
      { id: 'p2_1', title: 'T1', projectId: 'p2', projectName: 'P2', status: 'blocked', scheduledAt: '2026-10-01' },
      { id: 'p2_2', title: 'T2', projectId: 'p2', projectName: 'P2', status: 'blocked', scheduledAt: '2026-10-10' },
      { id: 'p2_3', title: 'T3', projectId: 'p2', projectName: 'P2', status: 'blocked', scheduledAt: '2026-10-20' },

      { id: 'p3_1', title: 'T1', projectId: 'p3', projectName: 'P3', status: 'blocked', scheduledAt: '2026-10-12' },
      { id: 'p3_2', title: 'T2', projectId: 'p3', projectName: 'P3', status: 'blocked', scheduledAt: '2026-10-08' },
      { id: 'p3_3', title: 'T3', projectId: 'p3', projectName: 'P3', status: 'blocked', scheduledAt: '2026-10-02' },
    ];

    const result = selectTopBlockedTasks(tasks, 2);
    expect(result.length).toBe(6);
    expect(result.map(t => t.id)).toEqual([
      'p2_1', // Oct 01
      'p3_3', // Oct 02
      'p1_1', // Oct 05
      'p3_2', // Oct 08
      'p2_2', // Oct 10
      'p1_2', // Oct 15
    ]);
  });

  it('Scenario 4: Tasks with missing scheduledAt sort to end', () => {
    const tasks: BlockedTaskItem[] = [
      { id: '1', title: 'T1', projectId: 'p1', projectName: 'P1', status: 'blocked' },
      { id: '2', title: 'T2', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-10' },
      { id: '3', title: 'T3', projectId: 'p1', projectName: 'P1', status: 'blocked' },
    ];

    const result = selectTopBlockedTasks(tasks, 3);
    expect(result[0].id).toBe('2'); // Oct 10 comes first
    // remaining ones have no date
    expect(result.length).toBe(3);
  });

  it('Scenario 5: perProjectLimit = 1 returns 1 per project', () => {
    const tasks: BlockedTaskItem[] = [
      { id: '1', title: 'T1', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-25' },
      { id: '2', title: 'T2', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-10' },
      { id: '3', title: 'T3', projectId: 'p2', projectName: 'P2', status: 'blocked', scheduledAt: '2026-10-12' },
      { id: '4', title: 'T4', projectId: 'p2', projectName: 'P2', status: 'blocked', scheduledAt: '2026-10-15' },
    ];

    const result = selectTopBlockedTasks(tasks, 1);
    expect(result.length).toBe(2);
    expect(result.map(t => t.id)).toEqual(['2', '3']);
  });

  it('Scenario 6: Only includes blocked tasks', () => {
    const tasks: BlockedTaskItem[] = [
      { id: '1', title: 'T1', projectId: 'p1', projectName: 'P1', status: 'blocked', scheduledAt: '2026-10-25' },
      { id: '2', title: 'T2', projectId: 'p1', projectName: 'P1', status: 'pending', scheduledAt: '2026-10-10' },
    ];

    const result = selectTopBlockedTasks(tasks, 2);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
  });
});
