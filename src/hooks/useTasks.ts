import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task } from '../domain/entities/Task';
import { DelayReason } from '../domain/entities/DelayReason';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { DelayReasonTypeRepository } from '../domain/repositories/DelayReasonTypeRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { CreateTaskUseCase } from '../application/usecases/task/CreateTaskUseCase';
import { UpdateTaskUseCase } from '../application/usecases/task/UpdateTaskUseCase';
import { DeleteTaskUseCase } from '../application/usecases/task/DeleteTaskUseCase';
import { GetTaskUseCase } from '../application/usecases/task/GetTaskUseCase';
import { ListTasksUseCase } from '../application/usecases/task/ListTasksUseCase';
import { GetTaskDetailUseCase, TaskDetail } from '../application/usecases/task/GetTaskDetailUseCase';
import { AddTaskDependencyUseCase } from '../application/usecases/task/AddTaskDependencyUseCase';
import { RemoveTaskDependencyUseCase } from '../application/usecases/task/RemoveTaskDependencyUseCase';
import { AddDelayReasonUseCase, AddDelayReasonInput } from '../application/usecases/task/AddDelayReasonUseCase';
import { AddProgressLogUseCase, AddProgressLogInput } from '../application/usecases/task/AddProgressLogUseCase';
import { UpdateProgressLogUseCase, UpdateProgressLogInput } from '../application/usecases/task/UpdateProgressLogUseCase';
import { DeleteProgressLogUseCase } from '../application/usecases/task/DeleteProgressLogUseCase';
import { ProgressLog } from '../domain/entities/ProgressLog';
import { RemoveDelayReasonUseCase } from '../application/usecases/task/RemoveDelayReasonUseCase';
import { ResolveDelayReasonUseCase } from '../application/usecases/task/ResolveDelayReasonUseCase';

import { queryKeys, invalidations } from './queryKeys';

export type { TaskDetail } from '../application/usecases/task/GetTaskDetailUseCase';
export type { AddDelayReasonInput } from '../application/usecases/task/AddDelayReasonUseCase';
export type { UpdateProgressLogInput } from '../application/usecases/task/UpdateProgressLogUseCase';

export interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  refreshTasks: () => Promise<void>;
  createTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task | null>;
  // Task detail extensions
  getTaskDetail: (id: string) => Promise<TaskDetail | null>;
  addDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  removeDependency: (taskId: string, dependsOnTaskId: string) => Promise<void>;
  addDelayReason: (taskId: string, input: Omit<AddDelayReasonInput, 'taskId'>) => Promise<DelayReason>;
  removeDelayReason: (taskId: string, delayReasonId: string) => Promise<void>;
  addProgressLog: (taskId: string, input: Omit<AddProgressLogInput, 'taskId'>) => Promise<ProgressLog>;
  updateProgressLog: (taskId: string, logId: string, patch: Omit<UpdateProgressLogInput, 'logId'>) => Promise<ProgressLog>;
  deleteProgressLog: (taskId: string, logId: string) => Promise<void>;
  resolveDelayReason: (taskId: string, delayReasonId: string, resolvedAt?: string, mitigationNotes?: string) => Promise<void>;
}

