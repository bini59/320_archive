import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:3101/reset-requests");
});

async function createArchive(page: Page) {
  await page.goto("/library");
  const folderName = `Mobile ${Date.now()}-${Math.random()}`;
  await page.getByLabel("새 폴더 이름").fill(folderName);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await page.goto("/");
  await page.getByLabel("보관 폴더").selectOption({ label: folderName });
  await page.getByLabel(/URL/i).fill("http://mobile-tabs.fixture.test:3101/success");
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출|캡처/ }).click();
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
}

test("keeps primary navigation fixed at the mobile bottom with an active route", async ({ page }) => {
  await page.goto("/archives");

  const navigation = page.locator(".mobile-nav .nav-mobile");
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveCSS("position", "fixed");
  await expect(navigation).toHaveCSS("bottom", "0px");
  await expect(navigation.getByRole("link", { name: "공개 탐색" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link")).toHaveCount(3);

  const metrics = await page.locator("body").evaluate((body) => ({
    width: document.documentElement.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
});

test("keeps folder links separate from the primary bottom navigation", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("새 폴더 이름").fill(`Mobile folder ${Date.now()}`);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await page.goto("/library");

  const primary = page.locator(".mobile-nav .nav-mobile");
  const folders = page.locator(".mobile-nav .mobile-nav-folders");
  await expect(primary).toBeVisible();
  await expect(folders).toBeVisible();
  await expect(folders).toHaveCSS("overflow-x", "auto");
  await expect(primary.getByRole("link")).toHaveCount(3);
  await expect(folders.getByRole("link").first()).toHaveAttribute("aria-current", "page");
});

test("supports keyboard navigation across viewer tabs without clipping", async ({ page }) => {
  await createArchive(page);

  const tabs = page.getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("End");
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth((await tabs.count()) - 2)).toBeFocused();

  const tabList = page.getByRole("tablist");
  const metrics = await tabList.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
});
