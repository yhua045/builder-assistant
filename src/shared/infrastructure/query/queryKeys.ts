/**
 * Central query key registry and invalidation map.
 *
 * Single source of truth for:
 *  1. Query key factories  — import `queryKeys` to build cache keys.
 *  2. Invalidation map     — import `invalidations` to know which keys to
 *                            bust after each mutation.
 */

export const queryKeys = {
  projects: () => ['projects'] as const,
  projectsOverview: () => ['projectsOverview'] as const,
  paymentsAll: () => ['payments'] as const,
  payments: (mode: 'firefighter' | 'site_manager', param: string) =>
    ['payments', mode, param] as const,
  invoices: (projectId?: string) =>
    (projectId ? ['invoices', projectId] : ['invoices']) as readonly string[],
  quotations: (taskId?: string) =>
    (taskId ? ['quotations', taskId] : ['quotations']) as readonly string[],
  tasks: (projectId?: string) =>
    (projectId ? ['tasks', projectId] : ['tasks']) as readonly string[],
  taskDetail: (taskId: string) => ['taskDetail', taskId] as const,
  progressLogs: (taskId: string) => ['progressLogs', taskId] as const,
  documents: (taskId: string) => ['documents', taskId] as const,
  contacts: () => ['contacts'] as const,
  projectDetail: (projectId: string) => ['projectDetail', projectId] as const,
  quotationsByProject: (projectId: string) => ['quotationsByProject', projectId] as const,
  projectPayments: (projectId: string) => ['projectPayments', projectId] as const,
  projectQuotations: (projectId: string) => ['projectQuotations', projectId] as const,
  auditLogsByProject: (projectId: string) => ['auditLogs', 'project', projectId] as const,
  auditLogsByTask: (taskId: string) => ['auditLogs', 'task', taskId] as const,
  globalQuotations: () => ['quotations', 'global'] as const,
  paidPaymentsGlobal: (contractorSearch?: string) =>
    (contractorSearch
      ? ['payments', 'paid', contractorSearch]
      : ['payments', 'paid']) as readonly string[],
  unassignedPaymentsGlobal: (contractorSearch?: string) =>
    (contractorSearch
      ? ['payments', 'unassigned', contractorSearch]
      : ['payments', 'unassigned']) as readonly string[],
};

export type AcceptQuotationCtx = { projectId: string; taskId: string };
export type RejectQuotationCtx = { projectId: string; taskId: string };
export type InvoiceCtx = { projectId?: string; taskId?: string };
export type PaymentCtx = { projectId?: string };
export type ProgressLogCtx = { taskId: string };
export type DocumentCtx = { taskId: string };
export type TaskEditCtx = {
  projectId: string;
  taskId: string;
  affectsPayments?: boolean;
};
export type ContactCtx = Record<string, never>;
export type QuotationProjectCtx = { projectId: string };
export type AuditLogCtx = { projectId: string; taskId?: string };
export type TasksCreatedCtx = { projectId: string };
export type ProjectEditedCtx = { projectId: string };
export type PaymentProjectAssignmentCtx = {
  oldProjectId?: string | null;
  newProjectId?: string;
  isInvoice?: boolean;
};
export type ProjectCreatedCtx = Record<string, never>;

export const invalidations = {
  acceptQuotation: (ctx: AcceptQuotationCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],
  rejectQuotation: (ctx: RejectQuotationCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],
  invoiceMutated: (ctx: InvoiceCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    ...(ctx.taskId ? [queryKeys.taskDetail(ctx.taskId)] : []),
  ],
  paymentRecorded: (ctx: PaymentCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    ...(ctx.projectId ? [queryKeys.projectPayments(ctx.projectId)] : []),
  ],
  progressLogMutated: (ctx: ProgressLogCtx) => [
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],
  documentMutated: (ctx: DocumentCtx) => [
    queryKeys.documents(ctx.taskId),
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],
  taskEdited: (ctx: TaskEditCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    ...(ctx.affectsPayments ? [queryKeys.paymentsAll()] : []),
  ],
  contactMutated: (_ctx: ContactCtx) => [
    queryKeys.contacts(),
    queryKeys.invoices(),
  ],
  quotationProjectMutated: (ctx: QuotationProjectCtx) => [
    queryKeys.quotationsByProject(ctx.projectId),
    queryKeys.projectQuotations(ctx.projectId),
    queryKeys.projectsOverview(),
  ],
  auditLogWritten: (ctx: AuditLogCtx) => [
    queryKeys.auditLogsByProject(ctx.projectId),
    ...(ctx.taskId ? [queryKeys.auditLogsByTask(ctx.taskId)] : []),
    queryKeys.taskDetail(ctx.taskId ?? ''),
  ],
  tasksCreated: (ctx: TasksCreatedCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.tasks(ctx.projectId),
  ],
  projectEdited: (ctx: ProjectEditedCtx) => [
    queryKeys.projectsOverview(),
    queryKeys.projectDetail(ctx.projectId),
    queryKeys.projects(),
  ],
  projectCreated: (_ctx: ProjectCreatedCtx = {}) => [
    queryKeys.projectsOverview(),
    queryKeys.projects(),
  ],
  paymentProjectAssigned: (ctx: PaymentProjectAssignmentCtx) => {
    const keys = [
      queryKeys.projectsOverview(),
      queryKeys.paymentsAll(),
    ] as const;

    return [
      ...keys,
      ...(ctx.oldProjectId ? [queryKeys.projectDetail(ctx.oldProjectId)] : []),
      ...(ctx.newProjectId ? [queryKeys.projectDetail(ctx.newProjectId)] : []),
      ...(ctx.oldProjectId ? [queryKeys.projectPayments(ctx.oldProjectId)] : []),
      ...(ctx.newProjectId ? [queryKeys.projectPayments(ctx.newProjectId)] : []),
    ];
  },
};
