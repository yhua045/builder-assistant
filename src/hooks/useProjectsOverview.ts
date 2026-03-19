import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { queryKeys } from './queryKeys';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { Task } from '../domain/entities/Task';
import { Project } from '../domain/entities/Project';
import { Payment } from '../domain/entities/Payment';

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