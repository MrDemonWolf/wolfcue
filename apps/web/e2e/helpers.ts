import { expect, type Page } from "@playwright/test";
export const SCRIPT = Array.from(
	{ length: 45 },
	(_, i) =>
		`Line ${i + 1}. These are synthetic words for a steady reading session.`,
).join("\n");
export async function openApp(page: Page, prefs: Record<string, unknown> = {}) {
	await page.addInitScript((settings) => {
		localStorage.setItem(
			"wolfcue:v1:prefs",
			JSON.stringify({ rev: 2, countdown: false, ...settings }),
		);
	}, prefs);
	await page.goto("./");
	await page.locator("#script").fill(SCRIPT);
}
export async function start(page: Page) {
	await page.locator("#start-reading").click();
	await expect(page.locator("#reader")).toBeVisible();
}
export async function hidePage(page: Page, hidden: boolean) {
	await page.evaluate((value) => {
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => value,
		});
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => (value ? "hidden" : "visible"),
		});
		document.dispatchEvent(new Event("visibilitychange"));
	}, hidden);
}
export async function position(page: Page) {
	return page
		.locator("#script-transform")
		.evaluate(
			(el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
		);
}

export async function openReaderControls(page: Page) {
	if (
		(await page.evaluate(
			() => matchMedia("(max-width:300px), (max-height:300px)").matches,
		)) &&
		!(await page.locator("#settings-dialog").isVisible())
	)
		await page.locator("#reader-settings").click();
	await expect(page.locator("#seek")).toBeVisible();
}
export async function closeReaderControls(page: Page) {
	if (await page.locator("#settings-dialog").isVisible())
		await page.locator('[data-close="settings-dialog"]').click();
}
/** Opens the editor with a paused fake clock, so frames only advance on demand. */
export async function openFrozen(
	page: Page,
	prefs: Record<string, unknown> = {},
) {
	await page.clock.install();
	await openApp(page, prefs);
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
}
export async function startFrozen(
	page: Page,
	prefs: Record<string, unknown> = {},
) {
	await openFrozen(page, prefs);
	await start(page);
}
export async function denyWakeLock(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "wakeLock", {
			configurable: true,
			value: {
				request: () =>
					Promise.reject(new DOMException("Denied", "NotAllowedError")),
			},
		});
	});
}
type Size = { width: number; height: number };
type Box = { x: number; y: number; width: number; height: number };
/** Compact windows keep the lower-right 60 by 60 pixels free for Moblin's expand button. */
export function expectClearOfExpandButton(box: Box, size: Size, label = "") {
	if (size.width > 300 && size.height > 300) return;
	expect(
		box.x + box.width <= size.width - 60 ||
			box.y + box.height <= size.height - 60,
		`${size.width}x${size.height} ${label} clear of the expand button`,
	).toBe(true);
}
/** Visible reader controls are 44 px targets inside the viewport and clear of the expand button. */
export async function expectReaderControlsClear(page: Page, size: Size) {
	for (const control of await page
		.locator("#reader button, #reader input")
		.all()) {
		if (!(await control.isVisible())) continue;
		const box = await control.boundingBox();
		if (!box) throw new Error("Reader control missing geometry");
		expect(box.width).toBeGreaterThanOrEqual(44);
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
		expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
		expectClearOfExpandButton(box, size);
	}
}
export async function readingPosition(page: Page) {
	return page
		.locator("#reader")
		.evaluate((reader) => Number(reader.dataset.position));
}
