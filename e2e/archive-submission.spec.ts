import { expect, test, type Page } from "@playwright/test";

async function submit(page: Page, url: string) {
  await page.goto("/");
  await page.getByLabel(/URL/i).fill(url);
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출|캡처/ }).click();
}

test("shows saved metadata after synchronous fixture capture", async ({ page }) => {
  await submit(page, "http://saved.fixture.test:3101/success");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Fixture saved title")).toBeVisible();
  await expect(page.getByText("Fixture description")).toBeVisible();
  await expect(page.locator(".badge", { hasText: "저장 완료" })).toBeVisible();
});

test("shows the sanitized reading view and provenance by default", async ({ page }) => {
  const sourceUrl = "http://reading.fixture.test:3101/success";
  await submit(page, sourceUrl);

  await expect(page.getByRole("heading", { name: "Fixture reading heading" })).toBeVisible();
  await expect(page.getByText("Deterministic article body with")).toBeVisible();
  await expect(page.getByText(sourceUrl, { exact: true })).toBeVisible();
  await expect(page.getByText("캡처 시각")).toBeVisible();
  await expect(page.locator("time[datetime]")).toHaveCount(2);
  await expect(page.locator("script, form, iframe")).toHaveCount(0);
  await expect(page.locator('[href], [src], [srcset], [action]')).toHaveCount(0);
});

test("isolates original HTML in a tokenless sandbox without requests or navigation", async ({ page, request }) => {
  await request.get("http://127.0.0.1:3101/reset-requests");
  await submit(page, "http://isolated.fixture.test:3101/success");
  const detailUrl = page.url();

  await page.getByRole("tab", { name: "원문" }).click();
  const frame = page.locator('iframe[title*="원문"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute("sandbox", "");
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

test("returns a retryable form error at the SQLite submission boundary", async ({ page }) => {
  for (let index = 0; index < 21; index += 1) {
    await submit(page, `http://rate-${index}.fixture.test:3101/success`);
  }
  await expect(page).toHaveURL("/");
  await expect(page.getByText(/요청 한도|잠시 후 다시/)).toBeVisible();
});
