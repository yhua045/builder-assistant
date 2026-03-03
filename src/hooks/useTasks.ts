import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { RemoveDelayReasonUseCase } from '../application/usecases/task/RemoveDelayReasonUseCase';

export type { TaskDetail } from '../application/usecases/task/GetTaskDetailUseCase';
export type { AddDelayReasonInput } from '../application/usecases/task/AddDelayReasonUseCase';

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
  removeDelayReason: (delayReasonId: string) => Promise<void>;
}

export function useTasks(projectId?: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

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
  const removeDelayReasonUseCase = useMemo(() => new RemoveDelayReasonUseCase(taskRepository), [taskRepository]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let result: Task[];
      if (projectId) {
        result = await listUseCase.execute(projectId);
      } else {
        // If no project ID, assume we want all tasks or maybe ad-hoc? 
        // For now list all tasks if no project ID is provided, 
        // or specifically use listUseCase.execute() which calls findAll() or findByProjectId
        // The implementation calls findAll() if no projectId provided.
        // Wait, listUseCase implementation: if(projectId) findByProjectId else findAll.
        // But maybe we want ad-hoc tasks specifically?
        // Let's stick to findAll for now to listed everything in main view.
        result = await listUseCase.execute();
      }
      setTasks(result);
    } catch (error) {
      console.error('Failed to load tasks', error);
    } finally {
      setLoading(false);
    }
  }, [listUseCase, projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const updateTask = useCallback(async (task: Task) => {
    await updateUseCase.execute(task);
    await loadTasks();
  }, [updateUseCase, loadTasks]);

  const deleteTask = useCallback(async (id: string) => {
    await deleteUseCase.execute(id);
    await loadTasks();
  }, [deleteUseCase, loadTasks]);

  const createTask = useCallback(async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'>) => {
    await createUseCase.execute(data);
    await loadTasks();
  }, [createUseCase, loadTasks]);

  const getTask = useCallback(async (id: string) => {
    return getUseCase.execute(id);
  }, [getUseCase]);

  const getTaskDetail = useCallback(async (id: string): Promise<TaskDetail | null> => {
    return getTaskDetailUseCase.execute(id);
  }, [getTaskDetailUseCase]);

  const addDependency = useCallback(async (taskId: string, dependsOnTaskId: string) => {
    await addDependencyUseCase.execute({ taskId, dependsOnTaskId });
  }, [addDependencyUseCase]);

  const removeDependency = useCallback(async (taskId: string, dependsOnTaskId: string) => {
    await removeDependencyUseCase.execute({ taskId, dependsOnTaskId });
  }, [removeDependencyUseCase]);

  const addDelayReason = useCallback(async (taskId: string, input: Omit<AddDelayReasonInput, 'taskId'>): Promise<DelayReason> => {
    return addDelayReasonUseCase.execute({ taskId, ...input });
  }, [addDelayReasonUseCase]);

  const removeDelayReason = useCallback(async (delayReasonId: string) => {
    await removeDelayReasonUseCase.execute({ delayReasonId });
  }, [removeDelayReasonUseCase]);

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
  }), [tasks, loading, loadTasks, createTask, updateTask, deleteTask, getTask, getTaskDetail, addDependency, removeDependency, addDelayReason, removeDelayReason]);
}
