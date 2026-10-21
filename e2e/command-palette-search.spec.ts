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

test("command palette leaves focus alone on load and returns it to the trigger on close", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "검색 열기" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(trigger).not.toBeFocused();

  await page.keyboard.press("Control+k");
  await expect(page.locator("#command-search")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#command-search")).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(page.locator("#command-search")).toBeFocused();
  await page.locator(".palette-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#command-search")).toBeHidden();
  await expect(trigger).toBeFocused();
});
