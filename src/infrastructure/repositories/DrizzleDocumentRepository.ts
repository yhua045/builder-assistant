import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq, and } from 'drizzle-orm';
import { Document, DocumentEntity } from '../../domain/entities/Document';
import { DocumentRepository } from '../../domain/repositories/DocumentRepository';
import { initDatabase, getDatabase } from '../database/connection';
import { documents } from '../database/schema';

type DocumentSchema = typeof documents.$inferSelect;

export class DrizzleDocumentRepository implements DocumentRepository {
  private drizzle: ReturnType<typeof drizzle> | null = null;

  async init(): Promise<void> {
    if (this.drizzle) return;
    const { drizzle: db } = await initDatabase();
    this.drizzle = db;
  }

  // Helper to map raw SQL row to Document
  private mapRowToDocument(row: any): Document {
    return {
      id: row.id,
      localId: row.local_id,
      projectId: row.project_id || undefined,
      type: row.type || undefined,
      title: row.title || undefined,
      mimeType: row.mime_type || undefined,
      size: row.size || undefined,
      filename: row.filename || undefined,
      status: row.status || 'local-only',
      localPath: row.local_path || undefined,
      storageKey: row.storage_key || undefined,
      cloudUrl: row.cloud_url || undefined,
      source: row.source || undefined,
      uploadedBy: row.uploaded_by || undefined,
      uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toISOString() : undefined,
      checksum: row.checksum || undefined,
      ocrText: row.ocr_text || undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      uri: row.uri || undefined,
      issuedBy: row.issued_by || undefined,
      issuedDate: row.issued_date ? new Date(row.issued_date).toISOString() : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async save(document: Document): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();

    const existing = await this.findById(document.id);
    
    // Convert dates to timestamps and booleans/json to strings
    const params = [
        document.id,
        document.projectId || null,
        document.type || null,
        document.title || null,
        document.filename || null,
        document.mimeType || null,
        document.size || null,
        document.status,
        document.localPath || null,
        document.storageKey || null,
        document.cloudUrl || null,
        document.uri || null,
        document.issuedBy || null,
        document.issuedDate ? new Date(document.issuedDate).getTime() : null,
        document.expiresAt ? new Date(document.expiresAt).getTime() : null,
        document.notes || null,
        document.tags ? JSON.stringify(document.tags) : null,
        document.ocrText || null,
        document.source || null,
        document.uploadedBy || null,
        document.uploadedAt ? new Date(document.uploadedAt).getTime() : null,
        document.checksum || null,
        document.createdAt ? new Date(document.createdAt).getTime() : Date.now(),
        Date.now(), // updatedAt
    ];

    if (existing) {
       await db.executeSql(`
         UPDATE documents SET 
           project_id=?, type=?, title=?, filename=?, mime_type=?, size=?, status=?,
           local_path=?, storage_key=?, cloud_url=?, uri=?, issued_by=?, issued_date=?,
           expires_at=?, notes=?, tags=?, ocr_text=?, source=?, uploaded_by=?, uploaded_at=?,
           checksum=?, created_at=?, updated_at=?
         WHERE id = ?
       `, [...params.slice(1), document.id]); // params without id (first arg), but added at end
    } else {
       await db.executeSql(`
         INSERT INTO documents (
           id, project_id, type, title, filename, mime_type, size, status,
           local_path, storage_key, cloud_url, uri, issued_by, issued_date,
           expires_at, notes, tags, ocr_text, source, uploaded_by, uploaded_at,
           checksum, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `, params);
    }
  }

  async findById(id: string): Promise<Document | null> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();
    
    // Manual SQL
    const [result] = await db.executeSql('SELECT * FROM documents WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapRowToDocument(result.rows.item(0));
  }

  async findAll(filter?: { projectId?: string; status?: string }): Promise<Document[]> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();
    
    let sql = 'SELECT * FROM documents';
    const params: any[] = [];
    
    const conditions: string[] = [];
    if (filter?.projectId) {
        conditions.push('project_id = ?');
        params.push(filter.projectId);
    }
    if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
    }
    
    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    const [result] = await db.executeSql(sql, params);
    const docs: Document[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        docs.push(this.mapRowToDocument(result.rows.item(i)));
    }
    return docs;
  }

  async findByProjectId(projectId: string): Promise<Document[]> {
    return this.findAll({ projectId });
  }

  async update(document: Document): Promise<void> {
    // Re-use save logic which handles upsert check
    return this.save(document);
  }

  async delete(id: string): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM documents WHERE id = ?', [id]);
  }

  async assignProject(documentId: string, projectId: string): Promise<void> {
    if (!this.drizzle) await this.init();
    const { db } = getDatabase();
    await db.executeSql(
        'UPDATE documents SET project_id = ?, updated_at = ? WHERE id = ?', 
        [projectId, Date.now(), documentId]
    );
  }
}
