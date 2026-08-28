import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3101/reset-requests");
});

async function submit(page: Page, url: string) {
  await page.goto("/library");
  await page.getByLabel(/새 폴더 이름/).fill(`E2E ${Date.now()}-${Math.random()}`);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await page.goto("/");
  await page.getByLabel(/보관 폴더/).selectOption({ index: 1 });
  await page.getByLabel(/URL/i).fill(url);
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출|캡처/ }).click();
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
}

test("shows saved metadata after synchronous fixture capture", async ({ page }) => {
  await submit(page, "http://saved.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Fixture saved title")).toBeVisible();
  await expect(page.getByText("Fixture description")).toBeVisible();
  await expect(page.locator(".badge", { hasText: "저장 완료" })).toBeVisible();
});

test("shows the CSR-rendered view by default with local CSS and no executable script", async ({ page, request }) => {
  await submit(page, "http://rendered.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);

  const rendered = page.frameLocator('iframe[title*="렌더링 결과"]');
  await expect(rendered.getByText("CSR hydrated content")).toBeVisible();
  await expect(rendered.locator("script")).toHaveCount(0);
  await expect(rendered.locator('style, iframe, object, embed, [href^="http"], [src^="http"], [style]')).toHaveCount(0);
  await expect(rendered.locator('link[rel="stylesheet"]')).toHaveCount(3);
  await expect(rendered.getByRole("img", { name: "preserved fixture image" })).toHaveJSProperty("naturalWidth", 1);
  await expect(rendered.locator(".hydrated-card")).toHaveCSS("background-image", /url\(/u);
  const stylesheet = await rendered.locator('link[rel="stylesheet"]').first().getAttribute("href");
  expect(stylesheet).toMatch(/^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.css$/);
  const css = await request.get(stylesheet!);
  expect(css.status()).toBe(200);
  expect(await css.text()).toMatch(/\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.png/);
  expect(await css.text()).toMatch(/\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.woff2/);

  await request.get("http://127.0.0.1:3101/source-offline");
  await page.reload();
  await expect(page.frameLocator('iframe[title*="렌더링 결과"]').getByText("CSR hydrated content")).toBeVisible();
  expect(await request.get("http://127.0.0.1:3101/requests").then((response) => response.json())).toEqual([]);
});

test("shows the sanitized reading view after selecting it", async ({ page }) => {
  const sourceUrl = "http://reading.fixture.test:3101/success";
  await submit(page, sourceUrl);
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);

  await page.getByRole("tab", { name: "읽기" }).click();
  await expect(page.getByRole("heading", { name: "Fixture reading heading" })).toBeVisible();
  await expect(page.getByText("Deterministic article body with")).toBeVisible();
  await expect(page.getByText(sourceUrl, { exact: true })).toBeVisible();
  await expect(page.getByText("캡처 시각")).toBeVisible();
  await expect(page.locator("time[datetime]")).toHaveCount(2);
  const readingPanel = page.getByRole("tabpanel", { name: "읽기" });
  await expect(readingPanel.locator("script, form, iframe")).toHaveCount(0);
  await expect(readingPanel.locator('[action], [style], [onload], [onerror]')).toHaveCount(0);
  for (const value of await readingPanel.locator("[href], [src]").evaluateAll((elements) => elements.map((element) => element.getAttribute("href") ?? element.getAttribute("src")))) {
    expect(value).toMatch(/^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.(?:png|pdf|txt)$/);
  }
});

test("isolates original HTML in a tokenless sandbox without requests or navigation", async ({ page, request }) => {
  await request.get("http://127.0.0.1:3101/reset-requests");
  await submit(page, "http://isolated.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  await page.getByRole("tab", { name: "원문" }).click();
  const frame = page.locator('iframe[title*="원문"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute("sandbox", "");
  await request.get("http://127.0.0.1:3101/reset-requests");
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(detailUrl);
  expect(await request.get("http://127.0.0.1:3101/requests").then((response) => response.json())).toEqual([]);
});

test("shows a safe reason for a failed fixture capture", async ({ page }) => {
  await submit(page, "http://failed.fixture.test:3101/failed");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/HTML 페이지가 아닙니다/)).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator("iframe, article article")).toHaveCount(0);
  await expect(page.getByText(/경로|ENOENT|snapshot\.json|original\.html/i)).toHaveCount(0);
});

test("fails safely when the browser request budget is exceeded", async ({ page }) => {
  await submit(page, "http://storm.fixture.test:3101/request-storm");
  await expect(page.getByText("페이지의 요청 수가 허용된 한도를 초과했습니다.")).toBeVisible();
});

test("preserves accepted assets and remains self-contained after the source goes offline", async ({ page, request }) => {
  await submit(page, "http://assets-page.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);

  await page.getByRole("tab", { name: "읽기" }).click();
  const readable = page.getByRole("tabpanel", { name: "읽기" });
  const image = readable.getByRole("img", { name: "preserved fixture image" });
  await expect(image).toBeVisible();
  const imagePath = await image.getAttribute("src");
  expect(imagePath).toMatch(/^\/archives\/[0-9a-f-]{36}\/assets\/[a-f0-9]{64}\.png$/);

  const pdfPath = await readable.getByRole("link", { name: "fixture PDF" }).getAttribute("href");
  const textPath = await readable.getByRole("link", { name: "fixture text" }).getAttribute("href");
  expect(pdfPath).toMatch(/\.pdf$/);
  expect(textPath).toMatch(/\.txt$/);

  await request.get("http://127.0.0.1:3101/source-offline");
  await page.reload();
  await page.getByRole("tab", { name: "읽기" }).click();
  await expect(page.getByRole("img", { name: "preserved fixture image" })).toBeVisible();

  const imageResponse = await request.get(imagePath!);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");
  expect(imageResponse.headers()["content-disposition"]).toBe("inline");
  expect(imageResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(Number(imageResponse.headers()["content-length"])).toBeGreaterThan(0);

  for (const [path, type] of [[pdfPath!, "application/pdf"], [textPath!, "text/plain"]] as const) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe(type);
    expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="archived-asset\.(?:pdf|txt)"$/);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  }

  await page.getByRole("tab", { name: "원문" }).click();
  const original = page.frameLocator('iframe[title*="원문"]');
  await expect(original.getByRole("img", { name: "preserved fixture image" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(await request.get("http://127.0.0.1:3101/requests").then((response) => response.json())).toEqual([]);
});

test("keeps the archive usable while rejected assets have no remote fallback", async ({ page, request }) => {
  await submit(page, "http://rejections.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.locator(".badge", { hasText: "저장 완료" })).toBeVisible();

  await page.getByRole("tab", { name: "읽기" }).click();
  const readable = page.getByRole("tabpanel", { name: "읽기" });
  for (const name of [
    "rejected unsupported image", "rejected spoofed image", "rejected oversized image",
    "rejected chunked image", "rejected timeout image", "rejected private redirect image", "missing image",
  ]) {
    await expect(readable.getByRole("img", { name })).toHaveCount(0);
  }
  await expect(readable.locator('[src*="fixture.test"], [srcset*="fixture.test"]')).toHaveCount(0);

  await request.get("http://127.0.0.1:3101/source-offline");
  await page.reload();
  await page.getByRole("tab", { name: "원문" }).click();
  await page.waitForTimeout(300);
  expect(await request.get("http://127.0.0.1:3101/requests").then((response) => response.json())).toEqual([]);
});
