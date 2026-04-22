/**
 * Integration tests for Task Form round-trips (Issue #114).
 *
 * These tests exercise the use-case layer directly against in-memory
 * repository implementations to verify create/update persistence
 * of the new fields: documents, subcontractor, and dependencies.
 */
import { CreateTaskUseCase } from '../../src/application/usecases/task/CreateTaskUseCase';
import { UpdateTaskUseCase } from '../../src/application/usecases/task/UpdateTaskUseCase';
import { AddTaskDocumentUseCase } from '../../src/application/usecases/document/AddTaskDocumentUseCase';
import { RemoveTaskDocumentUseCase } from '../../src/application/usecases/document/RemoveTaskDocumentUseCase';
import { AddTaskDependencyUseCase } from '../../src/application/usecases/task/AddTaskDependencyUseCase';
import { RemoveTaskDependencyUseCase } from '../../src/application/usecases/task/RemoveTaskDependencyUseCase';

import { Task } from '../../src/domain/entities/Task';
import { Document } from '../../src/domain/entities/Document';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { DocumentRepository } from '../../src/domain/repositories/DocumentRepository';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import { DelayReason } from '../../src/domain/entities/DelayReason';

// ── In-memory TaskRepository ──────────────────────────────────────────────────

class InMemoryTaskRepository implements TaskRepository {
  private tasks: Map<string, Task> = new Map();
  private deps: { taskId: string; dependsOnTaskId: string }[] = [];
  private delays: DelayReason[] = [];
  private progressLogs: any[] = [];

  async save(task: Task): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async findById(id: string): Promise<Task | null> { return this.tasks.get(id) ?? null; }
  async findAll(): Promise<Task[]> { return [...this.tasks.values()]; }
  async findByProjectId(pid: string): Promise<Task[]> { return [...this.tasks.values()].filter(t => t.projectId === pid); }
  async findAdHoc(): Promise<Task[]> { return [...this.tasks.values()].filter(t => !t.projectId); }
  async findUpcoming(): Promise<Task[]> { return []; }
  async update(task: Task): Promise<void> { this.tasks.set(task.id, { ...task }); }
  async delete(id: string): Promise<void> { this.tasks.delete(id); }

  async addDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    const exists = this.deps.some(d => d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId);
    if (!exists) this.deps.push({ taskId, dependsOnTaskId });
  }
  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    this.deps = this.deps.filter(d => !(d.taskId === taskId && d.dependsOnTaskId === dependsOnTaskId));
  }
  async findDependencies(taskId: string): Promise<Task[]> {
    const ids = this.deps.filter(d => d.taskId === taskId).map(d => d.dependsOnTaskId);
    return ids.map(id => this.tasks.get(id)).filter(Boolean) as Task[];
  }
  async findDependents(dependsOnTaskId: string): Promise<Task[]> {
    const ids = this.deps.filter(d => d.dependsOnTaskId === dependsOnTaskId).map(d => d.taskId);
    return ids.map(id => this.tasks.get(id)).filter(Boolean) as Task[];
  }
  async addDelayReason(entry: Omit<DelayReason, 'id' | 'createdAt'>): Promise<DelayReason> {
    const dr: DelayReason = { ...entry, id: `dr_${Date.now()}`, createdAt: new Date().toISOString() };
    this.delays.push(dr);
    return dr;
  }
  async removeDelayReason(id: string): Promise<void> { this.delays = this.delays.filter(d => d.id !== id); }
  async resolveDelayReason(): Promise<void> {}
  async findProgressLogs(taskId: string): Promise<any[]> { return this.progressLogs.filter(l => l.taskId === taskId); }
  async addProgressLog(log: any): Promise<any> { const pl = { ...log, id: `pl_1`, createdAt: Date.now() }; this.progressLogs.push(pl); return pl; }
  async updateProgressLog(logId: string, patch: any): Promise<any> { const idx = this.progressLogs.findIndex((l: any) => l.id === logId); if (idx !== -1) this.progressLogs[idx] = { ...this.progressLogs[idx], ...patch }; return this.progressLogs[idx]; }
  async deleteProgressLog(logId: string): Promise<void> { this.progressLogs = this.progressLogs.filter((l: any) => l.id !== logId); }
  async findDelayReasons(taskId: string): Promise<DelayReason[]> { return this.delays.filter(d => d.taskId === taskId); }
  async summarizeDelayReasons(): Promise<{ reasonTypeId: string; count: number }[]> { return []; }
  async deleteDependenciesByTaskId(taskId: string): Promise<void> { this.deps = this.deps.filter(d => d.taskId !== taskId && d.dependsOnTaskId !== taskId); }
  async deleteDelayReasonsByTaskId(taskId: string): Promise<void> { this.delays = this.delays.filter(d => d.taskId !== taskId); }
  async findAllDependencies(projectId: string): Promise<{ taskId: string; dependsOnTaskId: string }[]> {
    const projectTaskIds = new Set([...this.tasks.values()].filter(t => t.projectId === projectId).map(t => t.id));
    return this.deps.filter(d => projectTaskIds.has(d.taskId));
  }
}

// ── In-memory DocumentRepository ─────────────────────────────────────────────

class InMemoryDocumentRepository implements DocumentRepository {
  private docs: Map<string, Document> = new Map();

