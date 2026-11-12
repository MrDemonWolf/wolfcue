import { expect, test } from "@playwright/test";
import { openApp, openReaderControls, start } from "./helpers";

test("essential controls have names, visible focus, and hidden views are inert", async ({
	page,
}) => {
	await openApp(page);
	for (const button of await page.getByRole("button").all())
		await expect(button).toHaveAccessibleName(/\S/);
	await page.locator("#start-reading").focus();
	expect(
		await page.locator("#start-reading").evaluate((el) => {
			const css = getComputedStyle(el);
			return (
				css.outlineStyle !== "none" && Number.parseFloat(css.outlineWidth) >= 2
			);
		}),
	).toBe(true);
	await start(page);
	await expect(page.locator("#editor")).toHaveAttribute("inert", "");
	await page.locator("#toggle-play").click();
	await openReaderControls(page);
	await page.locator("#exit-reader").click();
	await expect(page.locator("#reader")).toHaveAttribute("inert", "");
});
test("settings icons have accessible names and usable touch targets", async ({
	page,
}) => {
	await page.setViewportSize({ width: 200, height: 180 });
	await openApp(page);
	for (const selector of ["#editor-settings", "#reader-settings"]) {
		if (selector === "#reader-settings") await start(page);
		const button = page.locator(selector);
		await expect(button).toHaveAccessibleName("Settings");
		const box = await button.boundingBox();
		if (!box) throw new Error("Settings button missing");
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		await button.focus();
		await page.keyboard.press("Enter");
		await expect(page.locator("#settings-dialog")).toBeVisible();
		await page.locator('[data-close="settings-dialog"]').click();
		await expect(button).toBeFocused();
	}
});
