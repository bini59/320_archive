import { expect, test } from "@playwright/test";

test("command palette search replaces the public archive search field value", async ({ page }) => {
  await page.goto("/archives?q=first");
  const search = page.locator("#archive-search");
  await expect(search).toHaveValue("first");
  await search.fill("draft");

  await page.keyboard.press("Control+k");
  await page.locator("#command-search").fill("second");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/archives\?q=second$/);
  await expect(search).toHaveValue("second");
});
