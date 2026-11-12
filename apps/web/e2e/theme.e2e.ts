import { expect, test } from "@playwright/test";

test("system follows appearance, explicit theme persists before app bundle", async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto("./");
	await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
	expect(
		await page
			.locator("body")
			.evaluate((el) => getComputedStyle(el).colorScheme),
	).toContain("dark");
	await page.locator("#editor-settings").click();
	await page.locator("#theme input[value=light]").check();
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await page.route("**/assets/*.js", (route) => route.abort());
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("quick theme switch follows system, persists, and stays in sync with Settings", async ({
	page,
}) => {
	await page.setViewportSize({ width: 200, height: 180 });
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("./");
	const toggle = page.locator("#theme-toggle");
	await expect(toggle).toHaveAccessibleName("Switch to dark theme");
	await expect(page.locator("#theme-moon")).toBeVisible();
	await expect(page.locator("#theme-sun")).toBeHidden();
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(toggle).toHaveAccessibleName("Switch to light theme");
	await expect(page.locator("#theme-sun")).toBeVisible();
	await expect(page.locator("#theme-moon")).toBeHidden();
	for (const selector of ["#theme-toggle", "#editor-settings"]) {
		const box = await page.locator(selector).boundingBox();
		if (!box) throw new Error("Header control missing");
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x + box.width).toBeLessThanOrEqual(200);
	}
	await toggle.click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await expect(toggle).toHaveAccessibleName("Switch to dark theme");
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await toggle.click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await page.locator("#editor-settings").click();
	await expect(page.locator("#theme input[value=dark]")).toBeChecked();
	await page.locator("#theme input[value=system]").check();
	await page.locator('[data-close="settings-dialog"]').click();
	await expect(toggle).toHaveAccessibleName("Switch to light theme");
	await page.emulateMedia({ colorScheme: "light" });
	await expect(toggle).toHaveAccessibleName("Switch to dark theme");
});
