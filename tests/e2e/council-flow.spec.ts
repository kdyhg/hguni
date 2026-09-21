import { expect, test } from "@playwright/test";

test("PIN에서 벌점 접수까지 단순 흐름을 완료한다", async ({ page }, testInfo) => {
  const student = testInfo.project.name === "mobile" ? "최유나" : "박서준";
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "아침 선도" })).toBeVisible();
  await page.getByLabel("활동 PIN").fill("246810");
  await page.getByRole("button", { name: "활동 열기" }).click();
  await page.getByLabel("담당자 이름").fill("학생회 테스트");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.getByLabel("학생 검색").fill(student);
  await page.getByRole("button", { name: new RegExp(student) }).click();
  await page.getByRole("button", { name: /복장불량/ }).click();
  await page.getByRole("button", { name: /복장불량 · 벌점 2점 부과/ }).click();
  await expect(page.getByText(/접수했습니다/)).toBeVisible();
  await expect(page.getByText(new RegExp(`${student}.*복장불량`))).toBeVisible();
});

test("교사 시험 계정으로 로그인한다", async ({ page }) => {
  await page.goto("/teacher/login");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole("heading", { name: "오늘 내역" })).toBeVisible();
});
