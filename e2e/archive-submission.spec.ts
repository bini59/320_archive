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

test("shows a safe reason for a failed fixture capture", async ({ page }) => {
  await submit(page, "http://failed.fixture.test:3101/failed");
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/HTML 페이지가 아닙니다/)).toBeVisible();
});

test("returns a retryable form error at the SQLite submission boundary", async ({ page }) => {
  await submit(page, "http://one.fixture.test:3101/success");
  await submit(page, "http://two.fixture.test:3101/success");
  await submit(page, "http://three.fixture.test:3101/success");
  await expect(page).toHaveURL("/");
  await expect(page.getByText(/요청 한도|잠시 후 다시/)).toBeVisible();
});
