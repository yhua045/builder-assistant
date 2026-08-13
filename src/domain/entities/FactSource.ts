export type FactSourceType = 'document' | 'chunk' | 'fact' | 'user' | 'external';

export interface FactSource {
  id: string;
  factId: string;
  sourceType: FactSourceType;
  sourceId: string;
  excerpt: string;
  documentId?: string;
  chunkId?: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  confidence?: number;
}

export class FactSourceEntity {
  private constructor(private readonly source: FactSource) {}

  static create(payload: FactSource): FactSourceEntity {
    FactSourceEntity.validate(payload);
    return new FactSourceEntity({ ...payload });
  }

  static fromData(source: FactSource): FactSourceEntity {
    FactSourceEntity.validate(source);
    return new FactSourceEntity({ ...source });
  }

  data(): FactSource {
    return { ...this.source };
  }

  private static validate(source: FactSource): void {
    if (!source.id || source.id.trim().length === 0) {
      throw new Error('FactSource id is required');
    }
    if (!source.factId || source.factId.trim().length === 0) {
      throw new Error('FactSource factId is required');
    }
    if (!source.sourceId || source.sourceId.trim().length === 0) {
      throw new Error('FactSource sourceId is required');
    }
    if (!source.excerpt || source.excerpt.trim().length === 0) {
      throw new Error('FactSource excerpt is required');
    }
    if (source.confidence !== undefined && (source.confidence < 0 || source.confidence > 1)) {
      throw new Error('FactSource confidence must be between 0 and 1');
    }
  }
}
