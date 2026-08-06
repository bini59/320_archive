import {
  chromium,
  type Browser,
  type Page,
  type Response as PlaywrightResponse,
  type Route,
} from "playwright";

import { matchesAssetSignature } from "./asset-fetcher";
import { CaptureError, type FetcherOptions } from "./fetcher";
import {
  buildRenderedAssets,
  isRenderedResourceMime,
  type InlineRenderedStyle,
  type RenderedResource,
} from "./rendered";
import type { AssetFetcher, CaptureClient, CaptureContext, CapturedAsset, CapturedPage } from "./types";
import { resolvePublicUrl } from "./url";

export interface BrowserCaptureOptions extends FetcherOptions {
  renderedMaxRequests: number;
  renderedMaxBytes: number;
  renderedSettleTimeoutMs: number;
  assetMaxBytes: number;
  assetTotalMaxBytes: number;
  assetMaxCount: number;
  assetTimeoutMs: number;
  assetFetcher?: AssetFetcher;
  /** Test-only DNS mapping for fixture domains; production relies on normal Chromium DNS. */
  browserHostResolverRules?: string;
}

interface SnapshotDetails {
  inlineStyles: InlineRenderedStyle[];
  styleAttributes: InlineRenderedStyle[];
  attachmentUrls: string[];
}

const HTML_MIME_TYPES = new Set(["text/html", "application/xhtml+xml"]);

