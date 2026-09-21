import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("주요 학생회 화면 스크린샷", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet-portrait");
  const target = path.join(process.cwd(), "docs", "screenshots");
  await fs.mkdir(target, { recursive: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await expect(page.getByLabel("활동 PIN")).toBeVisible();
  await page.screenshot({ path: path.join(target, "council-locked-768x1024.png"), fullPage: true });

  await page.getByLabel("활동 PIN").fill("246810");
  await page.getByRole("button", { name: "활동 열기" }).click();
  await page.getByLabel("담당자 이름").fill("김민수");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await page.getByLabel("학생 검색").fill("김민준");
  await expect(page.getByRole("button", { name: /김민준/ }).first()).toBeVisible();
  await page.screenshot({ path: path.join(target, "council-search-768x1024.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(target, "council-search-390x844.png"), fullPage: true });
});
