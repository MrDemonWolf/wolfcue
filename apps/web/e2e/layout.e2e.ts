import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

test("reader controls fit, touch targets and compact keep-out zone remain clear", async ({
	page,
}) => {
	await openApp(page);
	await start(page);
	await page.locator("#toggle-play").click();
	const initial = page.viewportSize();
	for (const size of [
		initial,
		{ width: 220, height: 250 },
		{ width: 250, height: 180 },
		{ width: 200, height: 180 },
	]) {
		if (!size) continue;
		await page.setViewportSize(size);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		for (const control of await page
			.locator("#reader button, #reader input")
			.all()) {
			if (!(await control.isVisible())) continue;
			const box = await control.boundingBox();
			expect(box).not.toBeNull();
			if (!box) continue;
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
			if (size.width <= 300 || size.height <= 300)
				expect(
					box.x + box.width <= size.width - 60 ||
						box.y + box.height <= size.height - 60,
				).toBe(true);
		}
	}
});
test("mirror flips script only and unsupported fullscreen remains hidden", async ({
	page,
}) => {
	await openApp(page);
	await start(page);
	await page.locator("#reader-settings").click();
	await page.locator("#mirror").check();
	await expect(page.locator("#fullscreen-setting-row")).toBeHidden();
	await expect(page.locator("#fullscreen-toggle")).toBeHidden();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	expect(
		await page
			.locator("#script-content")
			.evaluate(
				(e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m11,
			),
	).toBe(-1);
	expect(
		await page
			.locator("#toggle-play")
			.evaluate((e) => getComputedStyle(e).transform),
	).toBe("none");
});
