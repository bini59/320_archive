import { expect, test } from "@playwright/test";

test.describe("profile menu", () => {
  test("replaces the sidebar profile entry with a topbar menu popup", async ({ page }) => {
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "프로필 메뉴" });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // The sidebar keeps site preferences but no longer carries a profile link.
    await expect(page.locator(".sidebar-foot .nav-item")).toHaveCount(1);
    await expect(page.locator(".sidebar-foot").getByRole("link", { name: "사이트 환경설정" })).toBeVisible();
    await expect(page.locator('.sidebar a[href*="/client"]')).toHaveCount(0);

    await expect(page.getByRole("menu", { name: "프로필 메뉴" })).toBeHidden();
    await trigger.click();

    const menu = page.getByRole("menu", { name: "프로필 메뉴" });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("menuitem")).toHaveCount(3);

    const accountCenter = menu.getByRole("menuitem", { name: /계정센터/ });
    await expect(accountCenter).toHaveAttribute("href", /^https:\/\/[^/]+\/client$/);
    await expect(accountCenter).toHaveAttribute("target", "_blank");
    await expect(accountCenter).toHaveAttribute("rel", /noopener/);
    await expect(menu.getByRole("menuitem", { name: "환경설정" })).toHaveAttribute("href", "/settings");
    await expect(menu.getByRole("menuitem", { name: "로그아웃" })).toHaveAttribute("type", "submit");
  });

  test("closes on Escape and on an outside click, restoring focus to the trigger", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "프로필 메뉴" });
    const menu = page.getByRole("menu", { name: "프로필 메뉴" });

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.locator(".topbar").click({ position: { x: 4, y: 26 } });
    await expect(menu).toBeHidden();
  });

  test("moves focus through the menu items with the arrow keys", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "프로필 메뉴" }).click();

    const menu = page.getByRole("menu", { name: "프로필 메뉴" });
    await expect(menu.getByRole("menuitem", { name: /계정센터/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "환경설정" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "로그아웃" })).toBeFocused();
    // The last item wraps back to the first, keeping focus inside the popup.
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: /계정센터/ })).toBeFocused();
  });

  test("navigates to preferences from the menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "프로필 메뉴" }).click();
    await page.getByRole("menuitem", { name: "환경설정" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "사이트 환경설정" })).toBeVisible();
    await expect(page.getByRole("menu", { name: "프로필 메뉴" })).toBeHidden();
  });
});
