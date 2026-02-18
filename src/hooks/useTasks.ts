import { useState, useEffect, useCallback, useMemo } from 'react';
import { Task } from '../domain/entities/Task';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { CreateTaskUseCase } from '../application/usecases/task/CreateTaskUseCase';
import { UpdateTaskUseCase } from '../application/usecases/task/UpdateTaskUseCase';
import { DeleteTaskUseCase } from '../application/usecases/task/DeleteTaskUseCase';
import { GetTaskUseCase } from '../application/usecases/task/GetTaskUseCase';
import { ListTasksUseCase } from '../application/usecases/task/ListTasksUseCase';

export interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  refreshTasks: () => Promise<void>;
  createTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'>) => Promise<void>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTask: (id: string) => Promise<Task | null>;
}

export function useTasks(projectId?: string): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const taskRepository = useMemo(() => container.resolve<TaskRepository>('TaskRepository'), []);
  
  const createUseCase = useMemo(() => new CreateTaskUseCase(taskRepository), [taskRepository]);
  const updateUseCase = useMemo(() => new UpdateTaskUseCase(taskRepository), [taskRepository]);
  const deleteUseCase = useMemo(() => new DeleteTaskUseCase(taskRepository), [taskRepository]);
  const getUseCase = useMemo(() => new GetTaskUseCase(taskRepository), [taskRepository]);
  const listUseCase = useMemo(() => new ListTasksUseCase(taskRepository), [taskRepository]);

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

  const createTask = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'>) => {
    await createUseCase.execute(data);
    await loadTasks();
  };

  const updateTask = async (task: Task) => {
    await updateUseCase.execute(task);
    await loadTasks();
  };

  const deleteTask = async (id: string) => {
    await deleteUseCase.execute(id);
    await loadTasks();
  };

  const getTask = async (id: string) => {
    return getUseCase.execute(id);
  };

  return {
    tasks,
    loading,
    refreshTasks: loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTask,
  };
}
