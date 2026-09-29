import { expect, test } from "@playwright/test";

test.describe("profile menu", () => {
  test("sits at the bottom left of the sidebar instead of the topbar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const trigger = page.getByRole("complementary").getByRole("button", { name: /프로필 메뉴/ });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("banner").getByRole("button", { name: /프로필 메뉴/ })).toHaveCount(0);
    const box = (await trigger.boundingBox())!;
    expect(box.x).toBeLessThan(238);
    expect(box.y + box.height).toBeGreaterThan(800 - 60);

    await trigger.click();
    const menu = page.getByRole("menu", { name: "프로필 메뉴" });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu.getByRole("menuitem")).toHaveCount(2);

    const accountCenter = menu.getByRole("menuitem", { name: /계정센터/ });
    await expect(accountCenter).toHaveAttribute("href", /^https:\/\/[^/]+\/client$/);
    await expect(accountCenter).toHaveAttribute("target", "_blank");
    await expect(accountCenter).toHaveAttribute("rel", /noopener/);
    await expect(menu.getByRole("menuitem", { name: "로그아웃" })).toBeVisible();
  });

  test("closes on Escape and on an outside click, and cycles items with arrow keys", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("complementary").getByRole("button", { name: /프로필 메뉴/ });
    const menu = page.getByRole("menu", { name: "프로필 메뉴" });

    await trigger.click();
    await expect(menu.getByRole("menuitem", { name: /계정센터/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "로그아웃" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: /계정센터/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).toBeHidden();
  });

  test("reaches site preferences from the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("complementary").getByRole("link", { name: "사이트 환경설정" }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "사이트 환경설정" })).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("link", { name: "사이트 환경설정" })).toHaveAttribute("aria-current", "page");
  });
});
