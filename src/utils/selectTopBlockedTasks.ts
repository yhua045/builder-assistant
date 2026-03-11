export interface BlockedTaskItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectColor?: string;
  scheduledAt?: string;   // ISO date string — used for ordering
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status: 'blocked' | 'pending';
}

/**
 * From a flat list of blocked task items, returns at most `perProjectLimit`
 * tasks per project (earliest scheduledAt first), then sorts the resulting
 * list globally by scheduledAt ascending.
 *
 * Nullish scheduledAt sorts to the end.
 */
export function selectTopBlockedTasks(
  tasks: BlockedTaskItem[],
  perProjectLimit = 2
): BlockedTaskItem[] {
  // Filter for blocked tasks
  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  // Group by project
  const tasksByProject = new Map<string, BlockedTaskItem[]>();
  for (const task of blockedTasks) {
    if (!tasksByProject.has(task.projectId)) {
      tasksByProject.set(task.projectId, []);
    }
    tasksByProject.get(task.projectId)!.push(task);
  }

  // Sort within groups and limit
  const selectedTasks: BlockedTaskItem[] = [];
  
  for (const projectTasks of tasksByProject.values()) {
    const sorted = [...projectTasks].sort((a, b) => {
      if (!a.scheduledAt && !b.scheduledAt) return 0;
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      
      const timeA = new Date(a.scheduledAt).getTime();
      const timeB = new Date(b.scheduledAt).getTime();
      return timeA - timeB;
    });
    
    selectedTasks.push(...sorted.slice(0, perProjectLimit));
  }

  // Global sort
  return selectedTasks.sort((a, b) => {
    if (!a.scheduledAt && !b.scheduledAt) return 0;
    if (!a.scheduledAt) return 1;
    if (!b.scheduledAt) return -1;
    
    const timeA = new Date(a.scheduledAt).getTime();
    const timeB = new Date(b.scheduledAt).getTime();
    return timeA - timeB;
  });
}
