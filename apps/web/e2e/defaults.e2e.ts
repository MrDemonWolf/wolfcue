import { expect, test } from "@playwright/test";
import { openApp, openFrozen, start } from "./helpers";

test("Target time starts reachable and the estimate stays honest", async ({
	page,
}) => {
	await openApp(page);
	await expect(page.locator("#script-stats")).toHaveText(
		"495 words · about 3:18",
	);
	await page.locator('#pace-mode input[value="target"]').check();
	await expect(page.locator("#target-seconds")).toHaveValue("200");
	await expect(page.locator("#script-stats")).toHaveText(
		"495 words · about 3:20",
	);
	await page.locator("#target-seconds").fill("60");
	await page.locator("#target-seconds").dispatchEvent("change");
	await expect(page.locator("#script-stats")).toHaveText(
		"495 words · about 1:39 · capped at 300 wpm",
	);
});

test("countdown leaves the opening line visible below it", async ({ page }) => {
	await openFrozen(page, { countdown: true });
	await start(page);
	await expect(page.locator("#countdown")).toHaveText("3");
	const geometry = await page.evaluate(() => {
		const box = (selector: string) => {
			const element = document.querySelector(selector);
			if (!element) throw new Error(`Missing ${selector}`);
			return element.getBoundingClientRect().toJSON() as DOMRect;
		};
		const countdown = document.querySelector("#countdown");
		if (!countdown) throw new Error("Missing countdown");
		return {
			countdown: box("#countdown"),
			guide: box("#reading-guide"),
			line: box(".script-line"),
			background: getComputedStyle(countdown).backgroundColor,
		};
	});
	expect(geometry.countdown.bottom).toBeLessThanOrEqual(geometry.guide.top + 1);
	expect(geometry.line.top).toBeGreaterThanOrEqual(
		geometry.countdown.bottom - 1,
	);
	expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
});

test("reading line sits in the upper part and the dim follows the guide setting", async ({
	page,
}) => {
	await openApp(page);
	await start(page);
	const ratio = await page
		.locator("#stage")
		.evaluate(
			(stage) =>
				Number.parseFloat(stage.style.getPropertyValue("--guide-y")) /
				stage.clientHeight,
		);
	expect(ratio).toBeGreaterThan(0);
	expect(ratio).toBeLessThanOrEqual(0.34);
	await page.keyboard.press("g");
	await expect(page.locator("#reading-guide")).toBeHidden();
	await expect(page.locator("#read-dim")).toBeHidden();
	await page.keyboard.press("g");
	await expect(page.locator("#reading-guide")).toBeVisible();
});

test("export offers a dated file name", async ({ page }) => {
	await openApp(page);
	await page.locator("#export").click();
	await expect(page.locator("#export-filename")).toHaveValue(
		/^wolfcue-script-\d{4}-\d{2}-\d{2}\.txt$/,
	);
});
