/**
 * Mobile implementation of IFileSystemAdapter using react-native-fs
 * Provides file system operations for iOS and Android platforms
 */

import RNFS from 'react-native-fs';
import { IFileSystemAdapter } from './IFileSystemAdapter';

export class MobileFileSystemAdapter implements IFileSystemAdapter {
  /**
   * Copy a file to app's private storage directory
   * Creates an 'invoices' subdirectory if it doesn't exist
   */
  async copyToAppStorage(sourceUri: string, destinationFilename: string): Promise<string> {
    // Get documents directory path
    const docsDir = await this.getDocumentsDirectory();
    
    // Create invoices subdirectory if it doesn't exist
    const invoicesDir = `${docsDir}/invoices`;
    const dirExists = await RNFS.exists(invoicesDir);
    
    if (!dirExists) {
      await RNFS.mkdir(invoicesDir);
    }

    // Construct destination path
    const destPath = `${invoicesDir}/${destinationFilename}`;

    // Clean up source URI (remove file:// prefix if present for RNFS)
    const cleanSourceUri = sourceUri.replace('file://', '');
    
    // Copy the file
    await RNFS.copyFile(cleanSourceUri, destPath);

    // Return the destination URI with file:// prefix for consistency
    return `file://${destPath}`;
  }

  /**
   * Get app's private documents directory path
   */
  async getDocumentsDirectory(): Promise<string> {
    return RNFS.DocumentDirectoryPath;
  }

  /**
   * Check if a file exists at the given path
   */
  async exists(filePath: string): Promise<boolean> {
    // Clean up URI (remove file:// prefix if present)
    const cleanPath = filePath.replace('file://', '');
    return RNFS.exists(cleanPath);
  }
}