function contentType(response: PlaywrightResponse): string {
  return (response.headers()["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BrowserCaptureClient implements CaptureClient {
  private browser: Browser | undefined;
  private browserPromise: Promise<Browser> | undefined;

  constructor(private readonly options: BrowserCaptureOptions) {}

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (!this.browserPromise) {
      const args = ["--disable-dev-shm-usage"];
      if (this.options.browserHostResolverRules) args.push(`--host-resolver-rules=${this.options.browserHostResolverRules}`);
      this.browserPromise = chromium.launch({ headless: true, args }).then((browser) => {
        this.browser = browser;
        return browser;
      });
    }
    return this.browserPromise;
  }

  async capture(input: string, signal?: AbortSignal, captureContext?: CaptureContext): Promise<CapturedPage> {
    if (!captureContext?.archiveId) throw new Error("archive id is required for rendered capture");
    if (signal?.aborted) throw signal.reason instanceof CaptureError ? signal.reason : new CaptureError("timeout");
    const browser = await this.getBrowser();
    const context = await browser.newContext({ serviceWorkers: "block" });
    let page: Page | undefined;
    let initialNavigationComplete = false;
    let timedOut = false;
    let policyError: CaptureError | undefined;
    let requestCount = 0;
    let resourceBytes = 0;
    const resources = new Map<string, RenderedResource>();
    const responseTasks = new Set<Promise<void>>();
    const deadline = Date.now() + this.options.timeoutMs;
    const remaining = () => Math.max(1, deadline - Date.now());
    const timeout = setTimeout(() => {
      timedOut = true;
      void page?.close().catch(() => undefined);
    }, this.options.timeoutMs);
    const onAbort = () => {
      timedOut = true;
      void page?.close().catch(() => undefined);
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const recordResponse = async (response: PlaywrightResponse): Promise<void> => {
      const mime = contentType(response);
      if (response.status() < 200 || response.status() >= 300 || !isRenderedResourceMime(mime)) return;
      const declaredLength = Number(response.headers()["content-length"]);
      if (Number.isSafeInteger(declaredLength) && declaredLength > this.options.assetMaxBytes) {
        return;
      }
      const body = await response.body();
      if (body.byteLength > this.options.assetMaxBytes || resourceBytes + body.byteLength > this.options.assetTotalMaxBytes) {
        return;
      }
      if (!matchesAssetSignature(mime, body)) return;
      const requestUrl = response.request().url();
      if (resources.has(requestUrl)) return;
      resourceBytes += body.byteLength;
      resources.set(requestUrl, {
        requestUrl,
        finalUrl: response.url(),
        mimeType: mime,
        bytes: body,
      });
    };

    const onResponse = (response: PlaywrightResponse) => {
      const task = recordResponse(response).catch((error) => {
        if (error instanceof CaptureError) policyError ??= error;
      }).finally(() => responseTasks.delete(task));
      responseTasks.add(task);
    };

    try {
      await context.addInitScript(() => {
        document.addEventListener("submit", (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        }, true);
        Object.defineProperty(navigator, "sendBeacon", { value: () => false, configurable: false });
        Object.defineProperty(window, "open", { value: () => null, configurable: false });
      });
      await context.route("**/*", async (route: Route) => {
        const request = route.request();
        const resourceType = request.resourceType();
        requestCount += 1;
        if (requestCount > this.options.renderedMaxRequests) {
          policyError ??= new CaptureError("too_many_requests");
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        if (page && request.isNavigationRequest() && request.frame() !== page.mainFrame()) {
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        if (initialNavigationComplete && request.isNavigationRequest() && page && request.frame() === page.mainFrame()) {
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        if (request.method() !== "GET" || resourceType === "websocket" || resourceType === "ping" || resourceType === "media" || resourceType === "eventsource") {
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        let requestUrl: URL;
        try {
          requestUrl = new URL(request.url());
        } catch {
          if (request.isNavigationRequest()) policyError ??= new CaptureError("invalid_url");
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        if (!/^https?:$/i.test(requestUrl.protocol)) {
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        let redirectCount = 0;
        for (let redirected = request.redirectedFrom(); redirected; redirected = redirected.redirectedFrom()) redirectCount += 1;
        if (redirectCount > this.options.maxRedirects) {
          if (request.isNavigationRequest()) policyError ??= new CaptureError("redirect");
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        try {
          const resolved = await resolvePublicUrl(request.url(), this.options.resolver);
          this.options.connectionAddress?.(resolved.addresses[0].address, resolved.url);
        } catch {
          if (request.isNavigationRequest()) policyError ??= new CaptureError("invalid_url");
          await route.abort("blockedbyclient").catch(() => undefined);
          return;
        }
        await route.continue();
      });
      context.on("page", (child) => {
        if (page && child !== page) void child.close().catch(() => undefined);
      });
      const activePage = page = await context.newPage();
      activePage.on("response", onResponse);

      const navigation = await activePage.goto(input, { waitUntil: "domcontentloaded", timeout: remaining() });
      if (!navigation) throw new CaptureError("network");
      initialNavigationComplete = true;
      const navigationType = contentType(navigation);
      if (!HTML_MIME_TYPES.has(navigationType)) throw new CaptureError("not_html");
      const original = await navigation.body();
      if (original.byteLength > this.options.maxBytes) throw new CaptureError("too_large");

      const settleTimeout = Math.min(this.options.renderedSettleTimeoutMs, remaining());
      await activePage.waitForLoadState("networkidle", { timeout: settleTimeout }).catch(() => undefined);
      await activePage.waitForFunction(() => !document.fonts || document.fonts.status === "loaded", { timeout: Math.min(settleTimeout, remaining()) }).catch(() => undefined);
      await Promise.race([Promise.allSettled(Array.from(responseTasks)), delay(remaining())]);
      if (timedOut || signal?.aborted) throw new CaptureError("timeout");
      if (policyError) throw policyError;

      const details = await activePage.evaluate<SnapshotDetails>(() => ({
        inlineStyles: Array.from(document.querySelectorAll("style")).map((node) => ({ css: node.textContent ?? "", baseUrl: document.baseURI })),
        styleAttributes: Array.from(document.querySelectorAll("[style]")).map((node) => ({ css: node.getAttribute("style") ?? "", baseUrl: document.baseURI })),
        attachmentUrls: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((node) => node.href)
          .filter((url) => /\.(?:pdf|txt)(?:[?#]|$)/iu.test(url)),
      }));
      const attachments = await this.captureAttachments(
        details.attachmentUrls,
        remaining(),
        Math.max(0, this.options.assetTotalMaxBytes - resourceBytes),
        signal,
      );
      const built = buildRenderedAssets({
        archiveId: captureContext.archiveId,
        resources: resources.values(),
        additionalAssets: attachments,
        inlineStyles: details.inlineStyles,
        styleAttributes: details.styleAttributes,
      });
      const renderedText = await activePage.evaluate((inputData) => {
        const paths = new Map(inputData.resourcePaths);
        const localAssetPath = /^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.(?:jpg|png|gif|webp|avif|pdf|txt|css|woff|woff2|ttf|otf|eot)$/iu;
        const lookup = (raw: string | null): string | null => {
          if (!raw) return null;
          if (localAssetPath.test(raw)) return raw;
          try {
            const url = new URL(raw, document.baseURI);
            url.hash = "";
            return paths.get(url.href) ?? null;
          } catch {
            return null;
          }
        };
        const rewriteSrcset = (element: Element) => {
          const value = element.getAttribute("srcset");
          if (!value) return;
          const next = value.split(",").map((part) => {
            const bits = part.trim().split(/\s+/u);
            const path = lookup(bits[0] ?? null);
            return path ? [path, ...bits.slice(1)].join(" ") : null;
          }).filter((part): part is string => Boolean(part));
          if (next.length) element.setAttribute("srcset", next.join(", "));
          else element.removeAttribute("srcset");
        };

        const styles = Array.from(document.querySelectorAll("style"));
        styles.forEach((node, index) => {
          const path = inputData.inlineStylePaths[index];
          if (!path) {
            node.remove();
            return;
          }
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = path;
          node.replaceWith(link);
        });
        Array.from(document.querySelectorAll("[style]")).forEach((node, index) => {
          if (inputData.styleAttributePath && inputData.styleAttributeClassPrefix) node.classList.add(`${inputData.styleAttributeClassPrefix}-${index}`);
          node.removeAttribute("style");
        });
        Array.from(document.querySelectorAll("link")).forEach((node) => {
          const rel = (node.getAttribute("rel") ?? "").toLowerCase().split(/\s+/u);
          if (!rel.includes("stylesheet")) {
            node.remove();
            return;
          }
          const path = lookup(node.getAttribute("href"));
          if (!path) node.remove();
          else {
            node.setAttribute("href", path);
            node.removeAttribute("integrity");
            node.removeAttribute("crossorigin");
          }
        });
        if (inputData.styleAttributePath) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = inputData.styleAttributePath;
          (document.head ?? document.documentElement).append(link);
        }
        Array.from(document.querySelectorAll("img, source, input[type=image]")).forEach((node) => {
          const path = lookup(node.getAttribute("src"));
          if (path) node.setAttribute("src", path);
          else node.removeAttribute("src");
          rewriteSrcset(node);
        });
        Array.from(document.querySelectorAll("a[href]")).forEach((node) => {
          const href = node.getAttribute("href");
          const path = lookup(href);
          if (path) node.setAttribute("href", path);
          else if (href && !href.startsWith("#")) node.removeAttribute("href");
        });
        document.querySelectorAll("[src]").forEach((node) => {
          if (!node.matches("img, source, input[type=image]")) node.removeAttribute("src");
        });
        document.querySelectorAll("[href]").forEach((node) => {
          if (!node.matches("a, link")) node.removeAttribute("href");
        });
        document.querySelectorAll("script, noscript, iframe, object, embed, video, audio, svg, canvas, base, meta[http-equiv]").forEach((node) => node.remove());
        document.querySelectorAll("form").forEach((node) => {
          node.removeAttribute("action");
          node.removeAttribute("method");
          node.removeAttribute("target");
        });
        document.querySelectorAll("*").forEach((node) => {
          Array.from(node.attributes).forEach((attribute) => {
            if (/^on/iu.test(attribute.name) || /^formaction$/iu.test(attribute.name) || /^srcdoc$/iu.test(attribute.name)) node.removeAttribute(attribute.name);
          });
        });
        document.querySelectorAll("[poster], [data]").forEach((node) => {
          node.removeAttribute("poster");
          node.removeAttribute("data");
        });
        return document.documentElement.outerHTML;
      }, {
        resourcePaths: Array.from(built.resourcePaths.entries()),
        inlineStylePaths: built.inlineStylePaths,
        styleAttributePath: built.styleAttributePath,
        styleAttributeClassPrefix: built.styleAttributeClassPrefix,
      });
      const rendered = Buffer.from(`<!doctype html>${renderedText}`);
      const storedAssets = built.assets;
      const storedAssetBytes = storedAssets.reduce((total, asset) => total + asset.bytes.byteLength, 0);
      if (rendered.byteLength > this.options.renderedMaxBytes || storedAssetBytes > this.options.assetTotalMaxBytes) throw new CaptureError("too_large");
      return { bytes: original, finalUrl: navigation.url(), contentType: navigationType, rendered, renderedAssets: storedAssets };
    } catch (error) {
      if (timedOut || signal?.aborted) throw new CaptureError("timeout");
      if (error instanceof CaptureError) throw error;
      if (policyError) throw policyError;
      throw new CaptureError("network");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      await context.close().catch(() => undefined);
    }
  }

  private async captureAttachments(urls: string[], timeoutMs: number, byteBudget: number, signal?: AbortSignal): Promise<CapturedAsset[]> {
    if (!this.options.assetFetcher) return [];
    const unique = Array.from(new Set(urls)).slice(0, this.options.assetMaxCount);
    const assets: CapturedAsset[] = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs, this.options.assetTimeoutMs)));
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      for (const url of unique) {
        if (controller.signal.aborted) break;
        try {
          const asset = await this.options.assetFetcher.fetch(url, controller.signal);
          if (asset.bytes.byteLength > this.options.assetMaxBytes) continue;
          if (assets.reduce((total, item) => total + item.bytes.byteLength, 0) + asset.bytes.byteLength > byteBudget) break;
          assets.push(asset);
        } catch {
          // Optional attachment failures are represented by a removed link.
        }
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    return assets;
  }

  async close(): Promise<void> {
    const browser = this.browser ?? await this.browserPromise?.catch(() => undefined);
    this.browser = undefined;
    this.browserPromise = undefined;
    await browser?.close();
  }
}
