import { test, expect } from "@playwright/test";

test("canvas renders and is non-blank", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "CAT LINE DEFENSE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "JOGAR" })).toBeVisible();
  await page.getByRole("button", { name: "JOGAR" }).click();
  await expect(page.locator("#hud-coins")).toHaveText("80", { timeout: 30000 });
  await expect(page.locator("#hud-level")).toHaveText("1");
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.click(box.x + box.width * (122 / 1280), box.y + box.height * (224 / 720));
    await expect(page.locator("#hud-coins")).toHaveText("30", { timeout: 5000 });
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(100);
  }
});
