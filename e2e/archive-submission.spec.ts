import { expect, test, type Page } from "@playwright/test";

const publicUrl = "https://example.com/e2e-archive?source=playwright#result";

async function submit(page: Page, url: string) {
  await page.getByLabel(/URL/i).fill(url);
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출/ }).click();
}

test("a public URL redirects to its stable pending archive detail", async ({ page }) => {
  await page.goto("/");
  await submit(page, publicUrl);

  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  await expect(page.getByText(publicUrl, { exact: true })).toBeVisible();
  await expect(page.getByText("pending", { exact: true }).first()).toBeVisible();

  const firstDetailUrl = page.url();
  await page.goto("/");
  await submit(page, publicUrl);
  await expect(page).toHaveURL(firstDetailUrl);
});

for (const [name, input, message] of [
  ["unsupported scheme", "ftp://example.com/file", /HTTP 또는 HTTPS/],
  ["localhost", "http://localhost/private", /로컬 주소/],
  ["private network", "http://192.168.1.10/private", /내부 네트워크 주소/],
  ] as const) {
  test(`shows a server validation error for ${name} input`, async ({ page }) => {
    await page.goto("/");
    await submit(page, input);

    await expect(page).toHaveURL("/");
    await expect(page.getByText(message)).toBeVisible();
  });
}

test("shows a 404 page for an unknown archive UUID", async ({ page }) => {
  const response = await page.goto("/archives/00000000-0000-4000-8000-000000000000");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /찾을 수 없|없습니다|404/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /홈|돌아가기/ })).toBeVisible();
});
