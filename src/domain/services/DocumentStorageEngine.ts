export interface StoredFile {
  key: string;
  url?: string;
  path?: string;
  size?: number;
  mimeType?: string;
}

export interface DocumentStorageEngine {
  /**
   * Save a file to the storage engine.
   * @param fileData The file content (Blob, Buffer, or stream). in generic context, we might use any.
   *                 For React Native, this might be a uri string to move, or base64.
   *                 Strictly, use `ArrayBuffer` or `Uint8Array` for cross-platform binary data, 
   *                 or `string` (path) if moving local files.
   * @param filename Suggested filename
   */
  saveFile(fileData: ArrayBuffer | Uint8Array | string, filename: string): Promise<StoredFile>;
  
  /**
   * Retrieve a file.
   * Returns a signed URL (for cloud) or local filesystem path (for local).
   * Or the content itself if requested.
   */
  getFileUrl(key: string): Promise<string | null>;
  
  deleteFile(key: string): Promise<void>;
}
