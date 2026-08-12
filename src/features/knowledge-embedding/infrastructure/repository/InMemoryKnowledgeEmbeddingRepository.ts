import { KnowledgeEmbeddingSession } from '../../domain/entities/KnowledgeEmbeddingSession';
import { KnowledgeEmbeddingStep } from '../../domain/value-objects/KnowledgeEmbeddingStep';

export class InMemoryKnowledgeEmbeddingRepository {
  private sessions = new Map<string, KnowledgeEmbeddingSession>();

  async createInitialSession(): Promise<KnowledgeEmbeddingSession> {
    const session: KnowledgeEmbeddingSession = {
      id: `knowledge-embedding-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      currentStep: KnowledgeEmbeddingStep.WELCOME,
      projectName: '',
      documents: [],
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async getById(id: string): Promise<KnowledgeEmbeddingSession | null> {
    return this.sessions.get(id) ?? null;
  }
}