export function useTasks(projectId?: string): UseTasksReturn {
  const queryClient = useQueryClient();

  const taskRepository = useMemo(() => container.resolve<TaskRepository>('TaskRepository'), []);
  const delayReasonTypeRepository = useMemo(() => container.resolve<DelayReasonTypeRepository>('DelayReasonTypeRepository'), []);
  
  const createUseCase = useMemo(() => new CreateTaskUseCase(taskRepository), [taskRepository]);
  const updateUseCase = useMemo(() => new UpdateTaskUseCase(taskRepository), [taskRepository]);
  const deleteUseCase = useMemo(() => new DeleteTaskUseCase(taskRepository), [taskRepository]);
  const getUseCase = useMemo(() => new GetTaskUseCase(taskRepository), [taskRepository]);
  const listUseCase = useMemo(() => new ListTasksUseCase(taskRepository), [taskRepository]);
  const getTaskDetailUseCase = useMemo(() => new GetTaskDetailUseCase(taskRepository), [taskRepository]);
  const addDependencyUseCase = useMemo(() => new AddTaskDependencyUseCase(taskRepository), [taskRepository]);
  const removeDependencyUseCase = useMemo(() => new RemoveTaskDependencyUseCase(taskRepository), [taskRepository]);
  const addDelayReasonUseCase = useMemo(() => new AddDelayReasonUseCase(taskRepository, delayReasonTypeRepository), [taskRepository, delayReasonTypeRepository]);
  const addProgressLogUseCase = useMemo(() => new AddProgressLogUseCase(taskRepository), [taskRepository]);
  const updateProgressLogUseCase = useMemo(() => new UpdateProgressLogUseCase(taskRepository), [taskRepository]);
  const deleteProgressLogUseCase = useMemo(() => new DeleteProgressLogUseCase(taskRepository), [taskRepository]);
  const removeDelayReasonUseCase = useMemo(() => new RemoveDelayReasonUseCase(taskRepository), [taskRepository]);
  const resolveDelayReasonUseCase = useMemo(() => new ResolveDelayReasonUseCase(taskRepository), [taskRepository]);

  const tasksQueryKey = queryKeys.tasks(projectId);

  const { data: tasks = [], isLoading: loading, refetch } = useQuery<Task[]>({
    queryKey: tasksQueryKey,
    queryFn: () => projectId ? listUseCase.execute(projectId) : listUseCase.execute(),
    staleTime: 30_000,
  });

  const loadTasks = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateTask = useCallback(async (task: Task) => {
    await updateUseCase.execute(task);
    await Promise.all(
      invalidations.taskEdited({ projectId: task.projectId ?? '', taskId: task.id })
        .map(key => queryClient.invalidateQueries({ queryKey: key }))
    );
  }, [updateUseCase, queryClient]);

  const deleteTask = useCallback(async (id: string) => {
    await deleteUseCase.execute(id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
  }, [deleteUseCase, queryClient, projectId]);

  const createTask = useCallback(async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'>) => {
    await createUseCase.execute(data);
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
  }, [createUseCase, queryClient, projectId]);

  const getTask = useCallback(async (id: string) => {
    return getUseCase.execute(id);
  }, [getUseCase]);

  const getTaskDetail = useCallback(async (id: string): Promise<TaskDetail | null> => {
    return getTaskDetailUseCase.execute(id);
  }, [getTaskDetailUseCase]);

  const addDependency = useCallback(async (taskId: string, dependsOnTaskId: string) => {
    await addDependencyUseCase.execute({ taskId, dependsOnTaskId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
  }, [addDependencyUseCase, queryClient, projectId]);

  const removeDependency = useCallback(async (taskId: string, dependsOnTaskId: string) => {
    await removeDependencyUseCase.execute({ taskId, dependsOnTaskId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
  }, [removeDependencyUseCase, queryClient, projectId]);

  const addDelayReason = useCallback(async (taskId: string, input: Omit<AddDelayReasonInput, 'taskId'>): Promise<DelayReason> => {
    const result = await addDelayReasonUseCase.execute({ taskId, ...input });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    return result;
  }, [addDelayReasonUseCase, queryClient, projectId]);

  const addProgressLog = useCallback(async (taskId: string, input: Omit<AddProgressLogInput, 'taskId'>) => {
    const res = await addProgressLogUseCase.execute({ taskId, ...input });
    await Promise.all(
      invalidations.progressLogMutated({ taskId })
        .map(key => queryClient.invalidateQueries({ queryKey: key }))
    );
    return res;
  }, [addProgressLogUseCase, queryClient]);

  const updateProgressLog = useCallback(async (taskId: string, logId: string, patch: Omit<UpdateProgressLogInput, 'logId'>) => {
    const result = await updateProgressLogUseCase.execute({ logId, ...patch });
    await Promise.all(
      invalidations.progressLogMutated({ taskId })
        .map(key => queryClient.invalidateQueries({ queryKey: key }))
    );
    return result;
  }, [updateProgressLogUseCase, queryClient]);

  const deleteProgressLog = useCallback(async (taskId: string, logId: string) => {
    await deleteProgressLogUseCase.execute({ logId });
    await Promise.all(
      invalidations.progressLogMutated({ taskId })
        .map(key => queryClient.invalidateQueries({ queryKey: key }))
    );
  }, [deleteProgressLogUseCase, queryClient]);

  const removeDelayReason = useCallback(async (taskId: string, delayReasonId: string) => {
    await removeDelayReasonUseCase.execute({ delayReasonId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.taskDetail(taskId) });
  }, [removeDelayReasonUseCase, queryClient, projectId]);

  const resolveDelayReason = useCallback(async (taskId: string, delayReasonId: string, resolvedAt?: string, mitigationNotes?: string) => {
    await resolveDelayReasonUseCase.execute({ delayReasonId, resolvedAt, mitigationNotes });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.taskDetail(taskId) });
  }, [resolveDelayReasonUseCase, queryClient, projectId]);

  return useMemo(() => ({
    tasks,
    loading,
    refreshTasks: loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTask,
    getTaskDetail,
    addDependency,
    removeDependency,
    addDelayReason,
    removeDelayReason,
    resolveDelayReason,
    addProgressLog,
    updateProgressLog,
    deleteProgressLog,
  }), [tasks, loading, loadTasks, createTask, updateTask, deleteTask, getTask, getTaskDetail, addDependency, removeDependency, addDelayReason, removeDelayReason, resolveDelayReason, addProgressLog, updateProgressLog, deleteProgressLog]);
}
