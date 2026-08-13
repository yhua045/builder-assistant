import { KnowledgeEmbeddingStep } from '../value-objects/KnowledgeEmbeddingStep';

export interface DocumentDraft {
  id: string;
  name: string;
  type?: string;
  uri?: string;
}

export interface KnowledgeEmbeddingSession {
  id: string;
  currentStep: KnowledgeEmbeddingStep;
  projectName: string;
  address?: string;
  projectType?: string;
  documents: DocumentDraft[];
  createdAt: string;
}
