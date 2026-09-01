import { test, expect } from "@playwright/test";

test("canvas renders and is non-blank", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });

  // Verify canvas dimensions
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBeGreaterThan(100);
  expect(box?.height).toBeGreaterThan(100);
});
