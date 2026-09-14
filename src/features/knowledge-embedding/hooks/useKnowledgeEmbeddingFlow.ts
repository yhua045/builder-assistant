import { AppState, type AppStateStatus } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { container } from 'tsyringe';
import '../../../shared/infrastructure/di/registerServices';
import type { KnowledgeEmbeddingDocumentService } from '../application/services/KnowledgeEmbeddingDocumentService';
import { KnowledgeEmbeddingStep } from '../domain/value-objects/KnowledgeEmbeddingStep';
import type { KnowledgeEmbeddingRunView } from '../application/contracts/KnowledgeEmbeddingRunContracts';
import type { IFilePickerAdapter } from '../../../shared/infrastructure/files/IFilePickerAdapter';
import { InMemoryWorkflowQueue } from '../application/services/InMemoryWorkflowQueue';

export type KnowledgeEmbeddingDocumentType = 'engineering' | 'flooring' | 'council' | 'other';
export type KnowledgeEmbeddingDocumentStatus = 'ready' | 'uploading' | 'done';

export interface KnowledgeEmbeddingDocument {
  id: string;
  name: string;
  size: string;
  type: KnowledgeEmbeddingDocumentType;
  status: KnowledgeEmbeddingDocumentStatus;
  uri?: string;
  errorMessage?: string;
}

export interface KnowledgeEmbeddingFlowViewModel {
  currentStep: KnowledgeEmbeddingStep;
  visibleSteps: KnowledgeEmbeddingStep[];
  selectedProjectId?: string;
  isNewProject: boolean;
  projectName: string;
  address: string;
  projectType: string;
  documents: KnowledgeEmbeddingDocument[];
  committedRuns: KnowledgeEmbeddingRunView[];
  isProcessingDocuments: boolean;
  documentSelectionError?: string;
  isLoading: boolean;
  startFlow: (draft?: { projectName?: string; address?: string; projectType?: string }) => Promise<void>;
  setProjectName: (value: string) => void;
  setAddress: (value: string) => void;
  setProjectType: (value: string) => void;
  initializeExistingProject: (projectId: string) => void;
  selectExistingProject: (projectId: string) => void;
  selectNewProject: () => void;
  selectDocument: () => Promise<void>;
  addDocument: (document: Omit<KnowledgeEmbeddingDocument, 'status'>) => void;
  removeDocument: (id: string) => void;
  processDocuments: () => Promise<boolean>;
  goToStep: (step: KnowledgeEmbeddingStep) => void;
  continueFlow: () => void;
  skipForNow: () => void;
}

