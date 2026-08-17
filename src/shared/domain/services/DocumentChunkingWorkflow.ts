import { assign, createActor, createMachine } from 'xstate';

export type DocumentChunkingWorkflowStateValue =
  | 'idle'
  | 'document_received'
  | 'validation_pending'
  | 'text_extracted'
  | 'chunking_in_progress'
  | 'chunking_complete'
  | 'persisting_chunks'
  | 'completed'
  | 'failed'
  | 'superseded';

export interface DocumentChunkingWorkflowContext {
  documentId?: string;
  documentVersion?: number;
  projectId?: string;
  checkpointId?: string;
  resumeFromCheckpoint?: boolean;
  supportedForAnalysis?: boolean;
  validationReason?: string;
  isAlreadyAnalyzed?: boolean;
  lastEvent?: string;
  error?: string;
  retryCount: number;
  circuitOpen: boolean;
}

export type DocumentChunkingEvent =
  | {
      type: 'DOCUMENT_RECEIVED';
      documentId: string;
      documentVersion?: number;
      projectId?: string;
      checkpointId?: string;
      resumeFromCheckpoint?: boolean;
    }
  | {
      type: 'VALIDATION_SUCCEEDED';
      supportedForAnalysis?: boolean;
      validationReason?: string;
    }
  | { type: 'TEXT_EXTRACTED' }
  | { type: 'CHUNKING_STARTED' }
  | { type: 'CHUNKING_COMPLETED' }
  | { type: 'PERSISTING_CHUNKS' }
  | { type: 'COMPLETED' }
  | { type: 'ALREADY_ANALYZED' }
  | { type: 'FAILED'; error?: string; supportedForAnalysis?: boolean; validationReason?: string }
  | { type: 'SUPERSEDED' }
  | { type: 'RETRY_REQUESTED' }
  | { type: 'CIRCUIT_OPENED'; reason?: string }
  | { type: 'RESET' };

export interface DocumentChunkingWorkflowState {
  value: DocumentChunkingWorkflowStateValue;
  context: DocumentChunkingWorkflowContext;
  done: boolean;
}

export interface DocumentChunkingWorkflowInstance {
  state: DocumentChunkingWorkflowState;
  send(event: DocumentChunkingEvent): DocumentChunkingWorkflowState;
  reset(): DocumentChunkingWorkflowState;
}

export const DOCUMENT_CHUNKING_WORKFLOW: DocumentChunkingWorkflowStateValue[] = [
  'idle',
  'document_received',
  'validation_pending',
  'text_extracted',
  'chunking_in_progress',
  'chunking_complete',
  'persisting_chunks',
  'completed',
  'failed',
  'superseded',
];

const defaultDocumentChunkingContext: DocumentChunkingWorkflowContext = {
  documentId: undefined,
  documentVersion: 1,
  projectId: undefined,
  checkpointId: undefined,
  resumeFromCheckpoint: false,
  supportedForAnalysis: undefined,
  validationReason: undefined,
  isAlreadyAnalyzed: false,
  lastEvent: undefined,
  error: undefined,
  retryCount: 0,
  circuitOpen: false,
};

