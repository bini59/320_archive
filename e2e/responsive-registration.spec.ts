import { expect, test, type Page } from "@playwright/test";

async function openRegistrationForm(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "사이트 등록" })).toBeVisible();
  await expect(page.locator(".archive-form-fields")).toBeVisible();
}

test("keeps the registration form within the viewport on narrow mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openRegistrationForm(page);

  const layout = await page.locator("main").evaluate((main) => {
    const form = main.querySelector(".archive-form-fields");
    const urlRow = main.querySelector(".archive-form-url-row");
    const url = main.querySelector<HTMLInputElement>("#archive-url");
    const submit = main.querySelector<HTMLButtonElement>("button[type=submit]");
    if (!form || !urlRow || !url || !submit) throw new Error("registration form contract missing");
    const formRect = form.getBoundingClientRect();
    const urlRect = url.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      formRight: formRect.right,
      urlRowDisplay: getComputedStyle(urlRow).display,
      urlWidth: urlRect.width,
      submitWidth: submitRect.width,
      formWidth: formRect.width,
    };
  });

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.formRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.urlRowDisplay).toBe("grid");
  expect(layout.urlWidth).toBeGreaterThan(0);
  expect(layout.submitWidth).toBeCloseTo(layout.formWidth, 0);
});

test("uses the available width for a balanced tablet URL row", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openRegistrationForm(page);

  const layout = await page.locator(".archive-form-url-row").evaluate((row) => {
    const input = row.querySelector("input");
    const button = row.querySelector("button");
    if (!input || !button) throw new Error("URL row contract missing");
    return {
      display: getComputedStyle(row).display,
      rowWidth: row.getBoundingClientRect().width,
      inputWidth: input.getBoundingClientRect().width,
      buttonWidth: button.getBoundingClientRect().width,
    };
  });

  expect(layout.display).toBe("grid");
  expect(layout.inputWidth).toBeGreaterThan(layout.buttonWidth);
  expect(layout.inputWidth + layout.buttonWidth).toBeLessThanOrEqual(layout.rowWidth);
});

test("gives form controls semantic groups that can wrap long validation text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegistrationForm(page);

  await expect(page.locator(".archive-form-folder")).toContainText("보관 폴더");
  await expect(page.locator(".archive-form-visibility")).toContainText("공개 설정");
  await expect(page.locator(".archive-form-tags")).toContainText("태그");
  await expect(page.locator(".archive-form-errors")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
