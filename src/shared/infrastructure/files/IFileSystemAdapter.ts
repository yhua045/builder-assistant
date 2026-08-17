/**
 * File system adapter interface for file operations
 * Abstracts platform-specific file system operations
 */

export interface IFileSystemAdapter {
  /**
   * Copy a file to app's private storage directory
   * @param sourceUri - Original file URI from picker
   * @param destinationFilename - Filename to use in app storage
   * @returns New URI in app private storage
   */
  copyToAppStorage(sourceUri: string, destinationFilename: string): Promise<string>;
  
  /**
   * Get app's private documents directory path
   * @returns Absolute path to documents directory
   */
  getDocumentsDirectory(): Promise<string>;
  
  /**
   * Check if a file exists at the given path
   * @param filePath - File path to check
   * @returns True if file exists, false otherwise
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * Delete a file at the given path
   * @param filePath - File URI or path to delete
   */
  deleteFile(filePath: string): Promise<void>;
}
