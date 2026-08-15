export interface ParsedDocumentPage {
  pageNumber: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ExtractedDocumentText {
  id: string;
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: ParsedDocumentPage[];
  sectionHints?: Array<{ heading: string; text: string }>;
  language?: string;
  warnings?: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export class ExtractedDocumentTextEntity {
  private constructor(private readonly textData: ExtractedDocumentText) {}

  static create(payload: Omit<ExtractedDocumentText, 'updatedAt'> & { updatedAt?: Date }): ExtractedDocumentTextEntity {
    const now = new Date();
    const normalized: ExtractedDocumentText = {
      ...payload,
      pageMetadata: payload.pageMetadata ?? [],
      createdAt: payload.createdAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    ExtractedDocumentTextEntity.validate(normalized);
    return new ExtractedDocumentTextEntity(normalized);
  }

  static fromData(data: ExtractedDocumentText): ExtractedDocumentTextEntity {
    ExtractedDocumentTextEntity.validate(data);
    return new ExtractedDocumentTextEntity({ ...data });
  }

  data(): ExtractedDocumentText {
    return { ...this.textData };
  }

  private static validate(data: ExtractedDocumentText): void {
    if (!data.id || data.id.trim().length === 0) {
      throw new Error('ExtractedDocumentText id is required');
    }
    if (!data.documentId || data.documentId.trim().length === 0) {
      throw new Error('ExtractedDocumentText documentId is required');
    }
    if (data.documentVersion < 1) {
      throw new Error('ExtractedDocumentText documentVersion must be >= 1');
    }
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('ExtractedDocumentText text is required');
    }
    if (!Array.isArray(data.pageMetadata)) {
      throw new Error('ExtractedDocumentText pageMetadata is required');
    }
    if (!data.createdAt || Number.isNaN(data.createdAt.getTime())) {
      throw new Error('ExtractedDocumentText createdAt is required');
    }
  }
}
