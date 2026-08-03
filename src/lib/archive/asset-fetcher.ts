import { ASSET_MIME_TYPES, type AssetFetcher, type AssetMimeType, type CapturedAsset } from "./types";
import { SafeFetchTransport, type FetcherOptions } from "./fetcher";

export class SafeAssetFetcher implements AssetFetcher {
  private readonly transport: SafeFetchTransport;
  constructor(options: FetcherOptions) { this.transport = new SafeFetchTransport(options); }
  async fetch(originalUrl: string, signal?: AbortSignal): Promise<CapturedAsset> {
    const result = await this.transport.fetch(originalUrl, {
      accept: ASSET_MIME_TYPES.join(", "), allowedMimeTypes: ASSET_MIME_TYPES, invalidMimeCode: "unsupported_mime",
    }, signal);
    return { originalUrl, finalUrl: result.finalUrl, mimeType: result.contentType as AssetMimeType, bytes: result.bytes };
  }
}
