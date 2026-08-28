import { expect, test } from "@playwright/test";

test.describe("responsive archive lists", () => {
  test("keeps the public search toolbar and empty result usable on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/archives?q=does-not-exist-in-this-test");

    const toolbar = page.locator(".public-archives-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "아카이브 검색" })).toBeVisible();
    await expect(page.getByRole("button", { name: "검색", exact: true })).toBeVisible();
    await expect(page.locator(".public-archives-empty")).toContainText("결과가 없습니다");

    const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await page.locator("main.public-archives-page").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);
    expect(await toolbar.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);
  });

  test("wraps long folder names without horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/library");

    const folderName = `긴 폴더 이름 ${Date.now()} ${"이름".repeat(18)}`;
    await page.getByLabel("새 폴더 이름").fill(folderName);
    await page.getByRole("button", { name: "폴더 만들기" }).click();
    await expect(page.locator(".library-folder-grid")).toBeVisible();

    const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const folder = page.locator(".library-folder-card", { hasText: folderName });
    await expect(folder).toBeVisible();
    expect(await folder.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);
    expect(await page.locator("main.library-page").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(pageWidth);
  });
});
