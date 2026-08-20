import type { ExtractedDocumentText } from '../../domain/entities/ExtractedDocumentText';
import type { ExtractedDocumentTextRepository } from '../../domain/repositories/ExtractedDocumentTextRepository';
import { getDatabase, initDatabase } from '../../../../shared/infrastructure/database/connection';

export class DrizzleExtractedDocumentTextRepository implements ExtractedDocumentTextRepository {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  private mapRow(row: any): ExtractedDocumentText {
    return {
      id: row.id,
      documentId: row.document_id,
      documentVersion: Number(row.document_version),
      projectId: row.project_id ?? undefined,
      text: row.text,
      pageMetadata: row.page_metadata ? JSON.parse(row.page_metadata) : [],
      sectionHints: row.section_hints ? JSON.parse(row.section_hints) : undefined,
      language: row.language ?? undefined,
      warnings: row.warnings ? JSON.parse(row.warnings) : undefined,
      createdAt: new Date(Number(row.created_at)),
      updatedAt: row.updated_at ? new Date(Number(row.updated_at)) : undefined,
    };
  }

  async save(extractedText: ExtractedDocumentText): Promise<void> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const now = Date.now();
    await db.executeSql(
      `INSERT OR REPLACE INTO extracted_document_text (
        id, document_id, document_version, project_id, text, page_metadata,
        section_hints, language, warnings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        extractedText.id,
        extractedText.documentId,
        extractedText.documentVersion,
        extractedText.projectId ?? null,
        extractedText.text,
        JSON.stringify(extractedText.pageMetadata),
        extractedText.sectionHints ? JSON.stringify(extractedText.sectionHints) : null,
        extractedText.language ?? null,
        extractedText.warnings ? JSON.stringify(extractedText.warnings) : null,
        extractedText.createdAt.getTime(),
        (extractedText.updatedAt ?? new Date(now)).getTime(),
      ],
    );
  }

  async findByDocumentVersion(documentId: string, version: number): Promise<ExtractedDocumentText | null> {
    await this.ensureInitialized();
    const { db } = getDatabase();
    const [result] = await db.executeSql(
      'SELECT * FROM extracted_document_text WHERE document_id = ? AND document_version = ? LIMIT 1',
      [documentId, version],
    );
    return result.rows.length > 0 ? this.mapRow(result.rows.item(0)) : null;
  }
}