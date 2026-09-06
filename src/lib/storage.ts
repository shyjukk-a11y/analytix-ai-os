import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Knowledge-source file storage abstraction (spec section 4 / 28).
 *
 * Local disk (`LocalDiskKnowledgeStorage`) is used for zero-install local dev. Production
 * (Vercel) has no persistent filesystem, so `VercelBlobKnowledgeStorage` is used instead
 * whenever `BLOB_READ_WRITE_TOKEN` is set (Vercel sets this automatically once Blob storage
 * is enabled on the project). Callers only depend on the `KnowledgeStorage` interface, so
 * this swap is transparent to them.
 */
export interface KnowledgeStorage {
  /** Persists a file and returns a storage-relative path (or URL) to save on the KnowledgeSource row. */
  save(projectId: string, originalFileName: string, buffer: Buffer): Promise<string>;
}

const BASE_DIR = process.env.KNOWLEDGE_STORAGE_DIR ?? './storage/knowledge-sources';

export class LocalDiskKnowledgeStorage implements KnowledgeStorage {
  async save(projectId: string, originalFileName: string, buffer: Buffer): Promise<string> {
    const projectDir = path.join(process.cwd(), BASE_DIR, projectId);
    await mkdir(projectDir, { recursive: true });

    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relativePath = path.join(projectId, `${randomUUID()}-${safeName}`);
    const fullPath = path.join(process.cwd(), BASE_DIR, relativePath);

    await writeFile(fullPath, buffer);
    return relativePath;
  }
}

export class VercelBlobKnowledgeStorage implements KnowledgeStorage {
  async save(projectId: string, originalFileName: string, buffer: Buffer): Promise<string> {
    // Imported lazily so `@vercel/blob` is only required when this class is actually used
    // (local dev without a blob token never touches this path).
    const { put } = await import('@vercel/blob');

    const safeName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `knowledge-sources/${projectId}/${randomUUID()}-${safeName}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false
    });

    // Store the full blob URL — it's what any future "download source file" feature would need.
    return blob.url;
  }
}

export const knowledgeStorage: KnowledgeStorage = process.env.BLOB_READ_WRITE_TOKEN
  ? new VercelBlobKnowledgeStorage()
  : new LocalDiskKnowledgeStorage();

// Allow-list kept intentionally narrow for Phase 1 (spec section 4: "PDF, Word, Excel, images").
export const ALLOWED_KNOWLEDGE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp'
];

export const MAX_KNOWLEDGE_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
