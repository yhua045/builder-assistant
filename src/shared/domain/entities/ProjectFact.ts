export type FactType =
  | 'budget'
  | 'schedule'
  | 'scope'
  | 'risk'
  | 'requirement'
  | 'constraint'
  | 'assumption'
  | 'procurement'
  | 'quality'
  | 'other';

export type FactStatus = 'proposed' | 'confirmed' | 'rejected' | 'stale';

export interface ProjectFact {
  id: string;
  projectId: string;
  factType: FactType;
  canonicalText: string;
  normalizedText?: string;
  status: FactStatus;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectFactEntity {
  private constructor(private readonly fact: ProjectFact) {}

  static create(payload: Omit<ProjectFact, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): ProjectFactEntity {
    const now = new Date();
    const fact: ProjectFact = {
      ...payload,
      createdAt: payload.createdAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    ProjectFactEntity.validate(fact);
    return new ProjectFactEntity(fact);
  }

  static fromData(fact: ProjectFact): ProjectFactEntity {
    ProjectFactEntity.validate(fact);
    return new ProjectFactEntity({ ...fact });
  }

  data(): ProjectFact {
    return { ...this.fact };
  }

  private static validate(fact: ProjectFact): void {
    if (!fact.id || fact.id.trim().length === 0) {
      throw new Error('ProjectFact id is required');
    }
    if (!fact.projectId || fact.projectId.trim().length === 0) {
      throw new Error('ProjectFact projectId is required');
    }
    if (!fact.canonicalText || fact.canonicalText.trim().length === 0) {
      throw new Error('ProjectFact canonicalText is required');
    }
    if (fact.confidence !== undefined && (fact.confidence < 0 || fact.confidence > 1)) {
      throw new Error('ProjectFact confidence must be between 0 and 1');
    }
  }
}