export function useKnowledgeEmbeddingFlow(): KnowledgeEmbeddingFlowViewModel {
  const [currentStep, setCurrentStep] = useState<KnowledgeEmbeddingStep>(KnowledgeEmbeddingStep.WELCOME);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState('');
  const [documents, setDocuments] = useState<KnowledgeEmbeddingDocument[]>([]);
  const [committedRuns, setCommittedRuns] = useState<KnowledgeEmbeddingRunView[]>([]);
  const [isProcessingDocuments, setIsProcessingDocuments] = useState(false);
  const [documentSelectionError, setDocumentSelectionError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [documentService] = useState(() => container.resolve<KnowledgeEmbeddingDocumentService>('KnowledgeEmbeddingDocumentService'));
  const [filePicker] = useState(() => container.resolve<IFilePickerAdapter>('IFilePickerAdapter'));
  const [workflowQueue] = useState(() => container.resolve<InMemoryWorkflowQueue>('InMemoryWorkflowQueue'));
  const visibleSteps = useMemo(() => selectedProjectId
    ? [
      KnowledgeEmbeddingStep.WELCOME,
      KnowledgeEmbeddingStep.UPLOAD_DOCUMENTS,
      KnowledgeEmbeddingStep.PROCESSING,
    ]
    : [
      KnowledgeEmbeddingStep.WELCOME,
      KnowledgeEmbeddingStep.PROJECT_SETUP,
      KnowledgeEmbeddingStep.UPLOAD_DOCUMENTS,
      KnowledgeEmbeddingStep.PROCESSING,
    ], [selectedProjectId]);

  const refreshCommittedRuns = useCallback(async (documentIds = committedRuns.map((run) => run.documentId)) => {
    if (documentIds.length === 0) return;
    const runs = await documentService.getRuns(documentIds);
    setCommittedRuns(runs);
  }, [committedRuns, documentService]);

  const startFlow = useCallback(async (draft?: { projectName?: string; address?: string; projectType?: string }) => {
    setIsLoading(true);

    setCurrentStep(KnowledgeEmbeddingStep.WELCOME);
    setSelectedProjectId(undefined);
    setProjectName(draft?.projectName ?? '');
    setAddress(draft?.address ?? '');
    setProjectType(draft?.projectType ?? '');
    try {
      setDocuments([]);
      setCommittedRuns([]);
      setDocumentSelectionError(undefined);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addDocument = useCallback((document: Omit<KnowledgeEmbeddingDocument, 'status'>) => {
    setDocuments((current) => current.some((item) => item.id === document.id)
      ? current
      : [...current, { ...document, status: 'ready' }]);
    setDocumentSelectionError(undefined);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((current) => current.filter((document) => document.id !== id));
  }, []);

  const selectDocument = useCallback(async () => {
    console.info('[knowledge-embedding] document picker opened');
    try {
      const result = await filePicker.pickDocument();
      if (result.cancelled) {
        console.info('[knowledge-embedding] document selection cancelled');
        return;
      }
      if (!result.uri || !result.name) {
        console.info('[knowledge-embedding] document selection rejected: missing name or URI');
        setDocumentSelectionError('The selected file is missing a name or location.');
        return;
      }

      const selectedDocument = {
        id: `selected-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: result.name,
        size: result.size === undefined ? '' : `${result.size}`,
        type: result.type?.includes('pdf') ? 'other' : 'other',
        uri: result.uri,
      } as const;
      addDocument(selectedDocument);
      console.info('[knowledge-embedding] document selected', {
        documentId: selectedDocument.id,
        name: selectedDocument.name,
        size: selectedDocument.size,
      });
    } catch (error) {
      console.info('[knowledge-embedding] document selection failed', error);
      setDocumentSelectionError(error instanceof Error ? error.message : 'Unable to select the document.');
    }
  }, [addDocument, filePicker]);

  const processDocuments = useCallback(async () => {
    if (documents.length === 0 || isProcessingDocuments) return false;

    setIsProcessingDocuments(true);
    setDocumentSelectionError(undefined);
    console.info('[knowledge-embedding] document processing triggered', {
      projectId: selectedProjectId,
      documentCount: documents.length,
      documentIds: documents.map((document) => document.id),
    });
    try {
      const runs = await documentService.commitDocuments({
        projectId: selectedProjectId,
        files: documents.map((document) => ({
          id: document.id,
          name: document.name,
          size: document.size,
          type: document.type,
          uri: document.uri ?? '',
        })),
      });
      console.info('[knowledge-embedding] document processing committed', {
        runCount: runs.length,
        runIds: runs.map((run) => run.id),
        documentIds: runs.map((run) => run.documentId),
      });
      setCommittedRuns(runs);
      setDocuments([]);
      setCurrentStep(KnowledgeEmbeddingStep.PROCESSING);
      return true;
    } catch (error) {
      console.info('[knowledge-embedding] document processing failed', error);
      setDocumentSelectionError(error instanceof Error ? error.message : 'Unable to analyse the selected documents.');
      return false;
    } finally {
      setIsProcessingDocuments(false);
    }
  }, [documentService, documents, isProcessingDocuments, selectedProjectId]);

  const goToStep = useCallback((step: KnowledgeEmbeddingStep) => {
    if (visibleSteps.includes(step)) {
      setCurrentStep(step);
    }
  }, [visibleSteps]);

  const initializeExistingProject = useCallback((projectId: string) => {
    setSelectedProjectId((current) => current ?? projectId);
  }, []);

  const selectExistingProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setProjectName('');
    setAddress('');
    setCurrentStep(KnowledgeEmbeddingStep.UPLOAD_DOCUMENTS);
  }, []);

  const selectNewProject = useCallback(() => {
    setSelectedProjectId(undefined);
    setProjectName('');
    setAddress('');
    setCurrentStep(KnowledgeEmbeddingStep.WELCOME);
  }, []);

  const continueFlow = useCallback(() => {
    setCurrentStep((step) => {
      const index = visibleSteps.indexOf(step);
      const next = visibleSteps[Math.min(index + 1, visibleSteps.length - 1)];
      return next;
    });
  }, [visibleSteps]);

  const skipForNow = useCallback(() => {
    goToStep(KnowledgeEmbeddingStep.WELCOME);
  }, [goToStep]);

  useEffect(() => {
    startFlow();
  }, [startFlow]);

  useEffect(() => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState.match(/inactive|background/) && nextState === 'active') {
        void documentService.restoreAndResume().then(() => refreshCommittedRuns());
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, [documentService, refreshCommittedRuns]);

  useEffect(() => {
    if (currentStep !== KnowledgeEmbeddingStep.PROCESSING || committedRuns.length === 0) return;
    const committedDocumentIds = new Set(committedRuns.map((run) => run.documentId));
    return workflowQueue.subscribe((item) => {
      if (committedDocumentIds.has(item.documentId)) {
        void refreshCommittedRuns([...committedDocumentIds]);
      }
    });
  }, [committedRuns, currentStep, refreshCommittedRuns, workflowQueue]);

  return useMemo(() => ({
    currentStep,
    visibleSteps,
    selectedProjectId,
    isNewProject: !selectedProjectId,
    projectName,
    address,
    projectType,
    documents,
    committedRuns,
    isProcessingDocuments,
    documentSelectionError,
    isLoading,
    startFlow,
    setProjectName,
    setAddress,
    setProjectType,
    initializeExistingProject,
    selectExistingProject,
    selectNewProject,
    selectDocument,
    addDocument,
    removeDocument,
    processDocuments,
    goToStep,
    continueFlow,
    skipForNow,
  }), [
    currentStep,
    visibleSteps,
    selectedProjectId,
    projectName,
    address,
    projectType,
    documents,
    committedRuns,
    isProcessingDocuments,
    documentSelectionError,
    isLoading,
    startFlow,
    initializeExistingProject,
    selectExistingProject,
    selectNewProject,
    selectDocument,
    addDocument,
    removeDocument,
    processDocuments,
    goToStep,
    continueFlow,
    skipForNow,
  ]);
}
