import { resolveArchiveConfig, type ArchiveConfigInput } from "./config";
import { SqliteArchiveRepository } from "./database";
import { LocalArchiveMetadataStore } from "./storage";
import type { Archive, ArchiveCreationResult, ArchiveMetadataStore, ArchiveRepository } from "./types";
import { normalizeArchiveUrl } from "./url";

export class ArchiveService {
  private readonly repository: ArchiveRepository;
  private readonly metadataStore: ArchiveMetadataStore;

  constructor(
    repository: ArchiveRepository,
    metadataStore: ArchiveMetadataStore,
  ) {
    this.repository = repository;
    this.metadataStore = metadataStore;
  }

  async create(originalUrl: string): Promise<ArchiveCreationResult> {
    const normalizedUrl = normalizeArchiveUrl(originalUrl);
    const result = this.repository.createOrGet({ originalUrl, normalizedUrl });
    await this.metadataStore.ensure(result.archive);
    return result;
  }

  findById(id: string): Archive | null {
    return this.repository.findById(id);
  }

  close(): void {
    this.repository.close();
  }
}

export function createArchiveService(input: ArchiveConfigInput = {}): ArchiveService {
  const config = resolveArchiveConfig(input);
  return new ArchiveService(
    new SqliteArchiveRepository(config.databasePath),
    new LocalArchiveMetadataStore(config.archiveRoot),
  );
}

let defaultService: ArchiveService | undefined;

export function getArchiveService(): ArchiveService {
  defaultService ??= createArchiveService();
  return defaultService;
}
