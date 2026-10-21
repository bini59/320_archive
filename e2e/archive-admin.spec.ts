import { expect, test } from "@playwright/test";

const ADMIN_SECRET = "e2e-admin-secret-value";

test("admin edits tags and deletes an archive while public visitors see no controls", async ({ page }) => {
  const run = `run${Date.now()}`;
  await page.goto("/library");
  await page.getByLabel(/새 폴더 이름/).fill(`Admin ${run}`);
  await page.getByRole("button", { name: "폴더 만들기" }).click();
  await page.goto("/");
  await page.getByLabel(/보관 폴더/).selectOption({ index: 1 });
  await page.getByLabel("공개 설정").selectOption("public");
  await page.getByLabel(/URL/i).fill(`http://saved.fixture.test:3101/success?${run}`);
  await page.getByLabel(/태그/).fill(`Old${run}, Keep${run}`);
  await page.getByRole("button", { name: /아카이브 추가|보관|저장|제출|캡처/ }).click();
  await expect(page).toHaveURL(/\/archives\/[0-9a-f-]{36}$/);
  const detailUrl = page.url();

  await expect(page.getByText("Fixture saved title").first()).toBeVisible();
  await expect(page.getByText("태그 편집")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "아카이브 삭제" })).toHaveCount(0);

  await page.goto("/admin");
  await page.getByLabel("관리자 비밀키").fill("wrong-secret-value");
  await page.getByRole("button", { name: "인증" }).click();
  await expect(page.getByText("관리자 비밀키가 올바르지 않습니다.")).toBeVisible();
  await page.getByLabel("관리자 비밀키").fill(ADMIN_SECRET);
  await page.getByRole("button", { name: "인증" }).click();
  await expect(page).toHaveURL(/\/archives$/);

  await page.goto(detailUrl);
  const tags = page.getByLabel("태그 편집");
  await expect(tags).toHaveValue(`Keep${run}, Old${run}`);
  await tags.fill("bad#tag");
  await page.getByRole("button", { name: "태그 저장" }).click();
  await expect(page.getByText("태그 형식이 올바르지 않습니다.")).toBeVisible();

  await tags.fill(`Keep${run}, New ${run}`);
  await page.getByRole("button", { name: "태그 저장" }).click();
  await expect(page.getByText("태그를 저장했습니다.")).toBeVisible();
  await expect(page.locator("aside .chip", { hasText: `#New ${run}` })).toBeVisible();
  await expect(page.locator("aside .chip", { hasText: `#Old${run}` })).toHaveCount(0);
  await page.screenshot({ path: "test-results/archive-admin-panel.png", fullPage: true });

  await page.goto(`/archives?tag=new-${run}`);
  await expect(page.locator(".public-archive-card")).toHaveCount(1);
  await page.goto(`/archives?tag=old${run}`);
  await expect(page.locator(".public-archive-card")).toHaveCount(0);

  await page.goto(detailUrl);
  await page.getByRole("button", { name: "아카이브 삭제" }).click();
  await expect(page.getByText("영구 삭제됩니다")).toBeVisible();
  await page.screenshot({ path: "test-results/archive-admin-delete-confirm.png", fullPage: true });
  await page.getByRole("button", { name: "영구 삭제" }).click();
  await expect(page).toHaveURL(/\/archives\?deleted=1$/);
  await expect(page.getByText("아카이브를 삭제했습니다.")).toBeVisible();

  await page.goto(`/archives?tag=keep${run}`);
  await expect(page.locator(".public-archive-card")).toHaveCount(0);
  await page.goto(detailUrl);
  await expect(page.getByText("아카이브를 찾을 수 없습니다")).toBeVisible();
  await expect(page.getByText("Fixture saved title")).toHaveCount(0);
});
