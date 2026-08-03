export const ARCHIVE_STATUS = "pending" as const;

export type ArchiveStatus = typeof ARCHIVE_STATUS;

export interface Archive {
  id: string;
  originalUrl: string;
  normalizedUrl: string;
  status: ArchiveStatus;
  createdAt: string;
}

export interface ArchiveCreationResult {
  archive: Archive;
  created: boolean;
}

export interface ArchiveRepository {
  createOrGet(input: {
    originalUrl: string;
    normalizedUrl: string;
  }): ArchiveCreationResult;
  findById(id: string): Archive | null;
  close(): void;
}

export interface ArchiveMetadataStore {
  ensure(archive: Archive): Promise<void>;
}
