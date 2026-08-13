import { KnowledgeEmbeddingSession } from '../domain/entities/KnowledgeEmbeddingSession';
import { KnowledgeEmbeddingStep } from '../domain/value-objects/KnowledgeEmbeddingStep';

export interface StartKnowledgeEmbeddingFlowInput {
  projectName?: string;
  address?: string;
  projectType?: string;
}

export interface StartKnowledgeEmbeddingFlowResult {
  sessionId: string;
  currentStep: KnowledgeEmbeddingStep;
  projectName: string;
  address?: string;
  projectType?: string;
  documents: Array<{ id: string; name: string; type?: string; uri?: string }>;
}

export class StartKnowledgeEmbeddingFlowUseCase {
  async execute(input: StartKnowledgeEmbeddingFlowInput = {}): Promise<StartKnowledgeEmbeddingFlowResult> {
    const session: KnowledgeEmbeddingSession = {
      id: `knowledge-embedding-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      currentStep: KnowledgeEmbeddingStep.WELCOME,
      projectName: input.projectName ?? '',
      address: input.address ?? '',
      projectType: input.projectType ?? '',
      documents: [],
      createdAt: new Date().toISOString(),
    };

    return {
      sessionId: session.id,
      currentStep: session.currentStep,
      projectName: session.projectName,
      address: session.address,
      projectType: session.projectType,
      documents: session.documents,
    };
  }
}
