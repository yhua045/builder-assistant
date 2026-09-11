import { AppState, type AppStateStatus } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { container } from 'tsyringe';
import '../../../shared/infrastructure/di/registerServices';
import type { KnowledgeEmbeddingDocumentService } from '../application/services/KnowledgeEmbeddingDocumentService';
import { KnowledgeEmbeddingStep } from '../domain/value-objects/KnowledgeEmbeddingStep';

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
  projectName: string;
  address: string;
  projectType: string;
  documents: KnowledgeEmbeddingDocument[];
  isLoading: boolean;
  startFlow: (draft?: { projectName?: string; address?: string; projectType?: string }) => Promise<void>;
  setProjectName: (value: string) => void;
  setAddress: (value: string) => void;
  setProjectType: (value: string) => void;
  addDocument: (document: Omit<KnowledgeEmbeddingDocument, 'status'>) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  goToStep: (step: KnowledgeEmbeddingStep) => void;
  continueFlow: () => void;
  skipForNow: () => void;
}

export function useKnowledgeEmbeddingFlow(): KnowledgeEmbeddingFlowViewModel {
  const [currentStep, setCurrentStep] = useState<KnowledgeEmbeddingStep>(KnowledgeEmbeddingStep.WELCOME);
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState('');
  const [documents, setDocuments] = useState<KnowledgeEmbeddingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [documentService] = useState(() => container.resolve<KnowledgeEmbeddingDocumentService>('KnowledgeEmbeddingDocumentService'));

  const reloadDocuments = useCallback(async () => {
    const persisted = await documentService.listDocuments();
    setDocuments(persisted.map((run) => ({
      id: run.documentId,
      name: run.metadata.name,
      size: run.metadata.size,
      type: (run.metadata.type as KnowledgeEmbeddingDocumentType) || 'other',
      status: run.status === 'completed' ? 'done' : run.status === 'failed' ? 'ready' : 'uploading',
      uri: run.metadata.uri,
      errorMessage: run.errorMessage,
    })));
  }, [documentService]);

  const startFlow = useCallback(async (draft?: { projectName?: string; address?: string; projectType?: string }) => {
    setIsLoading(true);

    setCurrentStep(KnowledgeEmbeddingStep.WELCOME);
    setProjectName(draft?.projectName ?? '');
    setAddress(draft?.address ?? '');
    setProjectType(draft?.projectType ?? '');
    try {
      await reloadDocuments();
    } finally {
      setIsLoading(false);
    }
  }, [reloadDocuments]);

  const addDocument = useCallback(async (document: Omit<KnowledgeEmbeddingDocument, 'status'>) => {
    await documentService.addDocument({
      documentId: document.id,
      documentVersion: 1,
      metadata: {
        name: document.name,
        type: document.type,
        size: document.size,
        uri: document.uri,
      },
    });
    await reloadDocuments();
  }, [documentService, reloadDocuments]);

  const removeDocument = useCallback(async (id: string) => {
    await documentService.removeDocument(id, 1);
    await reloadDocuments();
  }, [documentService, reloadDocuments]);

  const goToStep = useCallback((step: KnowledgeEmbeddingStep) => {
    setCurrentStep(step);
  }, []);

  const continueFlow = useCallback(() => {
    setCurrentStep((step) => {
      const order = [
        KnowledgeEmbeddingStep.WELCOME,
        KnowledgeEmbeddingStep.PROJECT_SETUP,
        KnowledgeEmbeddingStep.UPLOAD_DOCUMENTS,
        KnowledgeEmbeddingStep.PROCESSING,
        KnowledgeEmbeddingStep.SUMMARY,
      ];

      const index = order.indexOf(step);
      const next = order[Math.min(index + 1, order.length - 1)];
      return next;
    });
  }, []);

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
        void documentService.restoreAndResume().then(reloadDocuments);
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, [documentService, reloadDocuments]);

  return useMemo(() => ({
    currentStep,
    projectName,
    address,
    projectType,
    documents,
    isLoading,
    startFlow,
    setProjectName,
    setAddress,
    setProjectType,
    addDocument,
    removeDocument,
    goToStep,
    continueFlow,
    skipForNow,
  }), [
    currentStep,
    projectName,
    address,
    projectType,
    documents,
    isLoading,
    startFlow,
    addDocument,
    removeDocument,
    goToStep,
    continueFlow,
    skipForNow,
  ]);
}
