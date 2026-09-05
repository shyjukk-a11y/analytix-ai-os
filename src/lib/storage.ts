import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Knowledge-source file storage abstraction (spec section 4 / 28).
 *
 * Phase 1 uses local disk so the app runs with zero external dependencies. Swap
 * `LocalDiskKnowledgeStorage` for an S3-compatible implementation later without touching
 * callers — they only depend on the `KnowledgeStorage` interface.
 */
export interface KnowledgeStorage {
  /** Persists a file and returns a storage-relative path to save on the KnowledgeSource row. */
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

export const knowledgeStorage: KnowledgeStorage = new LocalDiskKnowledgeStorage();

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
