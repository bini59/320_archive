import { expect, test, type Page } from "@playwright/test";

async function createFolderAndArchive(page: Page) {
  await page.goto("/library");
  await page.getByLabel("새 폴더 이름").fill(`카드 테스트 ${Date.now()}`);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await expect(page.locator(".library-folder-card").last()).toBeVisible();
  const folderUrl = await page.locator(".library-folder-card").last().getAttribute("href");

  const longQuery = "title=" + "긴주소".repeat(32);
  await page.goto("/");
  await page.getByLabel(/보관 폴더/).selectOption({ index: 1 });
  await page.getByLabel(/URL/i).fill(`http://cards.fixture.test:3101/success?${longQuery}`);
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출|캡처/ }).click();
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await page.goto(folderUrl!);
}

test.describe("folder archive cards", () => {
  test("uses cards on mobile with all archive actions and stays within the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createFolderAndArchive(page);

    const card = page.locator(".folder-archive-card");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Fixture saved title");
    await expect(card).toContainText("cards.fixture.test:3101");
    await expect(card).toContainText("저장일");
    await expect(card.getByRole("combobox")).toBeVisible();
    await expect(card.getByRole("button", { name: "저장" })).toBeVisible();
    await expect(card.getByRole("link", { name: "열기" })).toBeVisible();

    const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await card.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);
    expect(await page.locator("main").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);

    await card.getByRole("combobox").selectOption("public");
    await card.getByRole("button", { name: "저장" }).click();
    await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
    await expect(page.locator(".folder-archive-card").getByRole("combobox")).toHaveValue("public");
  });

  test("keeps the archive table for desktop and hides the mobile card list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await createFolderAndArchive(page);

    await expect(page.locator(".folder-archive-table")).toBeVisible();
    await expect(page.locator(".folder-archive-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".folder-archive-cards")).toBeHidden();
    await expect(page.locator(".folder-archive-table").getByRole("combobox")).toBeVisible();
    await expect(page.locator(".folder-archive-table").getByRole("link", { name: "열기" })).toBeVisible();
  });
});
