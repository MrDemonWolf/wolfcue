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
