import { StartKnowledgeEmbeddingFlowUseCase } from '../../application/StartKnowledgeEmbeddingFlowUseCase';
import { KnowledgeEmbeddingStep } from '../../domain/value-objects/KnowledgeEmbeddingStep';

describe('StartKnowledgeEmbeddingFlowUseCase', () => {
  it('starts from the welcome step and creates a new session', async () => {
    const useCase = new StartKnowledgeEmbeddingFlowUseCase();

    const result = await useCase.execute();

    expect(result.sessionId).toBeTruthy();
    expect(result.currentStep).toBe(KnowledgeEmbeddingStep.WELCOME);
    expect(result.projectName).toBe('');
    expect(result.documents).toEqual([]);
  });
});