  async save(doc: Document): Promise<void> { this.docs.set(doc.id, { ...doc }); }
  async findById(id: string): Promise<Document | null> { return this.docs.get(id) ?? null; }
  async findAll(): Promise<Document[]> { return [...this.docs.values()]; }
  async findByProjectId(pid: string): Promise<Document[]> { return [...this.docs.values()].filter(d => d.projectId === pid); }
  async findByTaskId(taskId: string): Promise<Document[]> { return [...this.docs.values()].filter(d => d.taskId === taskId); }
  async update(doc: Document): Promise<void> { this.docs.set(doc.id, { ...doc }); }
  async delete(id: string): Promise<void> { this.docs.delete(id); }
  async assignProject(docId: string, projectId: string): Promise<void> {
    const d = this.docs.get(docId);
    if (d) this.docs.set(docId, { ...d, projectId });
  }
}

// ── Mock file system ──────────────────────────────────────────────────────────

const mockFs: IFileSystemAdapter = {
  copyToAppStorage: jest.fn((src: string, name: string) =>
    Promise.resolve(`/app/storage/${name}`),
  ),
  getDocumentsDirectory: jest.fn(() => Promise.resolve('/app/storage')),
  exists: jest.fn(() => Promise.resolve(true)),
  deleteFile: jest.fn(() => Promise.resolve()),
};

// ── Shared use-case factory ───────────────────────────────────────────────────

function setup() {
  const taskRepo = new InMemoryTaskRepository();
  const docRepo = new InMemoryDocumentRepository();
  return {
    taskRepo,
    docRepo,
    createTask: new CreateTaskUseCase(taskRepo),
    updateTask: new UpdateTaskUseCase(taskRepo),
    addDoc: new AddTaskDocumentUseCase(docRepo, mockFs),
    removeDoc: new RemoveTaskDocumentUseCase(docRepo, mockFs),
    addDep: new AddTaskDependencyUseCase(taskRepo),
    removeDep: new RemoveTaskDependencyUseCase(taskRepo),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Task Form round-trip: documents (Issue #114)', () => {
  it('create task → attach document → document is found by taskId', async () => {
    const { docRepo, createTask, addDoc } = setup();

    const task = await createTask.execute({ title: 'Install windows', status: 'pending' });

    await addDoc.execute({
      taskId: task.id,
      sourceUri: 'file:///tmp/plan.pdf',
      filename: 'plan.pdf',
      mimeType: 'application/pdf',
      size: 5000,
    });

    const docs = await docRepo.findByTaskId(task.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].filename).toBe('plan.pdf');
    expect(docs[0].taskId).toBe(task.id);
    expect(docs[0].status).toBe('local-only');
  });

  it('attach two docs → remove one → only one remains', async () => {
    const { docRepo, createTask, addDoc, removeDoc } = setup();

    const task = await createTask.execute({ title: 'Roofing', status: 'pending' });

    const doc1 = await addDoc.execute({ taskId: task.id, sourceUri: 'file:///a.pdf', filename: 'a.pdf' });
    await addDoc.execute({ taskId: task.id, sourceUri: 'file:///b.pdf', filename: 'b.pdf' });

    await removeDoc.execute(doc1.id);

    const docs = await docRepo.findByTaskId(task.id);
    expect(docs).toHaveLength(1);
    expect(docs[0].filename).toBe('b.pdf');
    expect(mockFs.deleteFile).toHaveBeenCalledWith('/app/storage/a.pdf');
  });
});

describe('Task Form round-trip: dependencies (Issue #114)', () => {
  it('create task with dependency → findDependencies returns dep task', async () => {
    const { taskRepo, createTask, addDep } = setup();

    const depTask = await createTask.execute({ title: 'Excavation', status: 'completed' });
    const mainTask = await createTask.execute({ title: 'Foundation', status: 'pending' });

    await addDep.execute({ taskId: mainTask.id, dependsOnTaskId: depTask.id });

    const deps = await taskRepo.findDependencies(mainTask.id);
    expect(deps).toHaveLength(1);
    expect(deps[0].id).toBe(depTask.id);
  });

  it('remove dependency → no longer appears in findDependencies', async () => {
    const { taskRepo, createTask, addDep, removeDep } = setup();

    const depTask = await createTask.execute({ title: 'Prep', status: 'completed' });
    const mainTask = await createTask.execute({ title: 'Frame', status: 'pending' });

    await addDep.execute({ taskId: mainTask.id, dependsOnTaskId: depTask.id });
    await removeDep.execute({ taskId: mainTask.id, dependsOnTaskId: depTask.id });

    const deps = await taskRepo.findDependencies(mainTask.id);
    expect(deps).toHaveLength(0);
  });
});

describe('Task Form round-trip: subcontractor (Issue #114)', () => {
  it('create task with subcontractorId → findById returns correct subcontractorId', async () => {
    const { taskRepo, createTask } = setup();

    const task = await createTask.execute({
      title: 'Electrical fit-out',
      status: 'pending',
      subcontractorId: 'contact-elec-1',
    });

    const found = await taskRepo.findById(task.id);
    expect(found?.subcontractorId).toBe('contact-elec-1');
  });

  it('update task subcontractorId → findById reflects the change', async () => {
    const { taskRepo, createTask, updateTask } = setup();

    const task = await createTask.execute({ title: 'Plumbing', status: 'pending', subcontractorId: 'plumber-1' });
    await updateTask.execute({ taskId: task.id, updates: { subcontractorId: 'plumber-2' } });

    const updated = await taskRepo.findById(task.id);
    expect(updated?.subcontractorId).toBe('plumber-2');
  });

  it('update task: clear subcontractorId', async () => {
    const { taskRepo, createTask, updateTask } = setup();

    const task = await createTask.execute({ title: 'Tiling', status: 'pending', subcontractorId: 'tiler-1' });
    await updateTask.execute({ taskId: task.id, updates: { subcontractorId: undefined } });

    const updated = await taskRepo.findById(task.id);
    expect(updated?.subcontractorId).toBeUndefined();
  });
});
