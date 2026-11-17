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

test("speed presets set the pace in one tap and show the current one", async ({
	page,
}) => {
	await openApp(page);
	const preset = (wpm: number, scope = "#editor") =>
		page.locator(`${scope} [data-preset-wpm="${wpm}"]`);
	await expect(preset(150)).toHaveAttribute("aria-pressed", "true");
	await expect(preset(180)).toHaveAccessibleName("Fast, 180 words per minute");
	await preset(180).click();
	await expect(page.locator("#wpm")).toHaveValue("180");
	await expect(preset(180)).toHaveAttribute("aria-pressed", "true");
	await expect(preset(150)).toHaveAttribute("aria-pressed", "false");
	// Fine-tuning off a preset leaves none selected.
	await page.locator('#editor [data-adjust="wpm"][data-direction="1"]').click();
	await expect(
		page.locator('#editor [data-preset-wpm][aria-pressed="true"]'),
	).toHaveCount(0);
	// Presets apply to words per minute only.
	await page.locator('#pace-mode input[value="target"]').check();
	await expect(page.locator("#editor .pace-presets")).toBeHidden();
	await page.locator('#pace-mode input[value="wpm"]').check();
	// Reader Settings has the same presets.
	await start(page);
	await page.locator("#reader-settings").click();
	await preset(120, "#settings-dialog").click();
	await expect(page.locator("#settings-wpm")).toHaveValue("120");
	await expect(page.locator("#reader-pace")).toHaveText("120 wpm");
});

test("export leads with the Moblin link and groups backups", async ({
	page,
}) => {
	await openApp(page);
	await page.locator("#export").click();
	const dialog = page.locator("#export-dialog");
	await expect(
		dialog.getByRole("heading", { name: "Open in Moblin" }),
	).toBeVisible();
	await expect(
		dialog.getByRole("heading", { name: "Save a backup" }),
	).toBeVisible();
	const order = await dialog.evaluate((element) =>
		Array.from(element.querySelectorAll("button, input"), (node) => node.id),
	);
	expect(order.indexOf("copy-script-link")).toBeLessThan(
		order.indexOf("download-file"),
	);
	expect(order.indexOf("download-file")).toBeLessThan(
		order.indexOf("export-filename"),
	);
});

test("action cues show smaller, stay literal and do not count as words", async ({
	page,
}) => {
	await openApp(page);
	await page
		.locator("#script")
		.fill(
			"*smile* Welcome back to the stream\n*look at camera*\nLet's start now *wave*\n*<b>bow</b>*",
		);
	await expect(page.locator("#script-stats")).toContainText("8 words");
	await start(page);
	const cues = page.locator("#script-content .cue-action");
	await expect(cues).toHaveText([
		"smile",
		"look at camera",
		"wave",
		"<b>bow</b>",
	]);
	await expect(page.locator("#script-content b")).toHaveCount(0);
	await expect(page.locator("#script-content .cue-line")).toHaveCount(2);
	const sizes = await cues.first().evaluate((cue) => ({
		cue: Number.parseFloat(getComputedStyle(cue).fontSize),
		line: Number.parseFloat(
			getComputedStyle(cue.parentElement as Element).fontSize,
		),
	}));
	expect(sizes.cue).toBeLessThan(sizes.line * 0.75);
	// An actions-only line is shorter than a full spoken line.
	const heights = await page.locator("#script-content").evaluate((content) => ({
		cueLine: content.querySelector<HTMLElement>(".cue-line")?.offsetHeight ?? 0,
		spokenLine: Number.parseFloat(getComputedStyle(content).lineHeight),
	}));
	expect(heights.cueLine).toBeGreaterThan(0);
	expect(heights.cueLine).toBeLessThan(heights.spokenLine * 0.75);
});

test("a script of only actions cannot start reading", async ({ page }) => {
	await openApp(page);
	await page.locator("#script").fill("*smile*\n*wave to chat*");
	await expect(page.locator("#script-stats")).toHaveText(
		"0 words · add words to read; actions alone do not scroll",
	);
	await expect(page.locator("#start-reading")).toBeDisabled();
	await expect(page.locator("#export")).toBeEnabled();
	await expect(page.locator("#quick-link")).toBeEnabled();
	await page.locator("#script").fill("*smile* Hello there");
	await expect(page.locator("#start-reading")).toBeEnabled();
});
