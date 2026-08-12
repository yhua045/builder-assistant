import { useCallback, useEffect, useMemo, useState } from 'react';
import { StartKnowledgeEmbeddingFlowUseCase } from '../application/StartKnowledgeEmbeddingFlowUseCase';
import { KnowledgeEmbeddingStep } from '../domain/value-objects/KnowledgeEmbeddingStep';

export interface KnowledgeEmbeddingFlowViewModel {
  currentStep: KnowledgeEmbeddingStep;
  projectName: string;
  documents: Array<{ id: string; name: string; type?: string; uri?: string }>;
  isLoading: boolean;
  startFlow: () => Promise<void>;
  continueFlow: () => void;
  skipForNow: () => void;
}

export function useKnowledgeEmbeddingFlow(): KnowledgeEmbeddingFlowViewModel {
  const [currentStep, setCurrentStep] = useState<KnowledgeEmbeddingStep>(KnowledgeEmbeddingStep.WELCOME);
  const [projectName, setProjectName] = useState('');
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type?: string; uri?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const startFlow = useCallback(async () => {
    setIsLoading(true);

    const useCase = new StartKnowledgeEmbeddingFlowUseCase();
    const result = await useCase.execute();

    setCurrentStep(result.currentStep);
    setProjectName(result.projectName);
    setDocuments(result.documents);
    setIsLoading(false);
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
    setCurrentStep(KnowledgeEmbeddingStep.WELCOME);
  }, []);

  useEffect(() => {
    void startFlow();
  }, [startFlow]);

  return useMemo(() => ({
    currentStep,
    projectName,
    documents,
    isLoading,
    startFlow,
    continueFlow,
    skipForNow,
  }), [currentStep, projectName, documents, isLoading, startFlow, continueFlow, skipForNow]);
}