export const documentChunkingMachine = createMachine({
  id: 'documentChunking',
  initial: 'idle',
  context: defaultDocumentChunkingContext,
  states: {
    idle: {
      on: {
        DOCUMENT_RECEIVED: {
          target: 'document_received',
          actions: assign((context, event) => {
            const ctx = context as any;
            const e = event as any;
            return {
              ...ctx,
              documentId: e.documentId,
              documentVersion: e.documentVersion ?? ctx.documentVersion ?? 1,
              projectId: e.projectId ?? ctx.projectId,
              checkpointId: e.checkpointId ?? ctx.checkpointId,
              resumeFromCheckpoint: e.resumeFromCheckpoint ?? false,
              lastEvent: e.type,
              error: undefined,
              supportedForAnalysis: undefined,
              validationReason: undefined,
              isAlreadyAnalyzed: false,
              retryCount: 0,
              circuitOpen: false,
            };
          }),
        },
      },
    },
    document_received: {
      on: {
        VALIDATION_SUCCEEDED: {
          target: 'validation_pending',
          actions: assign((context, event) => ({
            ...(context as any),
            supportedForAnalysis: (event as any).supportedForAnalysis ?? true,
            validationReason: (event as any).validationReason ?? 'supported_document_type',
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            supportedForAnalysis: false,
            validationReason: (event as any).validationReason ?? (event as any).error ?? 'unsupported_document',
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Document validation failed',
          })),
        },
      },
    },
    validation_pending: {
      on: {
        VALIDATION_SUCCEEDED: {
          target: 'validation_pending',
          actions: assign((context, event) => ({
            ...(context as any),
            supportedForAnalysis: (event as any).supportedForAnalysis ?? true,
            validationReason: (event as any).validationReason ?? 'supported_document_type',
            lastEvent: (event as any).type,
          })),
        },
        ALREADY_ANALYZED: {
          target: 'completed',
          actions: assign((context, event) => ({
            ...(context as any),
            isAlreadyAnalyzed: true,
            supportedForAnalysis: true,
            validationReason: 'already_analyzed',
            lastEvent: (event as any).type,
            error: undefined,
          })),
        },
        TEXT_EXTRACTED: {
          target: 'text_extracted',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            supportedForAnalysis: (event as any).supportedForAnalysis ?? false,
            validationReason: (event as any).validationReason ?? (event as any).error ?? 'unsupported_document',
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Text extraction failed',
          })),
        },
      },
    },
    text_extracted: {
      on: {
        CHUNKING_STARTED: {
          target: 'chunking_in_progress',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Chunking started with invalid state',
          })),
        },
      },
    },
    chunking_in_progress: {
      on: {
        CHUNKING_COMPLETED: {
          target: 'chunking_complete',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        SUPERSEDED: {
          target: 'superseded',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Chunking failed',
          })),
        },
      },
    },
    chunking_complete: {
      on: {
        PERSISTING_CHUNKS: {
          target: 'persisting_chunks',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Persisting chunk set failed',
          })),
        },
      },
    },
    persisting_chunks: {
      on: {
        COMPLETED: {
          target: 'completed',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
        FAILED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
            error: (event as any).error ?? 'Chunk persistence failed',
          })),
        },
        SUPERSEDED: {
          target: 'superseded',
          actions: assign((context, event) => ({
            ...(context as any),
            lastEvent: (event as any).type,
          })),
        },
      },
    },
    completed: {
      type: 'final',
    },
    failed: {
      on: {
        RETRY_REQUESTED: {
          target: 'document_received',
          actions: assign((context, event) => {
            const ctx = context as any;
            const e = event as any;
            return {
              ...ctx,
              retryCount: (ctx.retryCount ?? 0) + 1,
              circuitOpen: (ctx.retryCount ?? 0) + 1 >= 3,
              lastEvent: e.type,
              error: undefined,
            };
          }),
        },
        CIRCUIT_OPENED: {
          target: 'failed',
          actions: assign((context, event) => ({
            ...(context as any),
            circuitOpen: true,
            lastEvent: (event as any).type,
            error: (event as any).reason ?? 'Circuit opened for document chunking',
          })),
        },
        RESET: {
          target: 'idle',
          actions: assign(() => ({
            ...defaultDocumentChunkingContext,
            lastEvent: 'RESET',
          })),
        },
      },
    },
    superseded: {
      type: 'final',
    },
  },
});

export function isTerminalDocumentChunkingState(
  state: DocumentChunkingWorkflowStateValue,
): boolean {
  return state === 'completed' || state === 'failed' || state === 'superseded';
}

