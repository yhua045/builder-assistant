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

  it('hydrates the session from the project details captured in onboarding', async () => {
    const useCase = new StartKnowledgeEmbeddingFlowUseCase();

    const result = await useCase.execute({
      projectName: 'My New Home',
      address: '12 Maple Street, Sydney NSW 2000',
      projectType: 'new-home',
    });

    expect(result.projectName).toBe('My New Home');
    expect(result.address).toBe('12 Maple Street, Sydney NSW 2000');
    expect(result.projectType).toBe('new-home');
    expect(result.currentStep).toBe(KnowledgeEmbeddingStep.WELCOME);
  });
});
