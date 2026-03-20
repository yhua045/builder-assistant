import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { queryKeys } from './queryKeys';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { Task } from '../domain/entities/Task';
import { Project } from '../domain/entities/Project';
import { Payment } from '../domain/entities/Payment';

export interface PhaseOverview {
  phaseId: string | null;
  phaseName: string;
  tasks: Task[];
  totalCount: number;
  completedCount: number;
  progressPercent: number;
  isBlocked: boolean;
  criticalCompleted: number;
  criticalTotal: number;
}

export interface ProjectOverview {
  project: Project;
  progressPercent: number;
  criticalTasksCompleted: number;
  criticalTasksTotal: number;
  nextCriticalTask: Task | null;
  overdueCriticalTasksCount: number;
  dueSoonCriticalTasksCount: number;
  criticalTasks: Task[];
  nonCriticalTasks: Task[];
  totalPendingPayment: number; // Aggregated pending payment amount
  phaseOverviews: PhaseOverview[];
  totalTasksCount: number;
  totalTasksCompleted: number;
  allTasksPercent: number;
  overallStatus: 'on_track' | 'at_risk' | 'blocked';
  blockedTasks: Task[];
}

/**
 * Calculates project overview derived from projects, tasks, and payments.
 */
export function toOverview(project: Project, allTasks: Task[], allPayments: Payment[]): ProjectOverview {
  const tasks = allTasks.filter(t => t.projectId === project.id);
  const criticalTasks = tasks.filter(t => t.isCriticalPath);
  const nonCriticalTasks = tasks.filter(t => !t.isCriticalPath);

  const criticalTasksTotal = criticalTasks.length;
  const criticalTasksCompleted = criticalTasks.filter(t => t.status === 'completed').length;
  const progressPercent = criticalTasksTotal === 0 ? 0 : Math.round((criticalTasksCompleted / criticalTasksTotal) * 100);

  const pendingCritical = criticalTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  
  // Sort pending critical tasks by due date (nulls last)
  pendingCritical.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const nextCriticalTask = pendingCritical.length > 0 ? pendingCritical[0] : null;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const t of pendingCritical) {
    if (t.dueDate) {
      const dueTime = new Date(t.dueDate).getTime();
      if (dueTime < now) {
        overdueCount++;
      } else if (dueTime < now + (ONE_DAY * 3)) { // Due in next 3 days
        dueSoonCount++;
      }
    }
  }

  // Calculate total pending payments for this project
  const projectPayments = allPayments.filter(p => p.projectId === project.id);
  const totalPendingPayment = projectPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  // Build phaseOverviews from project.phases
  const phaseOverviews: PhaseOverview[] = (project.phases ?? []).map(phase => {
    const phaseTasks = tasks.filter(t => t.phaseId === phase.id);
    const phaseCompleted = phaseTasks.filter(t => t.status === 'completed').length;
    const phaseTotal = phaseTasks.length;
    const phaseCritical = phaseTasks.filter(t => t.isCriticalPath);
    return {
      phaseId: phase.id,
      phaseName: phase.name,
      tasks: phaseTasks,
      totalCount: phaseTotal,
      completedCount: phaseCompleted,
      progressPercent: phaseTotal === 0 ? 0 : Math.round((phaseCompleted / phaseTotal) * 100),
      isBlocked: phaseTasks.some(t => t.status === 'blocked'),
      criticalCompleted: phaseCritical.filter(t => t.status === 'completed').length,
      criticalTotal: phaseCritical.length,
    };
  });

  // Append synthetic 'Unassigned' phase for tasks without a phaseId
  const unassignedTasks = tasks.filter(t => !t.phaseId);
  if (unassignedTasks.length > 0) {
    const unassignedCompleted = unassignedTasks.filter(t => t.status === 'completed').length;
    const unassignedCritical = unassignedTasks.filter(t => t.isCriticalPath);
    phaseOverviews.push({
      phaseId: null,
      phaseName: 'Unassigned',
      tasks: unassignedTasks,
      totalCount: unassignedTasks.length,
      completedCount: unassignedCompleted,
      progressPercent: Math.round((unassignedCompleted / unassignedTasks.length) * 100),
      isBlocked: unassignedTasks.some(t => t.status === 'blocked'),
      criticalCompleted: unassignedCritical.filter(t => t.status === 'completed').length,
      criticalTotal: unassignedCritical.length,
    });
  }

  // Derived all-tasks fields (not limited to critical path)
  const totalTasksCount = tasks.length;
  const totalTasksCompleted = tasks.filter(t => t.status === 'completed').length;
  const allTasksPercent = totalTasksCount === 0
    ? 0
    : Math.round((totalTasksCompleted / totalTasksCount) * 100);

  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  let overallStatus: 'on_track' | 'at_risk' | 'blocked' = 'on_track';
  if (blockedTasks.length > 0) {
    overallStatus = 'blocked';
  } else if (overdueCount > 0) {
    overallStatus = 'at_risk';
  }

  return {
    project,
    progressPercent,
    criticalTasksCompleted,
    criticalTasksTotal,
    nextCriticalTask,
    overdueCriticalTasksCount: overdueCount,
    dueSoonCriticalTasksCount: dueSoonCount,
    criticalTasks,
    nonCriticalTasks,
    totalPendingPayment,
    phaseOverviews,
    totalTasksCount,
    totalTasksCompleted,
    allTasksPercent,
    overallStatus,
    blockedTasks,
  };
}

export function useProjectsOverview() {
  return useQuery({
    queryKey: queryKeys.projectsOverview(),
    queryFn: async (): Promise<ProjectOverview[]> => {
      const projectRepo = container.resolve<ProjectRepository>('ProjectRepository');
      const taskRepo = container.resolve<TaskRepository>('TaskRepository');
      const paymentRepo = container.resolve<PaymentRepository>('PaymentRepository');
      
      const [projectsResult, allTasks, allPayments] = await Promise.all([
        projectRepo.list(),
        taskRepo.findAll(),
        paymentRepo.findAll(),
      ]);

      const overviews = projectsResult.items.map(p => toOverview(p, allTasks, allPayments));

      // Projects sorted by urgency (overdue critical tasks > due soon > on schedule)
      overviews.sort((a, b) => {
        if (a.overdueCriticalTasksCount !== b.overdueCriticalTasksCount) {
          return b.overdueCriticalTasksCount - a.overdueCriticalTasksCount;
        }
        if (a.dueSoonCriticalTasksCount !== b.dueSoonCriticalTasksCount) {
          return b.dueSoonCriticalTasksCount - a.dueSoonCriticalTasksCount;
        }
        // Then by progress (least progress first)
        return a.progressPercent - b.progressPercent;
      });

      return overviews;
    }
  });
}