export function transitionDocumentChunkingWorkflow(
  currentState: DocumentChunkingWorkflowStateValue,
  event: DocumentChunkingEvent,
  context: Partial<DocumentChunkingWorkflowContext> = {},
): DocumentChunkingWorkflowState {
  const nextContext = { ...defaultDocumentChunkingContext, ...context } as DocumentChunkingWorkflowContext;
  let nextValue = currentState;

  switch (event.type) {
    case 'DOCUMENT_RECEIVED':
      nextContext.documentId = event.documentId;
      nextContext.documentVersion = event.documentVersion ?? nextContext.documentVersion ?? 1;
      nextContext.projectId = event.projectId ?? nextContext.projectId;
      nextContext.checkpointId = event.checkpointId ?? nextContext.checkpointId;
      nextContext.resumeFromCheckpoint = event.resumeFromCheckpoint ?? false;
      nextContext.lastEvent = event.type;
      nextContext.error = undefined;
      nextContext.supportedForAnalysis = undefined;
      nextContext.validationReason = undefined;
      nextContext.isAlreadyAnalyzed = false;
      nextContext.retryCount = 0;
      nextContext.circuitOpen = false;
      nextValue = 'document_received';
      break;
    case 'VALIDATION_SUCCEEDED':
      nextContext.lastEvent = event.type;
      nextContext.supportedForAnalysis = event.supportedForAnalysis ?? true;
      nextContext.validationReason = event.validationReason ?? 'supported_document_type';
      nextValue = currentState === 'document_received' ? 'validation_pending' : currentState;
      break;
    case 'ALREADY_ANALYZED':
      nextContext.lastEvent = event.type;
      nextContext.isAlreadyAnalyzed = true;
      nextContext.supportedForAnalysis = true;
      nextContext.validationReason = 'already_analyzed';
      nextContext.error = undefined;
      nextValue = currentState === 'validation_pending' ? 'completed' : currentState;
      break;
    case 'TEXT_EXTRACTED':
      nextContext.lastEvent = event.type;
      nextValue = currentState === 'validation_pending' ? 'text_extracted' : currentState;
      break;
    case 'CHUNKING_STARTED':
      nextContext.lastEvent = event.type;
      nextValue = currentState === 'text_extracted' ? 'chunking_in_progress' : currentState;
      break;
    case 'CHUNKING_COMPLETED':
      nextContext.lastEvent = event.type;
      nextValue = currentState === 'chunking_in_progress' ? 'chunking_complete' : currentState;
      break;
    case 'PERSISTING_CHUNKS':
      nextContext.lastEvent = event.type;
      nextValue = currentState === 'chunking_complete' ? 'persisting_chunks' : currentState;
      break;
    case 'COMPLETED':
      nextContext.lastEvent = event.type;
      nextValue = currentState === 'persisting_chunks' ? 'completed' : currentState;
      break;
    case 'FAILED':
      nextContext.lastEvent = event.type;
      nextContext.supportedForAnalysis = event.supportedForAnalysis ?? false;
      nextContext.validationReason = event.validationReason ?? event.error ?? 'unsupported_document';
      nextContext.error = event.error ?? 'Document chunking workflow failed';
      nextValue = 'failed';
      break;
    case 'SUPERSEDED':
      nextContext.lastEvent = event.type;
      nextValue = 'superseded';
      break;
    case 'RETRY_REQUESTED':
      nextContext.retryCount = (nextContext.retryCount ?? 0) + 1;
      nextContext.circuitOpen = (nextContext.retryCount ?? 0) >= 3;
      nextContext.lastEvent = event.type;
      nextContext.error = undefined;
      nextValue = currentState === 'failed' ? 'document_received' : currentState;
      break;
    case 'CIRCUIT_OPENED':
      nextContext.lastEvent = event.type;
      nextContext.error = event.reason ?? 'Circuit opened for document chunking';
      nextContext.circuitOpen = true;
      nextValue = 'failed';
      break;
    case 'RESET':
      nextContext.documentId = undefined;
      nextContext.documentVersion = 1;
      nextContext.projectId = undefined;
      nextContext.lastEvent = event.type;
      nextContext.error = undefined;
      nextContext.retryCount = 0;
      nextContext.circuitOpen = false;
      nextValue = 'idle';
      break;
    default:
      break;
  }

  return {
    value: nextValue,
    context: nextContext,
    done: isTerminalDocumentChunkingState(nextValue),
  };
}

export function createDocumentChunkingWorkflow(
  initialContext: Partial<DocumentChunkingWorkflowContext> = {},
): DocumentChunkingWorkflowInstance {
  const machine = createMachine({
    ...documentChunkingMachine.config,
    context: {
      ...defaultDocumentChunkingContext,
      ...initialContext,
    },
  });
  const service = createActor(machine).start();

  const readState = (): DocumentChunkingWorkflowState => {
    const snapshot = service.getSnapshot();
    return {
      value: snapshot.value as DocumentChunkingWorkflowStateValue,
      context: snapshot.context as DocumentChunkingWorkflowContext,
      done: isTerminalDocumentChunkingState(snapshot.value as DocumentChunkingWorkflowStateValue),
    };
  };

  return {
    get state(): DocumentChunkingWorkflowState {
      return readState();
    },
    send(event: DocumentChunkingEvent): DocumentChunkingWorkflowState {
      service.send(event as any);
      return readState();
    },
    reset(): DocumentChunkingWorkflowState {
      service.send({ type: 'RESET' } as any);
      return readState();
    },
  };
}
