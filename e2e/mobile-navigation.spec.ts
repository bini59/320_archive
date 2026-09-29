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

test("opens primary navigation in a drawer with the active route", async ({ page }) => {
  await page.goto("/archives");

  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const navigation = page.getByRole("dialog", { name: "주 메뉴" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "공개 탐색" })).toHaveAttribute("aria-current", "page");

  const metrics = await page.locator("body").evaluate((body) => ({
    width: document.documentElement.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);

  await navigation.getByRole("link", { name: "사이트 등록" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(navigation).toBeHidden();
});

test("nests folder links under the library item", async ({ page }) => {
  const folderName = `Mobile folder ${Date.now()}`;
  await page.goto("/library");
  await page.getByLabel("새 폴더 이름").fill(folderName);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await page.goto("/library");

  await page.getByRole("button", { name: "메뉴 열기" }).click();
  const library = page.getByRole("dialog", { name: "주 메뉴" }).getByRole("listitem").filter({ has: page.getByRole("link", { name: "내 보관함", exact: true }) });
  await expect(library.getByRole("link", { name: "내 보관함", exact: true })).toHaveAttribute("aria-current", "page");
  const folder = library.getByRole("link", { name: folderName });
  await expect(folder).toBeVisible();
  await expect(folder).not.toHaveAttribute("aria-current");
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
