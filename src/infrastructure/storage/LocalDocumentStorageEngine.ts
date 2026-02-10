// src/infrastructure/storage/LocalDocumentStorageEngine.ts
import { DocumentStorageEngine, StoredFile } from '../../domain/services/DocumentStorageEngine';
import { Buffer } from 'buffer';

type FSLike = {
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: any): Promise<void>;
  writeFile(path: string, data: any, encoding?: string): Promise<void>;
  copyFile?(src: string, dest: string): Promise<void>;
  stat(path: string): Promise<{ size: number }>;
  unlink(path: string): Promise<void>;
  DocumentDirectoryPath?: string;
};

function createNodeFSWrapper(nodeFs: any, _nodePath: any): FSLike {
  return {
    async exists(pth: string) {
      return nodeFs.existsSync(pth);
    },
    async mkdir(pth: string) {
      if (!nodeFs.existsSync(pth)) {
        nodeFs.mkdirSync(pth, { recursive: true });
      }
    },
    async writeFile(pth: string, data: any) {
      await nodeFs.promises.writeFile(pth, data);
    },
    async copyFile(src: string, dest: string) {
      await nodeFs.promises.copyFile(src, dest);
    },
    async stat(pth: string) {
      const s = await nodeFs.promises.stat(pth);
      return { size: s.size };
    },
    async unlink(pth: string) {
      if (nodeFs.existsSync(pth)) {
        await nodeFs.promises.unlink(pth);
      }
    },
  } as FSLike;
}

export class LocalDocumentStorageEngine implements DocumentStorageEngine {
  private fs: FSLike | null = null;
  private pathModule: any = null;

  constructor(private readonly baseDir: string, options?: { fs?: FSLike; path?: any }) {
    if (options?.fs) {
      this.fs = options.fs;
      this.pathModule = options.path || null;
      return;
    }

    if (typeof require !== 'undefined') {
      try {
         
        const RNFS = require('react-native-fs');
        this.fs = {
          exists: (pth: string) => RNFS.exists(pth),
          mkdir: (pth: string) => RNFS.mkdir(pth),
          writeFile: (pth: string, data: any, encoding?: string) => RNFS.writeFile(pth, data, encoding || 'utf8'),
          copyFile: (src: string, dest: string) => RNFS.copyFile(src, dest),
          stat: async (pth: string) => {
            const s: any = await RNFS.stat(pth);
            return { size: Number(s.size || 0) };
          },
          unlink: (pth: string) => RNFS.unlink(pth),
          DocumentDirectoryPath: RNFS.DocumentDirectoryPath,
        } as FSLike;
      } catch (e) {
        // Not React Native or RNFS not installed; fall through to try Node fs
      }

      if (!this.fs) {
        try {
           
          const nodeFs = require('fs');
           
          const nodePath = require('path');
          this.fs = createNodeFSWrapper(nodeFs, nodePath);
          this.pathModule = nodePath;
        } catch (e) {
          // no fs available
        }
      }
    }
  }

  private joinPath(key: string) {
    if (this.pathModule && this.pathModule.join) {
      return this.pathModule.join(this.baseDir, key);
    }
    return `${this.baseDir}/${key}`;
  }

  async saveFile(fileData: ArrayBuffer | Uint8Array | string, filename: string): Promise<StoredFile> {
    const key = `${Date.now()}_${filename}`;
    const filePath = this.joinPath(key);

    if (!this.fs) {
      console.warn('LocalDocumentStorageEngine: File system not available. Mocking save.');
      return { key, path: `file://${filePath}`, size: 0 };
    }

    await this.fs.mkdir(this.baseDir).catch(() => {});

    if (typeof fileData === 'string') {
      const isExisting = await this.fs.exists(fileData).catch(() => false);
      if (isExisting && this.fs.copyFile) {
        await this.fs.copyFile(fileData, filePath);
        const stats = await this.fs.stat(filePath);
        return { key, path: filePath, size: stats.size };
      }

      await this.fs.writeFile(filePath, fileData, 'utf8');
      const stats = await this.fs.stat(filePath);
      return { key, path: filePath, size: stats.size };
    }

    if (fileData instanceof ArrayBuffer || ArrayBuffer.isView(fileData)) {
      if (this.pathModule && typeof Buffer !== 'undefined') {
        const buf = Buffer.from(fileData as any);
        await this.fs.writeFile(filePath, buf);
        const stats = await this.fs.stat(filePath);
        return { key, path: filePath, size: stats.size };
      }

      try {
        const bytes = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : (fileData as Uint8Array);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const btoaFn: any = (typeof (globalThis as any).btoa !== 'undefined') ? (globalThis as any).btoa : null;
        if (btoaFn) {
          const base64 = btoaFn(binary);
          await this.fs.writeFile(filePath, base64, 'base64');
          const stats = await this.fs.stat(filePath);
          return { key, path: filePath, size: stats.size };
        }
      } catch (e) {
        // fall through
      }
    }

    throw new Error('Unsupported fileData type for saveFile in LocalDocumentStorageEngine');
  }

  async getFileUrl(key: string): Promise<string | null> {
    const filePath = this.joinPath(key);
    if (!this.fs) return `file://${filePath}`;
    return `file://${filePath}`;
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = this.joinPath(key);
    if (!this.fs) {
      console.warn(`LocalDocumentStorageEngine: Mock deleting ${key}`);
      return;
    }

    const exists = await this.fs.exists(filePath).catch(() => false);
    if (exists) {
      await this.fs.unlink(filePath).catch(() => {});
    }
  }
}
