/**
 * Central query key registry and invalidation map.
 *
 * Single source of truth for:
 *  1. Query key factories  — import `queryKeys` to build cache keys.
 *  2. Invalidation map     — import `invalidations` to know which keys to
 *                            bust after each mutation.
 *
 * Maintenance rule
 * ─────────────────
 * • NEVER write raw string-array keys in hook code — always use these factories.
 * • If you add a new query, add its factory to `queryKeys` below.
 * • Then scan `invalidations` and add the new key to every entry that should
 *   cascade to it.  The compiler will not catch omissions, so the JSDoc on
 *   each entry is the human-readable dependency graph.
 *
 * Usage in a hook
 * ───────────────
 * ```ts
 * import { invalidations } from './queryKeys';
 *
 * const queryClient = useQueryClient();
 * await myUseCase.execute(...);
 * await Promise.all(
 *   invalidations.taskEdited({ projectId, taskId })
 *     .map(key => queryClient.invalidateQueries({ queryKey: key }))
 * );
 * ```
 */

// ─── Key factories ────────────────────────────────────────────────────────────

export const queryKeys = {
  /** All payments (use for global invalidations) */
  paymentsAll: () => ['payments'] as const,

  /** Scoped payment cache (used by usePayments internally) */
  payments: (mode: 'firefighter' | 'site_manager', param: string) =>
    ['payments', mode, param] as const,

  /** Invoice list — scoped to projectId when provided */
  invoices: (projectId?: string) =>
    (projectId ? ['invoices', projectId] : ['invoices']) as readonly string[],

  /** Quotation list — scoped to taskId when provided */
  quotations: (taskId?: string) =>
    (taskId ? ['quotations', taskId] : ['quotations']) as readonly string[],

  /** Task list — scoped to projectId when provided */
  tasks: (projectId?: string) =>
    (projectId ? ['tasks', projectId] : ['tasks']) as readonly string[],

  /** Single enriched task detail */
  taskDetail: (taskId: string) => ['taskDetail', taskId] as const,

  /** Progress logs for a task */
  progressLogs: (taskId: string) => ['progressLogs', taskId] as const,

  /** Documents attached to a task */
  documents: (taskId: string) => ['documents', taskId] as const,

  /** Contact / subcontractor list */
  contacts: () => ['contacts'] as const,

  /** Hydrated project detail (ProjectDetails — includes owner Contact) */
  projectDetail: (projectId: string) => ['projectDetail', projectId] as const,

  /** Quotation list — scoped to a project (used by useQuotationTimeline) */
  quotationsByProject: (projectId: string) =>
    ['quotationsByProject', projectId] as const,
};

// ─── Context types for the invalidation map ───────────────────────────────────

export type AcceptQuotationCtx = { projectId: string; taskId: string };
export type RejectQuotationCtx = { projectId: string; taskId: string };
export type InvoiceCtx = { projectId?: string; taskId?: string };
export type PaymentCtx = { projectId?: string };
export type ProgressLogCtx = { taskId: string };
export type DocumentCtx = { taskId: string };
export type TaskEditCtx = {
  projectId: string;
  taskId: string;
  /** Pass true when a payment-linked field changes (e.g. subcontractor reassignment) */
  affectsPayments?: boolean;
};
export type ContactCtx = Record<string, never>;
export type QuotationProjectCtx = { projectId: string };

// ─── Invalidation map ─────────────────────────────────────────────────────────

export const invalidations = {
  /**
   * Accept quotation → creates Invoice, updates Task.quoteStatus to 'accepted'.
   * Affects: payment totals, invoice list, task status badge, quote status badge.
   */
  acceptQuotation: (ctx: AcceptQuotationCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],

  /**
   * Reject quotation → updates Task.quoteStatus to 'rejected'.
   * Does NOT affect payments or invoices — no financial change occurs.
   */
  rejectQuotation: (ctx: RejectQuotationCtx) => [
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],

  /**
   * Create / update / delete an invoice.
   * Affects: payment totals/list, invoice list (and task detail if task-linked).
   */
  invoiceMutated: (ctx: InvoiceCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    ...(ctx.taskId ? [queryKeys.taskDetail(ctx.taskId)] : []),
  ],

  /**
   * Record a payment or mark a payment as paid.
   * Affects: payment list/amounts, invoice payment status.
   */
  paymentRecorded: (ctx: PaymentCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
  ],

  /**
   * Add, update, or remove a progress log entry.
   * Affects: progress log list for the task, task detail metadata.
   */
  progressLogMutated: (ctx: ProgressLogCtx) => [
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],

  /**
   * Upload or remove a document/image attached to a task (via a progress log).
   * Affects: document list, progress log list (thumbnail/count), task detail.
   */
  documentMutated: (ctx: DocumentCtx) => [
    queryKeys.documents(ctx.taskId),
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],

  /**
   * Edit task fields (status, trade type, subcontractor, etc.).
   * Pass affectsPayments=true when a payment-linked field changes
   * (e.g. subcontractor reassignment on a task with an active invoice).
   */
  taskEdited: (ctx: TaskEditCtx) => [
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    ...(ctx.affectsPayments ? [queryKeys.paymentsAll()] : []),
  ],

  /**
   * Add or update a contact/subcontractor.
   * Affects: contact picker, invoice issuer display (broad invalidation).
   */
  contactMutated: (_ctx: ContactCtx) => [
    queryKeys.contacts(),
    queryKeys.invoices(), // issuer name may appear on any project's invoice
  ],

  /**
   * A quotation was created / updated / accepted / declined at the project level.
   * Affects: project-scoped quotation timeline, project detail totals.
   * Also used by acceptStandaloneQuotation (which additionally busts paymentsAll + invoices).
   */
  quotationProjectMutated: (ctx: QuotationProjectCtx) => [
    queryKeys.quotationsByProject(ctx.projectId),
    queryKeys.projectDetail(ctx.projectId),
  ],
};
