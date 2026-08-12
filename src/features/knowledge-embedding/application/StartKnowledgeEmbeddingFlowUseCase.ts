import { KnowledgeEmbeddingSession } from '../domain/entities/KnowledgeEmbeddingSession';
import { KnowledgeEmbeddingStep } from '../domain/value-objects/KnowledgeEmbeddingStep';

export interface StartKnowledgeEmbeddingFlowResult {
  sessionId: string;
  currentStep: KnowledgeEmbeddingStep;
  projectName: string;
  documents: Array<{ id: string; name: string; type?: string; uri?: string }>;
}

export class StartKnowledgeEmbeddingFlowUseCase {
  async execute(): Promise<StartKnowledgeEmbeddingFlowResult> {
    const session: KnowledgeEmbeddingSession = {
      id: `knowledge-embedding-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      currentStep: KnowledgeEmbeddingStep.WELCOME,
      projectName: '',
      documents: [],
      createdAt: new Date().toISOString(),
    };

    return {
      sessionId: session.id,
      currentStep: session.currentStep,
      projectName: session.projectName,
      documents: session.documents,
    };
  }
}
